"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { MAX_ZOOM, MIN_ZOOM, boundsOf, centerOn, clampZoom, edgePath, fitBounds, screenToWorld, zoomAt, type Rect, type Viewport } from "./canvas-geometry";

// A hand-made canvas for the Flow editor (no diagram library): pan and zoom, drag
// Nodes, draw edges between handles, select, delete. It owns only the view (the
// viewport, the drag in progress, the measured handle positions); the Flow itself
// stays in the editor, which passes it in and gets changes back through callbacks.

export type HandleType = "source" | "target";
export type CanvasNode = { id: string; x: number; y: number; selected: boolean; content: ReactNode };
export type CanvasEdge = { id: string; fromNodeId: string; fromOutput: string; toNodeId: string; toInput: string; selected: boolean; reason: string | null };
export type Selection = { nodes: ReadonlySet<string>; edges: ReadonlySet<string> };
export type CanvasConnection = { source: string; sourceHandle: string; target: string; targetHandle: string };
export type FlowCanvasHandle = {
  screenToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  centerOn: (x: number, y: number, options?: { zoom?: number; duration?: number }) => void;
};

type Props = {
  nodes: readonly CanvasNode[];
  edges: readonly CanvasEdge[];
  readOnly: boolean;
  onSelect: (selection: Selection) => void;
  onMoveNodes: (moves: { id: string; x: number; y: number }[]) => void;
  onConnect: (connection: CanvasConnection) => void;
  onDelete: (selection: Selection) => void;
  canConnect: (connection: CanvasConnection) => boolean;
  onConnectStart?: (from: { nodeId: string; type: HandleType; name: string }) => void;
  onConnectEnd?: () => void;
  ref?: Ref<FlowCanvasHandle>;
};

type HandlePoint = { x: number; y: number };
type Measured = { w: number; h: number; handles: Map<string, HandlePoint> };

const handleKey = (nodeId: string, type: HandleType, name: string) => `${nodeId}\u0000${type}\u0000${name}`;
const EMPTY: Selection = { nodes: new Set(), edges: new Set() };

/** What `<CanvasHandle>` needs from the canvas it sits in. */
const HandleContext = createContext<(nodeId: string, type: HandleType, name: string, event: ReactPointerEvent<HTMLElement>) => void>(() => {});

/** A connection point on a Node. The canvas measures where it is to draw edges to it. */
export function CanvasHandle({ nodeId, type, name, lit }: { nodeId: string; type: HandleType; name: string; lit?: boolean }) {
  const start = useContext(HandleContext);
  return (
    <span
      className={`fhandle ${type} ${lit ? "lit" : ""}`}
      data-node-id={nodeId}
      data-handle-type={type}
      data-handle-name={name}
      onPointerDown={(event) => start(nodeId, type, name, event)}
    />
  );
}

function offsetWithin(el: HTMLElement, root: HTMLElement): HandlePoint | null {
  let x = 0;
  let y = 0;
  let cur: HTMLElement | null = el;
  while (cur && cur !== root) {
    x += cur.offsetLeft;
    y += cur.offsetTop;
    cur = cur.offsetParent as HTMLElement | null;
  }
  return cur === root ? { x, y } : null;
}

function measureNode(el: HTMLElement): Measured {
  const handles = new Map<string, HandlePoint>();
  for (const h of el.querySelectorAll<HTMLElement>(".fhandle")) {
    const at = offsetWithin(h, el);
    if (at) handles.set(handleKey(h.dataset.nodeId ?? "", h.dataset.handleType as HandleType, h.dataset.handleName ?? ""), { x: at.x + h.offsetWidth / 2, y: at.y + h.offsetHeight / 2 });
  }
  return { w: el.offsetWidth, h: el.offsetHeight, handles };
}

