"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  activeOutputs,
  canConnect as typesConnect,
  simulatedDelayMs,
  simulatedOutputs,
  validateFlow,
  type LibraryNode,
  type OutputValue,
} from "@clauderon/core";
import { outputColor } from "../../../../components/state-pill";
import type { EditorData } from "../../../../server/flows";
import { saveFlowAction } from "./actions";
import { GRID, intersects, snap } from "./canvas-geometry";
import { FlowCanvas, isTyping, type CanvasConnection, type CanvasEdge, type CanvasNode, type FlowCanvasHandle, type HandleType, type Selection } from "./flow-canvas";
import { FIcon } from "./flow-icons";
import { layeredLayout } from "./flow-layout";
import { NodeView, type NodeAction, type Placement, type WireFrom } from "./flow-node";
import { NODE_DRAG_TYPE, NodeLibrary } from "./node-library";
import { NodePanel, type PlacementPatch } from "./node-panel";
import { describeProblems, type ProblemFix, type ProblemView } from "./problem-hints";
import { hasUnsavedChanges } from "./unsaved";
import { LeaveDialog } from "./leave-dialog";
import { useLeaveGuard } from "./use-leave-guard";
import { advanceTestRun, edgeStates, nodeStates, startTestRun, type TestRun } from "./test-run";

// The canvas editor (spec M2 §3, FLW-3 … FLW-5): place Nodes from the library,
// connect Outputs to inputs of the same type, see problems live, save, and walk the
// Flow through a Test run. The canvas itself is hand-made (flow-canvas.tsx); this
// file owns the Flow being edited and the floating chrome around the canvas.

type GraphEdge = EditorData["graph"]["edges"][number];
type Doc = { placements: Placement[]; edges: GraphEdge[] };
type LibraryAnchor = { nodeId: string; side: "next" | "prev" } | null;

const HISTORY_LIMIT = 100;
const STEP_GAP = 96;
const DEFAULT_NODE = { w: 200, h: 96 };

