"use client";

import { useMemo, useRef, useState, createContext, useContext, type DragEvent } from "react";
import { validateFlow, type LibraryNode, type OutputType, type Problem } from "@clauderon/core";
import { outputColor } from "../../../../components/state-pill";
import type { EditorData } from "../../../../server/flows";
import { saveFlowAction } from "./actions";
import { CanvasHandle, FlowCanvas, type CanvasConnection, type CanvasEdge, type CanvasNode, type FlowCanvasHandle, type HandleType, type Selection } from "./flow-canvas";
import { NodePanel, type PlacementPatch } from "./node-panel";

// The canvas editor (spec M2 §3, FLW-3 … FLW-5): place Nodes from the library,
// connect Outputs to inputs of the same type, see problems live, save. The canvas
// itself is hand-made (flow-canvas.tsx); this file owns the Flow being edited.

type Placement = EditorData["graph"]["nodes"][number];

const KIND_LABEL: Record<string, string> = { ticket: "Ticket", agent: "Agent", command: "Command", approve: "Approve", grill: "Grill" };

const newId = () => crypto.randomUUID();
const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/** The Output being dragged right now, so inputs it can connect to light up (FLW-4). */
const DragContext = createContext<{ from: { nodeId: string; type: OutputType } | null }>({ from: null });