function sameMeasure(a: Measured | undefined, b: Measured) {
  if (!a || a.w !== b.w || a.h !== b.h || a.handles.size !== b.handles.size) return false;
  for (const [key, p] of b.handles) {
    const q = a.handles.get(key);
    if (!q || q.x !== p.x || q.y !== p.y) return false;
  }
  return true;
}

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function FlowCanvas(props: Props) {
  const { nodes, edges, readOnly, ref } = props;
  const uid = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef(new Map<string, HTMLElement>());
  const propsRef = useRef(props);
  propsRef.current = props;

  const [vp, setVp] = useState<Viewport>({ x: 0, y: 0, k: 1 });
  const vpRef = useRef(vp);
  vpRef.current = vp;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const [measured, setMeasured] = useState<ReadonlyMap<string, Measured>>(new Map());
  const measuredRef = useRef(measured);
  measuredRef.current = measured;
  const [connecting, setConnecting] = useState<{ from: { nodeId: string; type: HandleType; name: string }; x: number; y: number } | null>(null);
  const connectCleanup = useRef<(() => void) | null>(null);
  const animation = useRef(0);
  const fitted = useRef(false);

  // --- measuring: where every handle is inside its Node, and how big each Node is ---
  const measureAll = useCallback(() => {
    const next = new Map<string, Measured>();
    let changed = nodeEls.current.size !== measuredRef.current.size;
    for (const [id, el] of nodeEls.current) {
      const m = measureNode(el);
      next.set(id, m);
      if (!sameMeasure(measuredRef.current.get(id), m)) changed = true;
    }
    if (changed) setMeasured(next);
  }, []);

  // After every render: a changed label or a new Node can move handles.
  useLayoutEffect(() => {
    measureAll();
  });

  useEffect(() => {
    const observer = new ResizeObserver(() => measureAll());
    for (const el of nodeEls.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [nodes.length, measureAll]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    observer.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  const nodeRects = useCallback((): Rect[] => {
    const rects: Rect[] = [];
    for (const n of propsRef.current.nodes) {
      const m = measuredRef.current.get(n.id);
      if (m) rects.push({ x: n.x, y: n.y, w: m.w, h: m.h });
    }
    return rects;
  }, []);

  // Fit the Flow into view once, when the Nodes have been measured.
  useEffect(() => {
    if (fitted.current || size.w === 0) return;
    if (nodes.length > 0 && measured.size < nodes.length) return;
    fitted.current = true;
    setVp(fitBounds(boundsOf(nodeRects()), size));
  }, [size, measured, nodes.length, nodeRects]);

  const stopAnimation = () => cancelAnimationFrame(animation.current);
  const animateTo = useCallback((target: Viewport, duration: number) => {
    cancelAnimationFrame(animation.current);
    if (duration <= 0) return setVp(target);
    const from = vpRef.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const e = 1 - (1 - t) ** 3;
      setVp({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k: from.k + (target.k - from.k) * e });
      if (t < 1) animation.current = requestAnimationFrame(step);
    };
    animation.current = requestAnimationFrame(step);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      screenToWorld: (clientX, clientY) => screenToWorld(vpRef.current, rootRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }, clientX, clientY),
      centerOn: (x, y, options) => animateTo(centerOn(x, y, sizeRef.current, clampZoom(options?.zoom ?? vpRef.current.k)), options?.duration ?? 0),
    }),
    [animateTo],
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(animation.current);
      connectCleanup.current?.();
    },
    [],
  );

  // --- zoom with the wheel (a non-passive listener, so the page does not scroll) ---
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      cancelAnimationFrame(animation.current);
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015));
      setVp((v) => zoomAt(v, event.clientX - rect.left, event.clientY - rect.top, factor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // --- Backspace / Delete removes the selection ---
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.key !== "Backspace" && event.key !== "Delete") || isTyping(event.target)) return;
      const { nodes: ns, edges: es, readOnly: ro, onDelete } = propsRef.current;
      if (ro) return;
      const selection = { nodes: new Set(ns.filter((n) => n.selected).map((n) => n.id)), edges: new Set(es.filter((e) => e.selected).map((e) => e.id)) };
      if (selection.nodes.size === 0 && selection.edges.size === 0) return;
      event.preventDefault();
      onDelete(selection);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selectedIds = () => ({ nodes: new Set(propsRef.current.nodes.filter((n) => n.selected).map((n) => n.id)), edges: new Set(propsRef.current.edges.filter((e) => e.selected).map((e) => e.id)) });

  // --- panning, and clearing the selection by clicking the background ---
  const pan = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const onBackgroundDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    stopAnimation();
    pan.current = { x: event.clientX, y: event.clientY, vx: vpRef.current.x, vy: vpRef.current.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onBackgroundMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < 3) return;
    p.moved = true;
    setVp((v) => ({ ...v, x: p.vx + dx, y: p.vy + dy }));
  };
  const onBackgroundUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    pan.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const sel = selectedIds();
    if (p && !p.moved && (sel.nodes.size > 0 || sel.edges.size > 0)) props.onSelect(EMPTY);
  };

  // --- dragging Nodes (all selected Nodes move together) ---
  const drag = useRef<{ px: number; py: number; start: Map<string, { x: number; y: number }>; moved: boolean } | null>(null);
  const onNodeDown = (event: ReactPointerEvent<HTMLDivElement>, node: CanvasNode) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest(".fhandle")) return;
    event.stopPropagation();
    stopAnimation();
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    const current = selectedIds();
    let picked: Set<string>;
    if (additive) {
      picked = new Set(current.nodes);
      if (picked.has(node.id)) picked.delete(node.id);
      else picked.add(node.id);
      props.onSelect({ nodes: picked, edges: current.edges });
    } else if (node.selected) {
      picked = current.nodes;
    } else {
      picked = new Set([node.id]);
      props.onSelect({ nodes: picked, edges: new Set() });
    }
    if (readOnly || !picked.has(node.id)) return;
    const start = new Map<string, { x: number; y: number }>();
    for (const n of nodes) if (picked.has(n.id)) start.set(n.id, { x: n.x, y: n.y });
    drag.current = { px: event.clientX, py: event.clientY, start, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onNodeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (event.clientX - d.px) / vpRef.current.k;
    const dy = (event.clientY - d.py) / vpRef.current.k;
    if (!d.moved && Math.hypot(dx, dy) * vpRef.current.k < 3) return;
    d.moved = true;
    props.onMoveNodes([...d.start].map(([id, at]) => ({ id, x: at.x + dx, y: at.y + dy })));
  };
  const onNodeUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  // --- drawing an edge: press a handle, drag, release over a handle of the other kind ---
  const startConnect = useCallback(
    (nodeId: string, type: HandleType, name: string, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || propsRef.current.readOnly) return;
      event.stopPropagation();
      event.preventDefault();
      connectCleanup.current?.();
      const from = { nodeId, type, name };
      const toWorld = (e: PointerEvent) => screenToWorld(vpRef.current, rootRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }, e.clientX, e.clientY);
      setConnecting({ from, ...toWorld(event.nativeEvent) });
      propsRef.current.onConnectStart?.(from);
      const move = (e: PointerEvent) => setConnecting({ from, ...toWorld(e) });
      const finish = (e: PointerEvent | null) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        connectCleanup.current = null;
        setConnecting(null);
        const over = e ? document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(".fhandle") : null;
        if (over && over.dataset.handleType !== type && over.dataset.nodeId) {
          const other = { nodeId: over.dataset.nodeId, name: over.dataset.handleName ?? "" };
          const connection: CanvasConnection =
            type === "source"
              ? { source: nodeId, sourceHandle: name, target: other.nodeId, targetHandle: other.name }
              : { source: other.nodeId, sourceHandle: other.name, target: nodeId, targetHandle: name };
          if (propsRef.current.canConnect(connection)) propsRef.current.onConnect(connection);
        }
        propsRef.current.onConnectEnd?.();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
      connectCleanup.current = () => finish(null);
    },
    [],
  );

  const onEdgeDown = (event: ReactPointerEvent<SVGPathElement>, edge: CanvasEdge) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const current = selectedIds();
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      const picked = new Set(current.edges);
      if (picked.has(edge.id)) picked.delete(edge.id);
      else picked.add(edge.id);
      props.onSelect({ nodes: current.nodes, edges: picked });
    } else if (!edge.selected || current.nodes.size > 0) {
      props.onSelect({ nodes: new Set(), edges: new Set([edge.id]) });
    }
  };

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const handleAt = (nodeId: string, type: HandleType, name: string): HandlePoint | null => {
    const node = nodeById.get(nodeId);
    const p = measured.get(nodeId)?.handles.get(handleKey(nodeId, type, name));
    return node && p ? { x: node.x + p.x, y: node.y + p.y } : null;
  };

  const zoomBy = (factor: number) => {
    stopAnimation();
    setVp((v) => zoomAt(v, size.w / 2, size.h / 2, factor));
  };
  const fit = () => animateTo(fitBounds(boundsOf(nodeRects()), size), 200);

  const grid = 24 * vp.k;
  const temp = connecting && handleAt(connecting.from.nodeId, connecting.from.type, connecting.from.name);

  return (
    <HandleContext.Provider value={startConnect}>
      <div
        ref={rootRef}
        className="fc"
        data-testid="flow-canvas-surface"
        style={{ backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${vp.x}px ${vp.y}px` }}
        onPointerDown={onBackgroundDown}
        onPointerMove={onBackgroundMove}
        onPointerUp={onBackgroundUp}
        onPointerCancel={onBackgroundUp}
      >
        <div className="fc-world" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.k})` }}>
          <svg className="fc-edges" width="1" height="1" aria-hidden="true">
            <defs>
              {(["", "sel", "err"] as const).map((kind) => (
                <marker key={kind} id={`${uid}-arrow-${kind || "base"}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" className={`fc-arrow ${kind}`} />
                </marker>
              ))}
            </defs>
            {edges.map((edge) => {
              const a = handleAt(edge.fromNodeId, "source", edge.fromOutput);
              const b = handleAt(edge.toNodeId, "target", edge.toInput);
              if (!a || !b) return null;
              const d = edgePath(a.x, a.y, b.x, b.y);
              const kind = edge.reason ? "err" : edge.selected ? "sel" : "";
              return (
                <g key={edge.id} data-testid={edge.reason ? "edge-error" : "edge"} data-edge={edge.id}>
                  {edge.reason && <title>{edge.reason}</title>}
                  <path d={d} className={`fc-edge ${kind}`} markerEnd={`url(#${uid}-arrow-${kind || "base"})`} />
                  <path d={d} className="fc-edge-hit" onPointerDown={(event) => onEdgeDown(event, edge)} />
                </g>
              );
            })}
            {connecting && temp && (
              <path
                d={connecting.from.type === "source" ? edgePath(temp.x, temp.y, connecting.x, connecting.y) : edgePath(connecting.x, connecting.y, temp.x, temp.y)}
                className="fc-edge temp"
              />
            )}
          </svg>
          {nodes.map((node) => (
            <div
              key={node.id}
              ref={(el) => {
                if (el) nodeEls.current.set(node.id, el);
                else nodeEls.current.delete(node.id);
              }}
              className={`fc-node ${node.selected ? "on" : ""}`}
              style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
              onPointerDown={(event) => onNodeDown(event, node)}
              onPointerMove={onNodeMove}
              onPointerUp={onNodeUp}
              onPointerCancel={onNodeUp}
            >
              {node.content}
            </div>
          ))}
        </div>
        <div className="fc-controls" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" aria-label="Zoom in" disabled={vp.k >= MAX_ZOOM} onClick={() => zoomBy(1.25)}>
            +
          </button>
          <button type="button" aria-label="Zoom out" disabled={vp.k <= MIN_ZOOM} onClick={() => zoomBy(0.8)}>
            −
          </button>
          <button type="button" aria-label="Fit view" onClick={fit}>
            ⤢
          </button>
        </div>
      </div>
    </HandleContext.Provider>
  );
}
