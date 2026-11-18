"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useRef, useState, createContext, useContext, type DragEvent } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useReactFlow,
  type Connection,
  type EdgeChangeset,
  type EdgeProps,
  type NodeChangeset,
  type NodeProps,
  type OnConnectStartParams,
} from "@xyflow/react";
import { validateFlow, type LibraryNode, type OutputType, type Problem } from "@clauderon/core";
import type { EditorData } from "../../../../server/flows";
import { saveFlowAction } from "./actions";
import { buildEdges, buildNodes, type FlowEdge, type FlowNode, type Placement } from "./graph-cache";
import { NodePanel, type PlacementPatch } from "./node-panel";

// The canvas editor (spec M2 §3, FLW-3 … FLW-5): place Nodes from the library,
// connect Outputs to inputs of the same type, see problems live, save.

const KIND_LABEL: Record<string, string> = { ticket: "Ticket", agent: "Agent", command: "Command", approve: "Approve", grill: "Grill" };

const newId = () => crypto.randomUUID();
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/** The Output being dragged right now, so inputs it can connect to light up (FLW-4). */
const DragContext = createContext<{ from: { nodeId: string; type: OutputType } | null }>({ from: null });

/** The current placement of every Node by id: what a Node shows that is not structural. */
const PlacementsContext = createContext<ReadonlyMap<string, Placement>>(new Map());

