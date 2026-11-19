// Pure maths for the hand-made Flow canvas: the viewport (pan + zoom), converting
// between screen and canvas ("world") coordinates, fitting a set of Nodes into view,
// and the path drawn for an edge. No DOM, so it is unit-tested.

export type Viewport = { x: number; y: number; k: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
/** Below this zoom the canvas hides port labels and shows bigger titles. */
export const FAR_ZOOM = 0.6;
/** Nodes snap to this grid while dragged (hold Alt to place freely). */
export const GRID = 8;

export const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));
export const snap = (v: number, grid = GRID) => Math.round(v / grid) * grid;

/** A point in the browser window -> a point on the canvas. `origin` is the canvas element's top-left on screen. */
export function screenToWorld(vp: Viewport, origin: { left: number; top: number }, clientX: number, clientY: number) {
  return { x: (clientX - origin.left - vp.x) / vp.k, y: (clientY - origin.top - vp.y) / vp.k };
}

/** Zoom by `factor` keeping the point (px, py), relative to the canvas element, fixed on screen. */
export function zoomAt(vp: Viewport, px: number, py: number, factor: number): Viewport {
  const k = clampZoom(vp.k * factor);
  const ratio = k / vp.k;
  return { k, x: px - (px - vp.x) * ratio, y: py - (py - vp.y) * ratio };
}

export function boundsOf(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const x1 = Math.min(...rects.map((r) => r.x));
  const y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** The rectangle spanned by two corner points, in any order. */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** The viewport that shows `bounds` centred with some padding (a fraction of the canvas size). */
export function fitBounds(bounds: Rect | null, size: { w: number; h: number }, padding = 0.12, maxZoom = 1.25): Viewport {
  if (!bounds || size.w <= 0 || size.h <= 0 || bounds.w <= 0 || bounds.h <= 0) return { x: 0, y: 0, k: 1 };
  const k = Math.min(maxZoom, clampZoom(Math.min((size.w * (1 - 2 * padding)) / bounds.w, (size.h * (1 - 2 * padding)) / bounds.h)));
  return { k, x: (size.w - bounds.w * k) / 2 - bounds.x * k, y: (size.h - bounds.h * k) / 2 - bounds.y * k };
}

/** The viewport that puts the canvas point (x, y) in the middle of the canvas element. */
export function centerOn(x: number, y: number, size: { w: number; h: number }, k: number): Viewport {
  return { k, x: size.w / 2 - x * k, y: size.h / 2 - y * k };
}

/** How far an edge runs straight out of an Output (and into an input) before it turns. */
const STUB = 20;

/**
 * The corners of an orthogonal ("smooth step") edge from an Output on the right side
 * of a Node to an input on the left side of another. Forward edges turn once halfway;
 * an edge that has to go back to the left loops around between the two Nodes.
 */
export function stepPoints(sx: number, sy: number, tx: number, ty: number): Point[] {
  let points: Point[];
  if (tx >= sx + 2 * STUB) {
    const mx = (sx + tx) / 2;
    points = [
      { x: sx, y: sy },
      { x: mx, y: sy },
      { x: mx, y: ty },
      { x: tx, y: ty },
    ];
  } else {
    const my = Math.abs(ty - sy) < 2 * STUB ? Math.max(sy, ty) + 3 * STUB : (sy + ty) / 2;
    points = [
      { x: sx, y: sy },
      { x: sx + STUB, y: sy },
      { x: sx + STUB, y: my },
      { x: tx - STUB, y: my },
      { x: tx - STUB, y: ty },
      { x: tx, y: ty },
    ];
  }
  return simplify(points);
}

/** Drops repeated points and points in the middle of a straight run. */
function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue;
    const prev = out[out.length - 2];
    if (prev && last && ((Math.abs(prev.x - last.x) < 0.01 && Math.abs(last.x - p.x) < 0.01) || (Math.abs(prev.y - last.y) < 0.01 && Math.abs(last.y - p.y) < 0.01))) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

/** An SVG path through `points` with each corner rounded by up to `radius`. */
export function roundedPath(points: readonly Point[], radius = 8): string {
  if (points.length === 0) return "";
  const f = (n: number) => Math.round(n * 100) / 100;
  let d = `M${f(points[0]!.x)},${f(points[0]!.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const r = Math.min(radius, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
    const inDir = unit(a, b);
    const outDir = unit(b, c);
    d += ` L${f(b.x - inDir.x * r)},${f(b.y - inDir.y * r)} Q${f(b.x)},${f(b.y)} ${f(b.x + outDir.x * r)},${f(b.y + outDir.y * r)}`;
  }
  const last = points[points.length - 1]!;
  return `${d} L${f(last.x)},${f(last.y)}`;
}

function unit(a: Point, b: Point): Point {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

/** The point halfway along a polyline, where an edge's buttons sit. */
export function midpoint(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y));
  let left = lengths.reduce((s, l) => s + l, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i]!;
    if (left <= l) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const t = l === 0 ? 0 : left / l;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    left -= l;
  }
  return points[points.length - 1]!;
}

/** The path of an edge from an Output (right side of a Node) to an input (left side of another). */
export function edgePath(sx: number, sy: number, tx: number, ty: number, radius = 8): string {
  return roundedPath(stepPoints(sx, sy, tx, ty), radius);
}
