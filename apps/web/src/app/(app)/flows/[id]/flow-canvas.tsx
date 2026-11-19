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
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import {
  FAR_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  boundsOf,
  centerOn,
  clampZoom,
  fitBounds,
  intersects,
  midpoint,
  rectFromPoints,
  roundedPath,
  screenToWorld,
  snap,
  stepPoints,
  zoomAt,
  type Rect,
  type Viewport,
} from "./canvas-geometry";
import { FIcon } from "./flow-icons";

// A hand-made canvas for the Flow editor (no diagram library): pan and zoom, drag
// Nodes, draw edges between handles, select (click, Shift-click, Shift-drag a box),
// delete. It owns only the view (the viewport, the gesture in progress, the measured
// handle positions); the Flow itself stays in the editor, which passes it in and
// gets changes back through callbacks.

export type HandleType = "source" | "target";
export type CanvasNode = { id: string; x: number; y: number; selected: boolean; content: ReactNode };
export type EdgeState = "active" | "done" | null;
export type CanvasEdge = {
  id: string;
  color?: string;
  fromNodeId: string;
  fromOutput: string;
  toNodeId: string;
  toInput: string;
  selected: boolean;
  reason: string | null;
  state?: EdgeState;
  /** Ports this edge names that its Nodes do not have: the edge is drawn to the Node's side. */
  missing?: { from?: string; to?: string };
  /** Briefly highlighted, after picking its problem from the list. */
  flash?: boolean;
};
export type Selection = { nodes: ReadonlySet<string>; edges: ReadonlySet<string> };
export type CanvasConnection = { source: string; sourceHandle: string; target: string; targetHandle: string };
export type FlowCanvasHandle = {
  screenToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  /** The canvas point in the middle of the visible area. */
  viewCenter: () => { x: number; y: number };
  centerOn: (x: number, y: number, options?: { zoom?: number; duration?: number }) => void;
  fit: () => void;
  zoomBy: (factor: number) => void;
  /** The measured size of a Node, once it has been drawn. */
  sizeOf: (nodeId: string) => { w: number; h: number } | null;
};

type Props = {
  nodes: readonly CanvasNode[];
  edges: readonly CanvasEdge[];
  readOnly: boolean;
  onSelect: (selection: Selection) => void;
  /** A drag of Nodes begins (once per gesture, before the first move). */
  onMoveStart?: () => void;
  onMoveNodes: (moves: { id: string; x: number; y: number }[]) => void;
  onConnect: (connection: CanvasConnection) => void;
  onDelete: (selection: Selection) => void;
  canConnect: (connection: CanvasConnection) => boolean;
  onConnectStart?: (from: { nodeId: string; type: HandleType; name: string }) => void;
  onConnectEnd?: () => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  /** Extra buttons for the zoom bar (bottom right). */
  zoomBarExtra?: ReactNode;
  /** A card shown at the middle of a selected edge that has a problem: what is wrong and how to fix it. */
  renderEdgeCard?: (edgeId: string) => ReactNode;
  ref?: Ref<FlowCanvasHandle>;
};

type HandlePoint = { x: number; y: number };
type Measured = { w: number; h: number; handles: Map<string, HandlePoint> };
type HandleRef = { nodeId: string; type: HandleType; name: string };

const handleKey = (nodeId: string, type: HandleType, name: string) => `${nodeId}\u0000${type}\u0000${name}`;
const EMPTY: Selection = { nodes: new Set(), edges: new Set() };
/** How close (in screen pixels) a dragged wire must come to a handle to snap onto it. */
const SNAP_RADIUS = 22;
const DOT_GAP = 20;

/** What `<CanvasHandle>` needs from the canvas it sits in. */
const HandleContext = createContext<(nodeId: string, type: HandleType, name: string, event: ReactPointerEvent<HTMLElement>) => void>(() => {});

/**
 * A connection point on a Node. The canvas measures where it is to draw edges to it.
 * `fit` says how it relates to the wire being drawn: it would accept it, or not.
 */