const newId = () => crypto.randomUUID();
const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((x) => b.has(x));
const NO_SELECTION: Selection = { nodes: new Set(), edges: new Set() };
const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function FlowEditor({ data, notice }: { data: EditorData; notice?: ReactNode }) {
  const { library, readOnly } = data;
  const libById = useMemo(() => new Map(library.map((n) => [n.id, n])), [library]);
  const canvas = useRef<FlowCanvasHandle>(null);

  const [name, setName] = useState(data.flow.name);
  const [savedName, setSavedName] = useState(data.flow.name);
  const [doc, setDoc] = useState<Doc>({ placements: data.graph.nodes, edges: data.graph.edges });
  // The Flow as last saved: undoing back to it leaves nothing to save.
  const [savedDoc, setSavedDoc] = useState(doc);
  const dirty = doc !== savedDoc;
  const docRef = useRef(doc);
  docRef.current = doc;
  const [history, setHistory] = useState<{ past: Doc[]; future: Doc[] }>({ past: [], future: [] });
  const [selected, setSelected] = useState<Selection>(NO_SELECTION);
  const [wire, setWire] = useState<WireFrom | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [libraryAt, setLibraryAt] = useState<{ open: boolean; anchor: LibraryAnchor }>({ open: false, anchor: null });
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const [testOutputs, setTestOutputs] = useState<ReadonlyMap<string, OutputValue[]>>(new Map());
  const [dropping, setDropping] = useState(false);
  const [fitRequest, setFitRequest] = useState(0);

  const { placements, edges: graphEdges } = doc;
  const placementById = useMemo(() => new Map(placements.map((p) => [p.id, p])), [placements]);
  const libOf = useCallback((flowNodeId: string) => libById.get(placementById.get(flowNodeId)?.nodeId ?? ""), [libById, placementById]);

  // --- changing the Flow: every change can be undone, and ends a Test run in progress ---
  // The history lives in a ref (read and written outside React's updaters, which may run
  // twice) and is mirrored into state only so the Undo / Redo buttons re-render.
  const historyRef = useRef<{ past: Doc[]; future: Doc[] }>({ past: [], future: [] });
  const syncHistory = () => setHistory({ ...historyRef.current });
  const pushPast = (snapshot: Doc) => {
    historyRef.current = { past: [...historyRef.current.past.slice(-HISTORY_LIMIT + 1), snapshot], future: [] };
    syncHistory();
  };
  const setCurrent = (next: Doc) => {
    docRef.current = next;
    setDoc(next);
    setMessage(null);
    setTestRun(null);
  };
  const change = (fn: (d: Doc) => Doc, options: { record?: boolean } = {}) => {
    const before = docRef.current;
    const after = fn(before);
    if (after === before) return;
    if (options.record !== false) pushPast(before);
    setCurrent(after);
  };
  /** Remembers the Flow as it is now, before a gesture that changes it step by step (a drag). */
  const record = () => pushPast(docRef.current);
  const undo = () => {
    const { past, future } = historyRef.current;
    const prev = past[past.length - 1];
    if (!prev) return;
    historyRef.current = { past: past.slice(0, -1), future: [docRef.current, ...future] };
    syncHistory();
    setCurrent(prev);
  };
  const redo = () => {
    const { past, future } = historyRef.current;
    const next = future[0];
    if (!next) return;
    historyRef.current = { past: [...past, docRef.current], future: future.slice(1) };
    syncHistory();
    setCurrent(next);
  };

  // --- problems, live (FLW-5) ---
  const problems = useMemo(
    () =>
      validateFlow(
        { nodes: placements.map((p) => ({ id: p.id, nodeId: p.nodeId, x: p.x, y: p.y, enabledOptionalOutputs: p.enabledOptionalOutputs })), edges: graphEdges },
        library,
      ),
    [placements, graphEdges, library],
  );
  // The same problems in plain words, with the Nodes they concern and a one-click fix when there is one.
  const problemViews = useMemo(() => describeProblems(problems, placements, graphEdges, library), [problems, placements, graphEdges, library]);
  const edgeProblem = useMemo(() => {
    const m = new Map<string, ProblemView>();
    for (const v of problemViews) if (v.problem.edgeId && !m.has(v.problem.edgeId)) m.set(v.problem.edgeId, v);
    return m;
  }, [problemViews]);
  const nodeProblems = useMemo(() => {
    const m = new Map<string, ProblemView[]>();
    for (const v of problemViews) if (v.problem.flowNodeId) m.set(v.problem.flowNodeId, [...(m.get(v.problem.flowNodeId) ?? []), v]);
    return m;
  }, [problemViews]);
  /** Everything a Node is part of, for its details panel: its own problems and those of its edges. */
  const problemsAround = (flowNodeId: string) => problemViews.filter((v) => v.nodeIds.includes(flowNodeId));
  const missingInputs = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const v of problemViews)
      if (v.problem.code === "required-input-unconnected" && v.problem.flowNodeId && v.problem.input) m.set(v.problem.flowNodeId, new Set([...(m.get(v.problem.flowNodeId) ?? []), v.problem.input]));
    return m;
  }, [problemViews]);

  // Picking a problem flashes the Nodes and edge it is about.
  const [flash, setFlash] = useState<{ nodes: ReadonlySet<string>; edges: ReadonlySet<string> } | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  // --- the Test run: steps through the Flow on a timer, making up Outputs as a Dry-run would ---
  const running = testRun !== null && testRun.phase !== "done";
  const runNodeStates = useMemo(() => (testRun ? nodeStates(testRun) : null), [testRun]);
  const runEdgeStates = useMemo(() => (testRun ? edgeStates(testRun, graphEdges) : null), [testRun, graphEdges]);
  useEffect(() => {
    if (!testRun || testRun.phase === "done") return;
    const current = testRun.order[testRun.index]!;
    // A Dry-run Node takes 2–8 s; the Test run plays them four times faster.
    const delay = testRun.phase === "waiting" ? 1200 : Math.round(simulatedDelayMs(Math.random) / 4);
    const timer = setTimeout(() => {
      const kindOf = (id: string) => libOf(id)?.kind;
      const next = advanceTestRun(testRun, kindOf);
      if (next.index !== testRun.index || next.phase === "done") {
        const lib = libOf(current);
        const placement = placementById.get(current);
        if (lib && placement) {
          const outputs = simulatedOutputs(lib.outputs, placement.enabledOptionalOutputs, Math.random, { branch: "clauderon/test-run" });
          setTestOutputs((m) => new Map(m).set(current, outputs));
        }
      }
      setTestRun(next);
    }, delay);
    return () => clearTimeout(timer);
  }, [testRun, libOf, placementById]);

  const startRun = () => {
    if (problems.length > 0) {
      setProblemsOpen(true);
      return;
    }
    const run = startTestRun({ nodes: placements.map((p) => ({ id: p.id, nodeId: p.nodeId, x: p.x, y: p.y, enabledOptionalOutputs: p.enabledOptionalOutputs })), edges: graphEdges });
    if ("error" in run) {
      setMessage({ kind: "error", text: run.error });
      return;
    }
    setTestOutputs(new Map());
    setTestRun(run);
  };

  // --- canvas Nodes and edges ---
  const single = selected.nodes.size === 1 && selected.edges.size === 0 ? [...selected.nodes][0]! : null;
  const nodes: CanvasNode[] = placements.flatMap((p) => {
    const lib = libById.get(p.nodeId);
    if (!lib) return [];
    const isSelected = selected.nodes.has(p.id);
    return [
      {
        id: p.id,
        x: p.x,
        y: p.y,
        selected: isSelected,
        content: (
          <NodeView
            id={p.id}
            lib={lib}
            placement={p}
            selected={isSelected}
            focused={single === p.id && !running}
            readOnly={readOnly || running}
            problems={(nodeProblems.get(p.id) ?? []).map((v) => v.title)}
            missingInputs={missingInputs.get(p.id)}
            flash={flash?.nodes.has(p.id)}
            runState={runNodeStates?.get(p.id)}
            wire={wire}
            renaming={renaming === p.id}
            onRename={(label) => {
              setRenaming(null);
              if (label !== undefined && label !== p.label) change((d) => ({ ...d, placements: d.placements.map((x) => (x.id === p.id ? { ...x, label } : x)) }));
            }}
            onAction={(action) => nodeAction(p.id, action)}
            onAdd={(side) => setLibraryAt({ open: true, anchor: { nodeId: p.id, side } })}
          />
        ),
      },
    ];
  });
  const outputTypeOf = (flowNodeId: string, output: string) => libOf(flowNodeId)?.outputs.find((o) => o.name === output)?.type ?? "";
  const edges: CanvasEdge[] = graphEdges.map((e) => ({
    id: e.id,
    fromNodeId: e.fromFlowNodeId,
    fromOutput: e.fromOutput,
    toNodeId: e.toFlowNodeId,
    toInput: e.toInput,
    selected: selected.edges.has(e.id),
    reason: edgeProblem.get(e.id)?.title ?? null,
    missing: edgeProblem.get(e.id)?.missing,
    flash: flash?.edges.has(e.id),
    color: outputColor(outputTypeOf(e.fromFlowNodeId, e.fromOutput)),
    state: runEdgeStates?.get(e.id) ?? null,
  }));

  const onSelect = (next: Selection) => {
    setSelected((s) => (sameSet(s.nodes, next.nodes) && sameSet(s.edges, next.edges) ? s : next));
    if (next.nodes.size !== 1) setRenaming(null);
    setProblemsOpen(false);
    setShortcutsOpen(false);
  };

  const onMoveNodes = (moves: { id: string; x: number; y: number }[]) => {
    const to = new Map(moves.map((m) => [m.id, m]));
    change((d) => ({ ...d, placements: d.placements.map((p) => (to.has(p.id) ? { ...p, x: to.get(p.id)!.x, y: to.get(p.id)!.y } : p)) }), { record: false });
  };

  const onDelete = (what: Selection) => {
    change((d) => ({
      placements: d.placements.filter((p) => !what.nodes.has(p.id)),
      edges: d.edges.filter((e) => !what.nodes.has(e.fromFlowNodeId) && !what.nodes.has(e.toFlowNodeId) && !what.edges.has(e.id)),
    }));
    setSelected(NO_SELECTION);
    setRenaming(null);
  };

  const onConnect = (c: CanvasConnection) => {
    // A mismatched edge, or a second edge into a taken input, is still drawn, in an
    // error state, and counts as a problem (FLW-4). Only an exact duplicate is skipped.
    const exists = graphEdges.some((e) => e.fromFlowNodeId === c.source && e.fromOutput === c.sourceHandle && e.toFlowNodeId === c.target && e.toInput === c.targetHandle);
    if (exists) return;
    change((d) => ({ ...d, edges: [...d.edges, { id: newId(), fromFlowNodeId: c.source, fromOutput: c.sourceHandle, toFlowNodeId: c.target, toInput: c.targetHandle }] }));
  };

  const onConnectStart = (from: { nodeId: string; type: HandleType; name: string }) => {
    const lib = libOf(from.nodeId);
    const port = from.type === "source" ? lib?.outputs.find((o) => o.name === from.name) : lib?.inputs.find((i) => i.name === from.name);
    if (port) setWire({ nodeId: from.nodeId, handleType: from.type, type: port.type });
  };

  // --- adding Nodes: from the library popover, by dragging, or from a Node's "+" ---
  const sizeOf = (id: string) => canvas.current?.sizeOf(id) ?? DEFAULT_NODE;
  /** The nearest spot at or below (x, y) where a new Node does not cover another one. */
  const freeSpot = (x: number, y: number) => {
    const margin = 24;
    const taken = docRef.current.placements.map((p) => ({ x: p.x - margin, y: p.y - margin, ...sizeOf(p.id) })).map((r) => ({ ...r, w: r.w + 2 * margin, h: r.h + 2 * margin }));
    const at = { x: snap(x), y: snap(y) };
    for (let i = 0; i < 200 && taken.some((r) => intersects(r, { ...at, ...DEFAULT_NODE })); i++) at.y += GRID * 2;
    return at;
  };

  const add = (lib: LibraryNode, at: { x: number; y: number }, anchor: LibraryAnchor = null) => {
    const id = newId();
    const placement: Placement = { id, nodeId: lib.id, label: null, extraInstructions: "", enabledOptionalOutputs: [], ...freeSpot(at.x, at.y) };
    const link = anchor ? linkFor(anchor, lib, id) : null;
    change((d) => ({ placements: [...d.placements, placement], edges: link ? [...d.edges, link] : d.edges }));
    setSelected({ nodes: new Set([id]), edges: new Set() });
    setLibraryAt({ open: false, anchor: null });
    return placement;
  };

  /** The edge a Node added from a "+" button gets: the first pair of ports of the same type. */
  const linkFor = (anchor: NonNullable<LibraryAnchor>, lib: LibraryNode, newNodeId: string): GraphEdge | null => {
    const from = placementById.get(anchor.nodeId);
    const fromLib = from && libById.get(from.nodeId);
    if (!from || !fromLib) return null;
    if (anchor.side === "next") {
      for (const o of activeOutputs(fromLib.outputs, from.enabledOptionalOutputs))
        for (const i of lib.inputs) if (typesConnect(o, i).ok) return { id: newId(), fromFlowNodeId: from.id, fromOutput: o.name, toFlowNodeId: newNodeId, toInput: i.name };
    } else {
      const taken = new Set(graphEdges.filter((e) => e.toFlowNodeId === from.id).map((e) => e.toInput));
      for (const i of fromLib.inputs.filter((x) => !taken.has(x.name)))
        for (const o of lib.outputs.filter((x) => !x.optional)) if (typesConnect(o, i).ok) return { id: newId(), fromFlowNodeId: newNodeId, fromOutput: o.name, toFlowNodeId: from.id, toInput: i.name };
    }
    return null;
  };

  const pickFromLibrary = (lib: LibraryNode) => {
    const anchor = libraryAt.anchor;
    const from = anchor && placementById.get(anchor.nodeId);
    if (anchor && from) {
      const size = sizeOf(from.id);
      const at = anchor.side === "next" ? { x: from.x + size.w + STEP_GAP, y: from.y } : { x: from.x - DEFAULT_NODE.w - STEP_GAP, y: from.y };
      const placed = add(lib, at, anchor);
      canvas.current?.centerOn(placed.x + DEFAULT_NODE.w / 2, placed.y + DEFAULT_NODE.h / 2, { duration: 260 });
    } else {
      const c = canvas.current?.viewCenter() ?? { x: 0, y: 0 };
      add(lib, { x: c.x - DEFAULT_NODE.w / 2, y: c.y - DEFAULT_NODE.h / 2 });
    }
  };

  const libraryConnects = useMemo(() => {
    const anchor = libraryAt.anchor;
    const from = anchor && placementById.get(anchor.nodeId);
    const fromLib = from && libById.get(from.nodeId);
    if (!anchor || !from || !fromLib) return undefined;
    return (lib: LibraryNode) =>
      anchor.side === "next"
        ? activeOutputs(fromLib.outputs, from.enabledOptionalOutputs).some((o) => lib.inputs.some((i) => i.type === o.type))
        : fromLib.inputs.some((i) => lib.outputs.some((o) => !o.optional && o.type === i.type));
  }, [libraryAt.anchor, placementById, libById]);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDropping(false);
    const lib = libById.get(event.dataTransfer.getData(NODE_DRAG_TYPE));
    if (!lib || readOnly || !canvas.current) return;
    const at = canvas.current.screenToWorld(event.clientX, event.clientY);
    add(lib, { x: at.x - DEFAULT_NODE.w / 2, y: at.y - 20 });
  };

  // --- Node actions (toolbar and shortcuts) ---
  const duplicate = (ids: ReadonlySet<string>) => {
    if (ids.size === 0) return;
    const copies = new Map<string, string>();
    for (const id of ids) copies.set(id, newId());
    change((d) => ({
      placements: [...d.placements, ...d.placements.filter((p) => ids.has(p.id)).map((p) => ({ ...p, id: copies.get(p.id)!, x: p.x + 32, y: p.y + 32 }))],
      edges: [
        ...d.edges,
        ...d.edges.filter((e) => ids.has(e.fromFlowNodeId) && ids.has(e.toFlowNodeId)).map((e) => ({ ...e, id: newId(), fromFlowNodeId: copies.get(e.fromFlowNodeId)!, toFlowNodeId: copies.get(e.toFlowNodeId)! })),
      ],
    }));
    setSelected({ nodes: new Set(copies.values()), edges: new Set() });
  };

  function nodeAction(id: string, action: NodeAction) {
    if (action === "rename" && !readOnly) setRenaming(id);
    if (action === "details") setPanelOpen((v) => !v || single !== id);
    if (action === "duplicate" && !readOnly) duplicate(new Set([id]));
    if (action === "delete" && !readOnly) onDelete({ nodes: new Set([id]), edges: new Set() });
  }

  const tidy = () => {
    const at = layeredLayout(
      placements.map((p) => ({ id: p.id, x: p.x, y: p.y, ...sizeOf(p.id) })),
      graphEdges.map((e) => ({ from: e.fromFlowNodeId, to: e.toFlowNodeId })),
    );
    change((d) => ({ ...d, placements: d.placements.map((p) => ({ ...p, ...(at.get(p.id) ?? {}) })) }));
    setFitRequest((n) => n + 1);
  };
  // Fit after the tidied positions have been rendered, not before.
  useEffect(() => {
    if (fitRequest > 0) canvas.current?.fit();
  }, [fitRequest]);

  const focus = (view: ProblemView) => {
    const { problem } = view;
    const edge = problem.edgeId ? graphEdges.find((e) => e.id === problem.edgeId) : undefined;
    setSelected({ nodes: new Set(problem.flowNodeId ? [problem.flowNodeId] : []), edges: new Set(edge ? [edge.id] : []) });
    setFlash({ nodes: new Set(view.nodeIds), edges: new Set(edge ? [edge.id] : []) });
    setProblemsOpen(false);
    const around = view.nodeIds.flatMap((id) => placementById.get(id) ?? []);
    if (around.length > 0) {
      const xs = around.flatMap((p) => [p.x, p.x + sizeOf(p.id).w]);
      const ys = around.flatMap((p) => [p.y, p.y + sizeOf(p.id).h]);
      canvas.current?.centerOn((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, { zoom: 1, duration: 300 });
    }
  };

  const applyFix = (fix: ProblemFix) => {
    if (readOnly || running) return;
    if (fix.kind === "remove-edge") onDelete({ nodes: new Set(), edges: new Set([fix.edgeId]) });
    if (fix.kind === "remove-node") onDelete({ nodes: new Set([fix.flowNodeId]), edges: new Set() });
    if (fix.kind === "enable-output")
      change((d) => ({ ...d, placements: d.placements.map((p) => (p.id === fix.flowNodeId && !p.enabledOptionalOutputs.includes(fix.output) ? { ...p, enabledOptionalOutputs: [...p.enabledOptionalOutputs, fix.output] } : p)) }));
    if (fix.kind === "add-node") setLibraryAt({ open: true, anchor: null });
    setProblemsOpen(false);
  };

  const problemCard = (view: ProblemView, compact = false) => (
    <div className={`fe-problem ${compact ? "compact" : ""}`}>
      <div className="fe-problem-title">
        {FIcon.alert}
        <b>{view.title}</b>
      </div>
      <p>{view.hint}</p>
      {view.fix && !readOnly && !running && (
        <button type="button" className="fe-btn sm danger-soft" onClick={() => applyFix(view.fix!)}>
          {view.fix.label}
        </button>
      )}
    </div>
  );


  const canSave = !readOnly && !pending && (dirty || name.trim() !== savedName) && name.trim() !== "";
  const save = async () => {
    if (!canSave) return;
    setPending(true);
    const sent = docRef.current;
    const result = await saveFlowAction(data.flow.id, { name, nodes: sent.placements, edges: sent.edges });
    setPending(false);
    if (result.ok) {
      setSavedDoc(sent);
      setSavedName(name.trim());
      setMessage({ kind: "ok", text: result.problems === 0 ? "Saved." : `Saved with ${result.problems} problem${result.problems === 1 ? "" : "s"}. It cannot be picked in the Start dialog until they are fixed.` });
    } else {
      setMessage({ kind: "error", text: result.error });
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (message?.kind !== "ok") return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  // Leaving with unsaved changes asks first.
  const unsaved = hasUnsavedChanges({ readOnly, graphChanged: dirty, name, savedName });
  const leaveGuard = useLeaveGuard(unsaved);

  // --- keyboard shortcuts ---
  const keyState = useRef({ selected, single, readOnly, libraryAt, renaming, panelOpen, problemsOpen, shortcutsOpen, testRun });
  keyState.current = { selected, single, readOnly, libraryAt, renaming, panelOpen, problemsOpen, shortcutsOpen, testRun };
  const actionsRef = useRef({ undo, redo, duplicate, tidy });
  actionsRef.current = { undo, redo, duplicate, tidy };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = keyState.current;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "s") {
        e.preventDefault();
        void saveRef.current();
        return;
      }
      if (isTyping(e.target)) return;
      if (e.key === "Escape") {
        if (s.libraryAt.open) setLibraryAt({ open: false, anchor: null });
        else if (s.problemsOpen || s.shortcutsOpen) {
          setProblemsOpen(false);
          setShortcutsOpen(false);
        } else if (s.panelOpen) setPanelOpen(false);
        else setSelected(NO_SELECTION);
        return;
      }
      if (mod && key === "z" && !s.readOnly) {
        e.preventDefault();
        if (e.shiftKey) actionsRef.current.redo();
        else actionsRef.current.undo();
      } else if (mod && key === "y" && !s.readOnly) {
        e.preventDefault();
        actionsRef.current.redo();
      } else if (mod && key === "d" && !s.readOnly) {
        e.preventDefault();
        actionsRef.current.duplicate(s.selected.nodes);
      } else if (mod && key === "a") {
        e.preventDefault();
        setSelected({ nodes: new Set(docRef.current.placements.map((p) => p.id)), edges: new Set() });
      } else if (mod || e.altKey) {
        return;
      } else if (key === "f") {
        canvas.current?.fit();
      } else if (key === "=" || key === "+") {
        canvas.current?.zoomBy(1.25);
      } else if (key === "-" || key === "_") {
        canvas.current?.zoomBy(1 / 1.25);
      } else if (key === "n" && !s.readOnly) {
        e.preventDefault();
        setLibraryAt({ open: true, anchor: null });
      } else if ((e.key === "Enter" || e.key === "F2") && s.single && !s.readOnly) {
        e.preventDefault();
        setRenaming(s.single);
      } else if (key === "l" && e.shiftKey && !s.readOnly) {
        actionsRef.current.tidy();
      } else if (key === "?") {
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selectedPlacement = single ? (placementById.get(single) ?? null) : null;
  const selectedLib = selectedPlacement ? libById.get(selectedPlacement.nodeId) : undefined;
  const usedOutputs = useMemo(() => new Set(graphEdges.filter((e) => e.fromFlowNodeId === selectedPlacement?.id).map((e) => e.fromOutput)), [graphEdges, selectedPlacement]);
  const patch = (id: string, p: PlacementPatch) => change((d) => ({ ...d, placements: d.placements.map((x) => (x.id === id ? { ...x, ...p } : x)) }));

  const runStep = testRun && testRun.phase !== "done" ? testRun.order[testRun.index] : null;
  const runStepName = runStep ? placementById.get(runStep)?.label || libOf(runStep)?.name : null;
  const mod = isMac() ? "⌘" : "Ctrl";
  const status = readOnly ? "Read-only" : pending ? "Saving…" : unsaved ? "Unsaved changes" : "All changes saved";

  return (
    <div className="flow-fill fe">
      <div
        className={`flow-canvas ${dropping ? "dropping" : ""}`}
        data-testid="flow-canvas"
        onDrop={onDrop}
        onDragOver={(e) => {
          if (readOnly || !e.dataTransfer.types.includes(NODE_DRAG_TYPE)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!dropping) setDropping(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
        }}
      >
        <FlowCanvas
          ref={canvas}
          nodes={nodes}
          edges={edges}
          readOnly={readOnly || running}
          onSelect={onSelect}
          onMoveStart={record}
          onMoveNodes={onMoveNodes}
          onConnect={onConnect}
          onDelete={onDelete}
          onConnectStart={onConnectStart}
          onConnectEnd={() => setWire(null)}
          onNodeDoubleClick={(id) => {
            setSelected({ nodes: new Set([id]), edges: new Set() });
            setPanelOpen(true);
          }}
          // Mismatches are allowed and drawn as errors; only a Node to itself is refused.
          canConnect={(c) => c.source !== c.target}
          renderEdgeCard={(edgeId) => {
            const v = edgeProblem.get(edgeId);
            return v ? problemCard(v, true) : null;
          }}
          zoomBarExtra={
            <button type="button" className="fc-ibtn fe-kbd" aria-label="Keyboard shortcuts" aria-expanded={shortcutsOpen} title="Keyboard shortcuts (?)" onClick={() => setShortcutsOpen((v) => !v)}>
              {FIcon.keyboard}
            </button>
          }
        />

        {/* top left: back, name, save state, problems */}
        <div className="fe-bar fe-bar-left fc-overlay" onPointerDown={(e) => e.stopPropagation()}>
          <Link href="/flows" className="fc-ibtn" aria-label="Back to Flows" title="Back to Flows">
            {FIcon.back}
          </Link>
          <span className="fe-bar-ic" aria-hidden="true">
            {FIcon.flow}
          </span>
          <input
            className="fe-name"
            aria-label="Flow name"
            value={name}
            readOnly={readOnly}
            size={Math.max(8, Math.min(36, name.length + 1))}
            onChange={(e) => {
              setName(e.target.value);
              setMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
          />
          <span className={`fe-status ${unsaved ? "unsaved" : ""}`} aria-live="polite">
            {status}
          </span>
          <button
            type="button"
            className={`fe-chip ${problems.length > 0 ? "fail" : "ok"}`}
            data-testid="problems-badge"
            aria-expanded={problemsOpen}
            onClick={() => {
              setProblemsOpen((v) => !v);
              setShortcutsOpen(false);
            }}
          >
            <i />
            {problems.length === 0 ? "Ready" : `${problems.length} problem${problems.length === 1 ? "" : "s"}`}
          </button>
        </div>

        {problemsOpen && (
          <div className="fe-pop fe-problems fc-overlay" role="dialog" aria-label="Problems" onPointerDown={(e) => e.stopPropagation()}>
            {problems.length === 0 ? (
              <p className="small fe-pop-empty">
                <span className="ok-text">{FIcon.check}</span> No problems. This Flow can be picked in the Start dialog.
              </p>
            ) : (
              <ul data-testid="problems-list" role="list">
                {problemViews.map((v, i) => (
                  <li key={i}>
                    <button type="button" className="fe-problem-item" onClick={() => focus(v)} title={v.nodeIds.length > 0 ? "Show it on the canvas" : undefined}>
                      {FIcon.alert}
                      <span>
                        <b>{v.title}</b>
                        <small>{v.hint}</small>
                      </span>
                    </button>
                    {v.fix && !readOnly && !running && (
                      <button type="button" className="fe-btn sm danger-soft fe-problem-fix" onClick={() => applyFix(v.fix!)}>
                        {v.fix.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* top right: Test run and Save */}
        <div className="fe-bar fe-bar-right fc-overlay" onPointerDown={(e) => e.stopPropagation()}>
          {running ? (
            <button type="button" className="fe-btn" onClick={() => setTestRun(null)}>
              {FIcon.stop}
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              className="fe-btn"
              title={problems.length > 0 ? "Fix the problems first" : "Walk the Flow with made-up Outputs. Nothing runs on a Pod."}
              onClick={startRun}
              disabled={placements.length === 0}
            >
              {FIcon.play}
              <span>Test run</span>
            </button>
          )}
          {!readOnly && (
            <button type="button" className="fe-btn primary" disabled={!canSave} onClick={() => void save()} title={`Save (${mod}S)`}>
              {FIcon.save}
              <span>{pending ? "Saving…" : "Save"}</span>
            </button>
          )}
        </div>

        {/* left rail: add, tidy, undo, redo */}
        {!readOnly && (
          <div className="fe-rail fc-overlay" role="toolbar" aria-label="Edit" aria-orientation="vertical" onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`fc-ibtn ${libraryAt.open && !libraryAt.anchor ? "on" : ""}`}
              aria-label="Add a Node"
              aria-expanded={libraryAt.open}
              title="Add a Node (N)"
              onClick={() => setLibraryAt((l) => ({ open: !(l.open && !l.anchor), anchor: null }))}
            >
              {FIcon.plus}
            </button>
            <button type="button" className="fc-ibtn" aria-label="Tidy up" title="Tidy up (Shift L)" disabled={placements.length < 2 || running} onClick={tidy}>
              {FIcon.tidy}
            </button>
            <span className="fc-sep h" />
            <button type="button" className="fc-ibtn" aria-label="Undo" title={`Undo (${mod}Z)`} disabled={history.past.length === 0} onClick={undo}>
              {FIcon.undo}
            </button>
            <button type="button" className="fc-ibtn" aria-label="Redo" title={`Redo (${mod}⇧Z)`} disabled={history.future.length === 0} onClick={redo}>
              {FIcon.redo}
            </button>
          </div>
        )}

        {libraryAt.open && !readOnly && (
          <NodeLibrary
            key={libraryAt.anchor ? `${libraryAt.anchor.nodeId}-${libraryAt.anchor.side}` : "free"}
            library={library}
            title={libraryAt.anchor ? (libraryAt.anchor.side === "next" ? "Add the step after" : "Add the step before") : "Add a Node"}
            connects={libraryConnects}
            onPick={pickFromLibrary}
            onClose={() => setLibraryAt({ open: false, anchor: null })}
          />
        )}

        {panelOpen && selectedPlacement && selectedLib && (
          <NodePanel
            key={selectedPlacement.id}
            placement={selectedPlacement}
            lib={selectedLib}
            readOnly={readOnly || running}
            usedOutputs={usedOutputs}
            problems={problemsAround(selectedPlacement.id).map((v) => <div key={`${v.problem.code}-${v.problem.edgeId ?? v.problem.input ?? ""}`}>{problemCard(v)}</div>)}
            runState={runNodeStates?.get(selectedPlacement.id)}
            testOutputs={testOutputs.get(selectedPlacement.id)}
            onChange={(p) => patch(selectedPlacement.id, p)}
            onClose={() => setPanelOpen(false)}
          />
        )}

        {shortcutsOpen && (
          <div className="fe-pop fe-shortcuts fc-overlay" role="dialog" aria-label="Keyboard shortcuts" onPointerDown={(e) => e.stopPropagation()}>
            <dl>
              {[
                ["Pan", "Drag the background, or scroll"],
                ["Zoom", `${mod} + scroll, pinch, + / −`],
                ["Fit view", "F"],
                ["Select several", "Shift + click, Shift + drag"],
                ["Select all", `${mod} A`],
                ["Add a Node", "N"],
                ["Rename", "Enter"],
                ["Duplicate", `${mod} D`],
                ["Delete", "Delete / ⌫"],
                ["Undo / Redo", `${mod} Z / ${mod} ⇧ Z`],
                ["Tidy up", "Shift L"],
                ["Save", `${mod} S`],
                ["Place freely", "Hold Alt while dragging"],
              ].map(([what, keys]) => (
                <div key={what}>
                  <dt>{what}</dt>
                  <dd>
                    <kbd>{keys}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {(notice || message) && (
          <div className="fe-notices fc-overlay" onPointerDown={(e) => e.stopPropagation()}>
            {notice}
            {message && (
              <div className={`fe-toast ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
                {message.kind === "ok" ? FIcon.check : FIcon.alert}
                <span>{message.text}</span>
                <button type="button" className="fc-ibtn" aria-label="Dismiss" onClick={() => setMessage(null)}>
                  {FIcon.close}
                </button>
              </div>
            )}
          </div>
        )}

        {testRun && (
          <div className={`fe-runbar fc-overlay ${testRun.phase}`} role="status" aria-live="polite" onPointerDown={(e) => e.stopPropagation()}>
            {testRun.phase === "done" ? (
              <>
                <span className="fe-run-dot ok">{FIcon.check}</span>
                <span>
                  <b>Test run passed</b> · {testRun.order.length} Node{testRun.order.length === 1 ? "" : "s"}, nothing ran on a Pod.
                </span>
                <Link href="/tickets" className="fe-btn sm">
                  Start a Run
                </Link>
                <button type="button" className="fc-ibtn" aria-label="Clear the Test run" onClick={() => setTestRun(null)}>
                  {FIcon.close}
                </button>
              </>
            ) : (
              <>
                <span className={`fe-run-dot ${testRun.phase}`}>{testRun.phase === "waiting" ? FIcon.pause : <span className="fnode-spin" />}</span>
                <span>
                  <b>Test run</b> · step {testRun.index + 1} of {testRun.order.length}: {runStepName}
                  {testRun.phase === "waiting" ? " (would wait for a person)" : ""}
                </span>
                <span className="fe-run-progress" aria-hidden="true">
                  <span style={{ width: `${(testRun.index / testRun.order.length) * 100}%` }} />
                </span>
              </>
            )}
          </div>
        )}

        {placements.length === 0 && (
          <div className="fe-empty fc-overlay" onPointerDown={(e) => e.stopPropagation()}>
            <span className="fe-empty-ic">{FIcon.flow}</span>
            <b>This Flow is empty</b>
            <span className="faint small">{readOnly ? "There is nothing to show." : "Start with a Ticket Node, then add the steps after it."}</span>
            {!readOnly && (
              <button type="button" className="fe-btn primary" onClick={() => setLibraryAt({ open: true, anchor: null })}>
                {FIcon.plus}
                <span>Add a Node</span>
              </button>
            )}
          </div>
        )}
      </div>
      <LeaveDialog pending={leaveGuard.pending} onStay={leaveGuard.stay} onLeave={leaveGuard.leave} />
    </div>
  );
}