function NodeView({ id, lib, placement, selected }: { id: string; lib: LibraryNode; placement: Placement; selected: boolean }) {
  const drag = useContext(DragContext);
  return (
    <div className={`fnode k-${lib.kind} ${selected ? "on" : ""}`} data-kind={lib.kind} data-testid={`fnode-${lib.name}`}>
      <div className="fnode-h">
        <b>{placement.label || lib.name}</b>
        <span className={`tag k-${lib.kind}`}>{KIND_LABEL[lib.kind] ?? lib.kind}</span>
      </div>
      <div className="fnode-ports">
        <div className="stack" style={{ gap: 4 }}>
          {lib.inputs.map((i) => {
            const lit = drag.from !== null && drag.from.nodeId !== id && drag.from.type === i.type;
            return (
              <div key={i.name} className={`fport in ${lit ? "lit" : ""}`}>
                <CanvasHandle nodeId={id} type="target" name={i.name} lit={lit} color={outputColor(i.type)} />
                <span>
                  {i.name}
                  {i.required ? " *" : ""} <span className="ptype" style={{ "--c": outputColor(i.type) } as React.CSSProperties}>{i.type}</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="stack" style={{ gap: 4, alignItems: "flex-end" }}>
          {lib.outputs.map((o) => {
            const off = o.optional && !placement.enabledOptionalOutputs.includes(o.name);
            return (
              <div key={o.name} className={`fport out ${off ? "off" : ""}`}>
                <span>
                  {o.name}
                  {o.optional ? " (optional)" : ""} <span className="ptype" style={{ "--c": outputColor(o.type) } as React.CSSProperties}>{o.type}</span>
                </span>
                <CanvasHandle nodeId={id} type="source" name={o.name} color={outputColor(o.type)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function FlowEditor({ data }: { data: EditorData }) {
  const { library, readOnly } = data;
  const libById = useMemo(() => new Map(library.map((n) => [n.id, n])), [library]);
  const canvas = useRef<FlowCanvasHandle>(null);

  const [name, setName] = useState(data.flow.name);
  const [placements, setPlacements] = useState<Placement[]>(data.graph.nodes);
  const [graphEdges, setGraphEdges] = useState(data.graph.edges);
  const [selected, setSelected] = useState<Selection>({ nodes: new Set(), edges: new Set() });
  const [dragFrom, setDragFrom] = useState<{ nodeId: string; type: OutputType } | null>(null);
  const dragValue = useMemo(() => ({ from: dragFrom }), [dragFrom]);
  const [showProblems, setShowProblems] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const touch = () => {
    setDirty(true);
    setMessage(null);
  };

  const problems = useMemo(
    () =>
      validateFlow(
        {
          nodes: placements.map((p) => ({ id: p.id, nodeId: p.nodeId, x: p.x, y: p.y, enabledOptionalOutputs: p.enabledOptionalOutputs })),
          edges: graphEdges,
        },
        library,
      ),
    [placements, graphEdges, library],
  );
  const edgeProblem = useMemo(() => new Map(problems.filter((p) => p.edgeId).map((p) => [p.edgeId!, p.message])), [problems]);

  const nodes: CanvasNode[] = placements.flatMap((p) => {
    const lib = libById.get(p.nodeId);
    const isSelected = selected.nodes.has(p.id);
    return lib ? [{ id: p.id, x: p.x, y: p.y, selected: isSelected, content: <NodeView id={p.id} lib={lib} placement={p} selected={isSelected} /> }] : [];
  });
  const outputTypeOf = (flowNodeId: string, output: string) => libById.get(placements.find((p) => p.id === flowNodeId)?.nodeId ?? "")?.outputs.find((o) => o.name === output)?.type ?? "";
  const edges: CanvasEdge[] = graphEdges.map((e) => ({
    id: e.id,
    fromNodeId: e.fromFlowNodeId,
    fromOutput: e.fromOutput,
    toNodeId: e.toFlowNodeId,
    toInput: e.toInput,
    selected: selected.edges.has(e.id),
    reason: edgeProblem.get(e.id) ?? null,
    color: outputColor(outputTypeOf(e.fromFlowNodeId, e.fromOutput)),
  }));

  const onSelect = (next: Selection) => setSelected((s) => (sameSet(s.nodes, next.nodes) && sameSet(s.edges, next.edges) ? s : next));

  const onMoveNodes = (moves: { id: string; x: number; y: number }[]) => {
    const to = new Map(moves.map((m) => [m.id, m]));
    setPlacements((ps) => ps.map((p) => (to.has(p.id) ? { ...p, x: to.get(p.id)!.x, y: to.get(p.id)!.y } : p)));
    touch();
  };

  const onDelete = (what: Selection) => {
    if (what.nodes.size > 0) {
      setPlacements((ps) => ps.filter((p) => !what.nodes.has(p.id)));
      setGraphEdges((es) => es.filter((e) => !what.nodes.has(e.fromFlowNodeId) && !what.nodes.has(e.toFlowNodeId) && !what.edges.has(e.id)));
    } else {
      setGraphEdges((es) => es.filter((e) => !what.edges.has(e.id)));
    }
    setSelected({ nodes: new Set(), edges: new Set() });
    touch();
  };

  const onConnect = (c: CanvasConnection) => {
    // A mismatched edge is still drawn, in an error state, and counts as a problem (FLW-4).
    setGraphEdges((es) => [...es, { id: newId(), fromFlowNodeId: c.source, fromOutput: c.sourceHandle, toFlowNodeId: c.target, toInput: c.targetHandle }]);
    touch();
  };

  const onConnectStart = (from: { nodeId: string; type: HandleType; name: string }) => {
    if (from.type !== "source") return;
    const output = libById.get(placements.find((p) => p.id === from.nodeId)?.nodeId ?? "")?.outputs.find((o) => o.name === from.name);
    if (output) setDragFrom({ nodeId: from.nodeId, type: output.type });
  };

  const add = (lib: LibraryNode, at: { x: number; y: number }) => {
    setPlacements((ps) => [...ps, { id: newId(), nodeId: lib.id, label: null, extraInstructions: "", enabledOptionalOutputs: [], x: at.x, y: at.y }]);
    touch();
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const lib = libById.get(event.dataTransfer.getData("application/clauderon-node"));
    if (lib && !readOnly && canvas.current) add(lib, canvas.current.screenToWorld(event.clientX, event.clientY));
  };

  const focus = (problem: Problem) => {
    const placement = placements.find((p) => p.id === (problem.flowNodeId ?? graphEdges.find((e) => e.id === problem.edgeId)?.toFlowNodeId));
    setSelected({ nodes: new Set(problem.flowNodeId ? [problem.flowNodeId] : []), edges: new Set(problem.edgeId ? [problem.edgeId] : []) });
    if (placement) canvas.current?.centerOn(placement.x + 100, placement.y + 40, { zoom: 1, duration: 300 });
  };

  const save = async () => {
    setPending(true);
    const result = await saveFlowAction(data.flow.id, { name, nodes: placements, edges: graphEdges });
    setPending(false);
    if (result.ok) {
      setDirty(false);
      setMessage({ kind: "ok", text: result.problems === 0 ? "Saved." : `Saved with ${result.problems} problem${result.problems === 1 ? "" : "s"}. It cannot be picked in the Start dialog until they are fixed.` });
    } else {
      setMessage({ kind: "error", text: result.error });
    }
  };

  const selectedPlacement = placements.find((p) => selected.nodes.has(p.id)) ?? null;
  const selectedLib = selectedPlacement ? libById.get(selectedPlacement.nodeId) : undefined;
  const usedOutputs = useMemo(
    () => new Set(graphEdges.filter((e) => e.fromFlowNodeId === selectedPlacement?.id).map((e) => e.fromOutput)),
    [graphEdges, selectedPlacement],
  );
  const patch = (id: string, change: PlacementPatch) => {
    setPlacements((ps) => ps.map((p) => (p.id === id ? { ...p, ...change } : p)));
    touch();
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, LibraryNode[]>();
    for (const n of library) groups.set(n.kind, [...(groups.get(n.kind) ?? []), n]);
    return [...groups.entries()];
  }, [library]);

  return (
    <div className="stack flow-fill" style={{ gap: 12 }}>
      <div className="row between" style={{ gap: 12, flexWrap: "wrap" }}>
        <input
          className="input"
          aria-label="Flow name"
          value={name}
          readOnly={readOnly}
          style={{ maxWidth: 360, fontWeight: 600 }}
          onChange={(e) => {
            setName(e.target.value);
            touch();
          }}
        />
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className={`pill ${problems.length > 0 ? "fail" : "ok"}`} data-testid="problems-badge" onClick={() => setShowProblems((v) => !v)} aria-expanded={showProblems}>
            {problems.length === 0 ? "No problems" : `${problems.length} problem${problems.length === 1 ? "" : "s"}`}
          </button>
          {!readOnly && (
            <button type="button" className="btn primary sm" disabled={pending || !dirty || !name.trim()} onClick={() => void save()}>
              {pending ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`banner ${message.kind === "error" ? "fail" : "info"}`} role={message.kind === "error" ? "alert" : "status"}>
          <div className="grow small">{message.text}</div>
        </div>
      )}

      {showProblems && problems.length > 0 && (
        <ul className="card card-pad stack small" style={{ gap: 6, listStyle: "none" }} data-testid="problems-list">
          {problems.map((p, i) => (
            <li key={i}>
              <button type="button" className="btn ghost sm" onClick={() => focus(p)}>
                {p.message}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flow-editor" style={{ gridTemplateColumns: `${readOnly || !libraryOpen ? "" : "220px "}minmax(0, 1fr)${selectedPlacement && selectedLib && panelOpen ? " 260px" : ""}` }}>
        {!readOnly && libraryOpen && (
          <aside className="card card-pad flow-library" aria-label="Node library">
            <h2 className="small">Node library</h2>
            <p className="faint small">Drag onto the canvas, or press Add.</p>
            {grouped.map(([kind, nodes]) => (
              <div key={kind} className="stack" style={{ gap: 4, marginTop: 10 }}>
                <span className={`faint small lib-kind k-${kind}`} style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {KIND_LABEL[kind] ?? kind}
                </span>
                {nodes.map((n) => (
                  <div
                    key={n.id}
                    className={`lib-item k-${n.kind}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("application/clauderon-node", n.id)}
                  >
                    <span className="grow small">{n.name}</span>
                    <button type="button" className="btn ghost sm" onClick={() => add(n, { x: 40 + placements.length * 24, y: 40 + placements.length * 24 })}>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </aside>
        )}

        <div className="flow-canvas card" data-testid="flow-canvas" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          <DragContext.Provider value={dragValue}>
            <FlowCanvas
              ref={canvas}
              nodes={nodes}
              edges={edges}
              readOnly={readOnly}
              onSelect={onSelect}
              onMoveNodes={onMoveNodes}
              onConnect={onConnect}
              onDelete={onDelete}
              onConnectStart={onConnectStart}
              onConnectEnd={() => setDragFrom(null)}
              // Mismatches are allowed and drawn as errors; only a Node to itself is refused.
              canConnect={(c) => c.source !== c.target}
            />
          </DragContext.Provider>
          {!readOnly && (
            <button type="button" className="btn sm fc-toggle left" aria-pressed={libraryOpen} onClick={() => setLibraryOpen((v) => !v)}>
              {libraryOpen ? "« Hide library" : "» Library"}
            </button>
          )}
          {selectedPlacement && selectedLib && (
            <button type="button" className="btn sm fc-toggle right" aria-pressed={panelOpen} onClick={() => setPanelOpen((v) => !v)}>
              {panelOpen ? "Hide details »" : "« Details"}
            </button>
          )}
        </div>

        {selectedPlacement && selectedLib && panelOpen && (
          <NodePanel
            key={selectedPlacement.id}
            placement={selectedPlacement}
            lib={selectedLib}
            readOnly={readOnly}
            usedOutputs={usedOutputs}
            onChange={(change) => patch(selectedPlacement.id, change)}
          />
        )}
      </div>
    </div>
  );
}