export function CanvasHandle({ nodeId, type, name, fit, color, label }: { nodeId: string; type: HandleType; name: string; fit?: "fit" | "nofit"; color?: string; label?: string }) {
  const start = useContext(HandleContext);
  return (
    <span
      className={`fhandle ${type}`}
      style={color ? ({ "--c": color } as CSSProperties) : undefined}
      role="button"
      tabIndex={-1}
      aria-label={label ?? `${type === "source" ? "Output" : "Input"} ${name}`}
      data-fit={fit}
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

export const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

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
  const [connecting, setConnecting] = useState<{ from: HandleRef; x: number; y: number; over: HandleRef | null } | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [gesture, setGesture] = useState<"pan" | "drag" | null>(null);
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

  const nodeRect = useCallback((n: { id: string; x: number; y: number }): Rect | null => {
    const m = measuredRef.current.get(n.id);
    return m ? { x: n.x, y: n.y, w: m.w, h: m.h } : null;
  }, []);
  const nodeRects = useCallback((): Rect[] => propsRef.current.nodes.flatMap((n) => nodeRect(n) ?? []), [nodeRect]);

  // Fit the Flow into view once, when the Nodes have been measured.
  useEffect(() => {
    if (fitted.current || size.w === 0) return;
    if (nodes.length > 0 && measured.size < nodes.length) return;
    fitted.current = true;
    setVp(fitBounds(boundsOf(nodeRects()), size));
  }, [size, measured, nodes.length, nodeRects]);

  // Where the running animation ends, so quick repeated zooms add up instead of cancelling.
  const animTarget = useRef<Viewport | null>(null);
  const stopAnimation = () => {
    cancelAnimationFrame(animation.current);
    animTarget.current = null;
  };
  const animateTo = useCallback((target: Viewport, duration: number) => {
    cancelAnimationFrame(animation.current);
    animTarget.current = null;
    if (duration <= 0 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return setVp(target);
    animTarget.current = target;
    const from = vpRef.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const e = 1 - (1 - t) ** 3;
      setVp({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k: from.k + (target.k - from.k) * e });
      if (t < 1) animation.current = requestAnimationFrame(step);
      else animTarget.current = null;
    };
    animation.current = requestAnimationFrame(step);
  }, []);

  const fit = useCallback(() => animateTo(fitBounds(boundsOf(nodeRects()), sizeRef.current), 260), [animateTo, nodeRects]);
  const zoomBy = useCallback(
    (factor: number) => {
      const v = animTarget.current ?? vpRef.current;
      animateTo(zoomAt(v, sizeRef.current.w / 2, sizeRef.current.h / 2, factor), 160);
    },
    [animateTo],
  );

  useImperativeHandle(
    ref,
    () => ({
      screenToWorld: (clientX, clientY) => screenToWorld(vpRef.current, rootRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }, clientX, clientY),
      viewCenter: () => ({ x: (sizeRef.current.w / 2 - vpRef.current.x) / vpRef.current.k, y: (sizeRef.current.h / 2 - vpRef.current.y) / vpRef.current.k }),
      centerOn: (x, y, options) => animateTo(centerOn(x, y, sizeRef.current, clampZoom(options?.zoom ?? vpRef.current.k)), options?.duration ?? 0),
      fit,
      zoomBy,
      sizeOf: (nodeId) => {
        const m = measuredRef.current.get(nodeId);
        return m ? { w: m.w, h: m.h } : null;
      },
    }),
    [animateTo, fit, zoomBy],
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(animation.current);
      connectCleanup.current?.();
    },
    [],
  );

  // --- the wheel: pinch or Ctrl/⌘ + wheel zooms, a plain wheel or two-finger scroll pans ---
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest(".fc-overlay")) return;
      event.preventDefault();
      cancelAnimationFrame(animation.current);
      animTarget.current = null;
      if (event.ctrlKey || event.metaKey) {
        const rect = el.getBoundingClientRect();
        const factor = Math.exp(-event.deltaY * (event.ctrlKey && !event.metaKey ? 0.01 : 0.002));
        setVp((v) => zoomAt(v, event.clientX - rect.left, event.clientY - rect.top, factor));
      } else {
        const scale = event.deltaMode === 1 ? 16 : 1;
        const dx = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
        const dy = event.shiftKey && event.deltaX === 0 ? 0 : event.deltaY;
        setVp((v) => ({ ...v, x: v.x - dx * scale, y: v.y - dy * scale }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const selectedIds = () => ({ nodes: new Set(propsRef.current.nodes.filter((n) => n.selected).map((n) => n.id)), edges: new Set(propsRef.current.edges.filter((e) => e.selected).map((e) => e.id)) });

  // --- Backspace / Delete removes the selection ---
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.key !== "Backspace" && event.key !== "Delete") || isTyping(event.target)) return;
      if (propsRef.current.readOnly) return;
      const selection = selectedIds();
      if (selection.nodes.size === 0 && selection.edges.size === 0) return;
      event.preventDefault();
      propsRef.current.onDelete(selection);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- background: drag pans, Shift-drag draws a selection box, two fingers pinch-zoom, a click clears ---
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; k: number; cx: number; cy: number; vx: number; vy: number } | null>(null);
  const pan = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; box: { x: number; y: number } | null; additive: boolean } | null>(null);

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return;
    const rect = rootRef.current!.getBoundingClientRect();
    pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: vpRef.current.k, cx: (a.x + b.x) / 2 - rect.left, cy: (a.y + b.y) / 2 - rect.top, vx: vpRef.current.x, vy: vpRef.current.y };
    pan.current = null;
    setMarquee(null);
  };

  const onBackgroundDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    if ((event.target as HTMLElement).closest(".fc-overlay")) return;
    stopAnimation();
    rootRef.current?.focus({ preventScroll: true });
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.current.size === 2) return startPinch();
    const box = event.shiftKey && event.button === 0 ? screenToWorld(vpRef.current, event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY) : null;
    pan.current = { x: event.clientX, y: event.clientY, vx: vpRef.current.x, vy: vpRef.current.y, moved: false, box, additive: event.metaKey || event.ctrlKey };
  };
  const onBackgroundMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pz = pinch.current;
    if (pz && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const rect = event.currentTarget.getBoundingClientRect();
      const cx = (a!.x + b!.x) / 2 - rect.left;
      const cy = (a!.y + b!.y) / 2 - rect.top;
      const k = clampZoom((pz.k * Math.hypot(a!.x - b!.x, a!.y - b!.y)) / pz.dist);
      // keep the world point that was under the fingers' centre under it, and follow the centre
      const wx = (pz.cx - pz.vx) / pz.k;
      const wy = (pz.cy - pz.vy) / pz.k;
      setVp({ k, x: cx - wx * k, y: cy - wy * k });
      return;
    }
    const p = pan.current;
    if (!p) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < 3) return;
    if (!p.moved) setGesture(p.box ? null : "pan");
    p.moved = true;
    if (p.box) {
      setMarquee(rectFromPoints(p.box, screenToWorld(vpRef.current, event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY)));
    } else {
      setVp((v) => ({ ...v, x: p.vx + dx, y: p.vy + dy }));
    }
  };
  const onBackgroundUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      return;
    }
    const p = pan.current;
    pan.current = null;
    setGesture(null);
    if (!p) return;
    if (p.box && marquee) {
      const hit = propsRef.current.nodes.filter((n) => {
        const r = nodeRect(n);
        return r && intersects(r, marquee);
      });
      const current = selectedIds();
      const picked = new Set(p.additive ? current.nodes : []);
      for (const n of hit) picked.add(n.id);
      propsRef.current.onSelect({ nodes: picked, edges: p.additive ? current.edges : new Set() });
      setMarquee(null);
      return;
    }
    setMarquee(null);
    const sel = selectedIds();
    if (!p.moved && (sel.nodes.size > 0 || sel.edges.size > 0)) propsRef.current.onSelect(EMPTY);
  };

  // --- dragging Nodes (all selected Nodes move together, snapped to the grid unless Alt is held) ---
  const drag = useRef<{ px: number; py: number; start: Map<string, { x: number; y: number }>; moved: boolean } | null>(null);
  const onNodeDown = (event: ReactPointerEvent<HTMLDivElement>, node: CanvasNode) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".fhandle, .fc-nodrag, input, textarea, button, a")) {
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    stopAnimation();
    rootRef.current?.focus({ preventScroll: true });
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
    if (!d.moved) {
      propsRef.current.onMoveStart?.();
      setGesture("drag");
    }
    d.moved = true;
    const free = event.altKey;
    props.onMoveNodes([...d.start].map(([id, at]) => ({ id, x: free ? at.x + dx : snap(at.x + dx), y: free ? at.y + dy : snap(at.y + dy) })));
  };
  const onNodeUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    setGesture(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const handleAt = (nodeId: string, type: HandleType, name: string): HandlePoint | null => {
    const node = nodeById.get(nodeId);
    const p = measured.get(nodeId)?.handles.get(handleKey(nodeId, type, name));
    return node && p ? { x: node.x + p.x, y: node.y + p.y } : null;
  };
  /** Where an edge ends: its handle, or, for a port the Node does not have, the middle of the Node's side. */
  const endAt = (nodeId: string, type: HandleType, name: string): HandlePoint | null => {
    const at = handleAt(nodeId, type, name);
    if (at) return at;
    const node = nodeById.get(nodeId);
    const m = measured.get(nodeId);
    return node && m ? { x: node.x + (type === "source" ? m.w : 0), y: node.y + m.h / 2 } : null;
  };
  const edgeEnds = (edge: CanvasEdge) => {
    const a = endAt(edge.fromNodeId, "source", edge.fromOutput);
    const b = endAt(edge.toNodeId, "target", edge.toInput);
    return a && b ? { a, b, pts: stepPoints(a.x, a.y, b.x, b.y) } : null;
  };

  // --- drawing an edge: press a handle, drag, release over (or near) a handle of the other kind ---
  const nearestHandle = useCallback((from: HandleRef, x: number, y: number): HandleRef | null => {
    const want: HandleType = from.type === "source" ? "target" : "source";
    const radius = SNAP_RADIUS / vpRef.current.k;
    let best: { ref: HandleRef; d: number; fit: boolean } | null = null;
    for (const n of propsRef.current.nodes) {
      if (n.id === from.nodeId) continue;
      const m = measuredRef.current.get(n.id);
      if (!m) continue;
      for (const [key, p] of m.handles) {
        const [, type, name] = key.split("\u0000") as [string, HandleType, string];
        if (type !== want) continue;
        const d = Math.hypot(n.x + p.x - x, n.y + p.y - y);
        if (d > radius) continue;
        const el = nodeEls.current.get(n.id)?.querySelector<HTMLElement>(`.fhandle[data-handle-type="${type}"][data-handle-name="${CSS.escape(name)}"]`);
        const isFit = el?.dataset.fit === "fit";
        if (!best || (isFit && !best.fit) || (isFit === best.fit && d < best.d)) best = { ref: { nodeId: n.id, type, name }, d, fit: isFit };
      }
    }
    return best?.ref ?? null;
  }, []);

  const startConnect = useCallback(
    (nodeId: string, type: HandleType, name: string, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || propsRef.current.readOnly) return;
      event.stopPropagation();
      event.preventDefault();
      connectCleanup.current?.();
      const from = { nodeId, type, name };
      const toWorld = (e: PointerEvent) => screenToWorld(vpRef.current, rootRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }, e.clientX, e.clientY);
      const at = toWorld(event.nativeEvent);
      setConnecting({ from, ...at, over: null });
      propsRef.current.onConnectStart?.(from);
      let over: HandleRef | null = null;
      const move = (e: PointerEvent) => {
        const p = toWorld(e);
        over = nearestHandle(from, p.x, p.y);
        setConnecting({ from, ...p, over });
      };
      const finish = (e: PointerEvent | null) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        connectCleanup.current = null;
        setConnecting(null);
        if (e && e.type === "pointerup" && over) {
          const connection: CanvasConnection =
            type === "source" ? { source: nodeId, sourceHandle: name, target: over.nodeId, targetHandle: over.name } : { source: over.nodeId, sourceHandle: over.name, target: nodeId, targetHandle: name };
          if (propsRef.current.canConnect(connection)) propsRef.current.onConnect(connection);
        }
        propsRef.current.onConnectEnd?.();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
      connectCleanup.current = () => finish(null);
    },
    [nearestHandle],
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
    } else if (!edge.selected || current.nodes.size > 0 || current.edges.size > 1) {
      props.onSelect({ nodes: new Set(), edges: new Set([edge.id]) });
    }
  };

  // The end of the wire being drawn: on the handle it would connect to, or under the pointer.
  const wire = (() => {
    if (!connecting) return null;
    const a = handleAt(connecting.from.nodeId, connecting.from.type, connecting.from.name);
    if (!a) return null;
    const b = connecting.over ? handleAt(connecting.over.nodeId, connecting.over.type, connecting.over.name) : null;
    const end = b ?? { x: connecting.x, y: connecting.y };
    const pts = connecting.from.type === "source" ? stepPoints(a.x, a.y, end.x, end.y) : stepPoints(end.x, end.y, a.x, a.y);
    return { d: roundedPath(pts), snapped: b !== null, end };
  })();

  const far = vp.k < FAR_ZOOM;
  const dots = DOT_GAP * vp.k;
  const rootClass = ["fc", far ? "far" : "", connecting ? "wiring" : "", gesture === "pan" ? "panning" : "", gesture === "drag" ? "dragging" : ""].filter(Boolean).join(" ");

  return (
    <HandleContext.Provider value={startConnect}>
      <div
        ref={rootRef}
        className={rootClass}
        tabIndex={0}
        role="application"
        aria-label="Flow canvas. Drag to pan, pinch or Ctrl and scroll to zoom, Shift and drag to select several Nodes."
        data-testid="flow-canvas-surface"
        style={{ backgroundSize: `${dots}px ${dots}px`, backgroundPosition: `${vp.x}px ${vp.y}px` } as CSSProperties}
        onPointerDown={onBackgroundDown}
        onPointerMove={onBackgroundMove}
        onPointerUp={onBackgroundUp}
        onPointerCancel={onBackgroundUp}
      >
        <div className="fc-world" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.k})`, "--k": vp.k } as CSSProperties}>
          <svg className="fc-edges" width="1" height="1" aria-hidden="true">
            <defs>
              {(["base", "sel", "err", "done", "active"] as const).map((kind) => (
                <marker key={kind} id={`${uid}-arrow-${kind}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M1.5,1.5 L8.5,5 L1.5,8.5" className={`fc-arrow ${kind}`} />
                </marker>
              ))}
            </defs>
            {edges.map((edge) => {
              const ends = edgeEnds(edge);
              if (!ends) return null;
              const d = roundedPath(ends.pts);
              const kind = edge.reason ? "err" : edge.selected ? "sel" : edge.state === "active" ? "active" : edge.state === "done" ? "done" : "base";
              return (
                <g key={edge.id} className={`fc-edge-g ${kind} ${edge.flash ? "flash" : ""}`} data-testid={edge.reason ? "edge-error" : "edge"} data-edge={edge.id}>
                  {edge.reason && <title>{edge.reason}</title>}
                  <path d={d} className="fc-edge-hit" onPointerDown={(event) => onEdgeDown(event, edge)} />
                  <path d={d} className={`fc-edge ${kind}`} style={edge.color ? ({ "--c": edge.color } as CSSProperties) : undefined} markerEnd={`url(#${uid}-arrow-${kind})`} />
                  {edge.state === "active" && <path d={d} className="fc-edge-flow" />}
                </g>
              );
            })}
            {wire && (
              <>
                <path d={wire.d} className={`fc-edge temp ${wire.snapped ? "snapped" : ""}`} />
                <circle cx={wire.end.x} cy={wire.end.y} r={wire.snapped ? 0 : 3.5} className="fc-wire-end" />
              </>
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
              onDoubleClick={(event) => {
                if ((event.target as HTMLElement).closest(".fhandle, .fc-nodrag, button")) return;
                propsRef.current.onNodeDoubleClick?.(node.id);
              }}
            >
              {node.content}
            </div>
          ))}
          {edges.map((edge) => {
            if (!edge.reason && !(edge.selected && !readOnly)) return null;
            const ends = edgeEnds(edge);
            if (!ends) return null;
            const m = midpoint(ends.pts);
            const card = edge.selected && edge.reason ? props.renderEdgeCard?.(edge.id) : null;
            return (
              <div key={edge.id} className="fc-edge-mid" style={{ left: m.x, top: m.y }}>
                {edge.reason ? (
                  <button
                    type="button"
                    className={`fc-edge-badge ${edge.selected ? "on" : ""}`}
                    aria-label={`Problem: ${edge.reason}`}
                    title={edge.reason}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      propsRef.current.onSelect({ nodes: new Set(), edges: new Set([edge.id]) });
                    }}
                  >
                    !
                  </button>
                ) : (
                  <button
                    type="button"
                    className="fc-edge-del"
                    aria-label="Remove this edge"
                    title="Remove this edge (Delete)"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => propsRef.current.onDelete({ nodes: new Set(), edges: new Set([edge.id]) })}
                  >
                    {FIcon.close}
                  </button>
                )}
                {card && (
                  <div className="fc-edge-card" onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
                    {card}
                  </div>
                )}
              </div>
            );
          })}
          {edges.map((edge) => {
            if (!edge.missing?.from && !edge.missing?.to) return null;
            const ends = edgeEnds(edge);
            if (!ends) return null;
            return (
              <div key={`ghost-${edge.id}`}>
                {edge.missing.from && (
                  <span className="fc-ghost-port out" style={{ left: ends.a.x, top: ends.a.y }} title={`This Node has no Output “${edge.missing.from}”`}>
                    {edge.missing.from}?
                  </span>
                )}
                {edge.missing.to && (
                  <span className="fc-ghost-port in" style={{ left: ends.b.x, top: ends.b.y }} title={`This Node has no input “${edge.missing.to}”`}>
                    {edge.missing.to}?
                  </span>
                )}
              </div>
            );
          })}
          {marquee && <div className="fc-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
        </div>

        <div className="fc-overlay fc-zoombar" role="toolbar" aria-label="Zoom" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" className="fc-ibtn" aria-label="Zoom out" title="Zoom out (−)" disabled={vp.k <= MIN_ZOOM + 1e-6} onClick={() => zoomBy(1 / 1.25)}>
            {FIcon.minus}
          </button>
          <button type="button" className="fc-zoom-pct" title="Zoom to 100%" onClick={() => animateTo(zoomAt(vpRef.current, size.w / 2, size.h / 2, 1 / vpRef.current.k), 200)}>
            {Math.round(vp.k * 100)}%
          </button>
          <button type="button" className="fc-ibtn" aria-label="Zoom in" title="Zoom in (+)" disabled={vp.k >= MAX_ZOOM - 1e-6} onClick={() => zoomBy(1.25)}>
            {FIcon.plus}
          </button>
          <span className="fc-sep" />
          <button type="button" className="fc-ibtn" aria-label="Fit view" title="Fit view (F)" onClick={fit}>
            {FIcon.fit}
          </button>
          {props.zoomBarExtra}
        </div>
      </div>
    </HandleContext.Provider>
  );
}