function NodeView({ id, data, selected }: NodeProps<FlowNode>) {
  const { lib } = data;
  const placement = useContext(PlacementsContext).get(id);
  const drag = useContext(DragContext);
  if (!placement) return null;
  return (
    <div className={`fnode ${selected ? "on" : ""}`} data-kind={lib.kind} data-testid={`fnode-${lib.name}`}>
      <div className="fnode-h">
        <b>{placement.label || lib.name}</b>
        <span className="tag">{KIND_LABEL[lib.kind] ?? lib.kind}</span>
      </div>
      <div className="fnode-ports">
        <div className="stack" style={{ gap: 4 }}>
          {lib.inputs.map((i) => {
            const lit = drag.from !== null && drag.from.nodeId !== id && drag.from.type === i.type;
            return (
              <div key={i.name} className={`fport in ${lit ? "lit" : ""}`}>
                <Handle type="target" position={Position.Left} id={i.name} className={lit ? "lit" : ""} />
                <span>
                  {i.name}
                  {i.required ? " *" : ""} <span className="faint">{i.type}</span>
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
                  {o.optional ? " (optional)" : ""} <span className="faint">{o.type}</span>
                </span>
                <Handle type="source" position={Position.Right} id={o.name} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** An edge in an error state draws red; its reason shows on hover (FLW-4). */
function EdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, selected }: EdgeProps<FlowEdge>) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const reason = data?.reason ?? null;
  return (
    <g data-testid={reason ? "edge-error" : "edge"} data-edge={id}>
      {reason && <title>{reason}</title>}
      <BaseEdge path={path} markerEnd={markerEnd} style={{ stroke: reason ? "var(--fail)" : selected ? "var(--accent)" : "var(--fg3)", strokeWidth: reason ? 2.5 : 2, strokeDasharray: reason ? "6 4" : undefined }} />
    </g>
  );
}

const nodeTypes = { clauderon: NodeView };
const edgeTypes = { clauderon: EdgeView };

export function FlowEditor({ data }: { data: EditorData }) {
  return (
    <ReactFlowProvider>
      <Canvas data={data} />
    </ReactFlowProvider>
  );
}

function Canvas({ data }: { data: EditorData }) {
  const { library, readOnly } = data;
  const libById = useMemo(() => new Map(library.map((n) => [n.id, n])), [library]);
  const { screenToFlowPosition, setCenter } = useReactFlow();

  const [name, setName] = useState(data.flow.name);
  const [placements, setPlacements] = useState<Placement[]>(data.graph.nodes);
  const [graphEdges, setGraphEdges] = useState(data.graph.edges);
  const [selected, setSelected] = useState<{ nodes: Set<string>; edges: Set<string> }>({ nodes: new Set(), edges: new Set() });
  const [dragFrom, setDragFrom] = useState<{ nodeId: string; type: OutputType } | null>(null);
  const placementsById = useMemo(() => new Map(placements.map((p) => [p.id, p])), [placements]);
  const dragValue = useMemo(() => ({ from: dragFrom }), [dragFrom]);
  const [showProblems, setShowProblems] = useState(false);
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

  // Reuse the previous node/edge objects when nothing structural changed (see graph-cache.ts).
  const nodeCache = useRef(new Map<string, FlowNode>());
  const edgeCache = useRef(new Map<string, FlowEdge>());
  const nodes: FlowNode[] = useMemo(() => {
    nodeCache.current = buildNodes(placements, libById, selected.nodes, nodeCache.current);
    return [...nodeCache.current.values()];
  }, [placements, libById, selected.nodes]);
  const edges: FlowEdge[] = useMemo(() => {
    edgeCache.current = buildEdges(graphEdges, edgeProblem, selected.edges, edgeCache.current);
    return [...edgeCache.current.values()];
  }, [graphEdges, selected.edges, edgeProblem]);

  // Handlers read the latest nodes/edges through refs, so their identity does not
  // change on every edit (a changing handler re-subscribes the whole canvas).
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const onNodesChange = useCallback(
    (changeset: NodeChangeset<FlowNode>) => {
      let changed = false;
      const changes = changeset.toArray();
      const next = changeset.applyTo(nodesRef.current);
      const removed = new Set(changes.filter((c) => c.type === "remove").map((c) => c.id));
      if (removed.size > 0) {
        setPlacements((ps) => ps.filter((p) => !removed.has(p.id)));
        setGraphEdges((es) => es.filter((e) => !removed.has(e.fromFlowNodeId) && !removed.has(e.toFlowNodeId)));
        changed = true;
      }
      const moved = new Map(next.map((n) => [n.id, n.position]));
      if (changes.some((c) => c.type === "position" && c.position)) {
        setPlacements((ps) => ps.map((p) => ({ ...p, x: moved.get(p.id)?.x ?? p.x, y: moved.get(p.id)?.y ?? p.y })));
        changed = true;
      }
      if (changes.some((c) => c.type === "select")) {
        const ids = new Set(next.filter((n) => n.selected).map((n) => n.id));
        setSelected((s) => (sameSet(s.nodes, ids) ? s : { ...s, nodes: ids }));
      }
      if (changed) touch();
    },
    [],
  );

  const onEdgesChange = useCallback(
    (changeset: EdgeChangeset<FlowEdge>) => {
      const changes = changeset.toArray();
      const removed = new Set(changes.filter((c) => c.type === "remove").map((c) => c.id));
      if (removed.size > 0) {
        setGraphEdges((es) => es.filter((e) => !removed.has(e.id)));
        touch();
      }
      if (changes.some((c) => c.type === "select")) {
        const ids = new Set(changeset.applyTo(edgesRef.current).filter((e) => e.selected).map((e) => e.id));
        setSelected((s) => (sameSet(s.edges, ids) ? s : { ...s, edges: ids }));
      }
    },
    [],
  );

  const onConnect = useCallback((c: Connection) => {
    if (!c.sourceHandle || !c.targetHandle) return;
    // A mismatched edge is still drawn, in an error state, and counts as a problem (FLW-4).
    setGraphEdges((es) => [...es, { id: newId(), fromFlowNodeId: c.source, fromOutput: c.sourceHandle!, toFlowNodeId: c.target, toInput: c.targetHandle! }]);
    touch();
  }, []);

  const onConnectStart = useCallback(
    (_: unknown, params: OnConnectStartParams) => {
      if (params.handleType !== "source" || !params.nodeId) return;
      const output = libById.get(placements.find((p) => p.id === params.nodeId)?.nodeId ?? "")?.outputs.find((o) => o.name === params.handleId);
      if (output) setDragFrom({ nodeId: params.nodeId, type: output.type });
    },
    [libById, placements],
  );

  const add = (lib: LibraryNode, at: { x: number; y: number }) => {
    setPlacements((ps) => [...ps, { id: newId(), nodeId: lib.id, label: null, extraInstructions: "", enabledOptionalOutputs: [], x: at.x, y: at.y }]);
    touch();
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const lib = libById.get(event.dataTransfer.getData("application/clauderon-node"));
    if (lib && !readOnly) add(lib, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  const focus = (problem: Problem) => {
    const placement = placements.find((p) => p.id === (problem.flowNodeId ?? graphEdges.find((e) => e.id === problem.edgeId)?.toFlowNodeId));
    setSelected({ nodes: new Set(problem.flowNodeId ? [problem.flowNodeId] : []), edges: new Set(problem.edgeId ? [problem.edgeId] : []) });
    if (placement) setCenter(placement.x + 100, placement.y + 40, { zoom: 1, duration: 300 });
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
    <div className="stack" style={{ gap: 12 }}>
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

      <div className="flow-editor" style={{ gridTemplateColumns: `${readOnly ? "" : "220px "}minmax(0, 1fr)${selectedPlacement && selectedLib ? " 260px" : ""}` }}>
        {!readOnly && (
          <aside className="card card-pad flow-library" aria-label="Node library">
            <h2 className="small">Node library</h2>
            <p className="faint small">Drag onto the canvas, or press Add.</p>
            {grouped.map(([kind, nodes]) => (
              <div key={kind} className="stack" style={{ gap: 4, marginTop: 10 }}>
                <span className="faint small" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {KIND_LABEL[kind] ?? kind}
                </span>
                {nodes.map((n) => (
                  <div
                    key={n.id}
                    className="lib-item"
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
          <PlacementsContext.Provider value={placementsById}>
            <DragContext.Provider value={dragValue}>
              <ReactFlow<FlowNode, FlowEdge>
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={() => setDragFrom(null)}
                // Mismatches are allowed and drawn as errors; only a Node to itself is refused.
                isValidConnection={(c) => c.source !== c.target}
                nodesDraggable={!readOnly}
                nodesConnectable={!readOnly}
                deleteKeyCode={readOnly ? null : "Backspace"}
                fitView
              >
                <Background />
                <Controls showInteractive={false} />
              </ReactFlow>
            </DragContext.Provider>
          </PlacementsContext.Provider>
        </div>

        {selectedPlacement && selectedLib && (
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
