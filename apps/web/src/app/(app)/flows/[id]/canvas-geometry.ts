// Pure maths for the hand-made Flow canvas: the viewport (pan + zoom), converting
// between screen and canvas ("world") coordinates, fitting a set of Nodes into view,
// and the curve drawn for an edge. No DOM, so it is unit-tested.

export type Viewport = { x: number; y: number; k: number };
export type Rect = { x: number; y: number; w: number; h: number };

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

export const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

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

/** The viewport that shows `bounds` centred with some padding (a fraction of the canvas size). */
export function fitBounds(bounds: Rect | null, size: { w: number; h: number }, padding = 0.12, maxZoom = 1.5): Viewport {
  if (!bounds || size.w <= 0 || size.h <= 0 || bounds.w <= 0 || bounds.h <= 0) return { x: 0, y: 0, k: 1 };
  const k = Math.min(maxZoom, clampZoom(Math.min((size.w * (1 - 2 * padding)) / bounds.w, (size.h * (1 - 2 * padding)) / bounds.h)));
  return { k, x: (size.w - bounds.w * k) / 2 - bounds.x * k, y: (size.h - bounds.h * k) / 2 - bounds.y * k };
}

/** The viewport that puts the canvas point (x, y) in the middle of the canvas element. */
export function centerOn(x: number, y: number, size: { w: number; h: number }, k: number): Viewport {
  return { k, x: size.w / 2 - x * k, y: size.h / 2 - y * k };
}

/** A horizontal S-curve from an Output (right side of a Node) to an input (left side of another). */
export function edgePath(sx: number, sy: number, tx: number, ty: number): string {
  const offset = (distance: number) => (distance >= 0 ? 0.5 * distance : 0.25 * 25 * Math.sqrt(-distance));
  const d = offset(tx - sx);
  return `M${sx},${sy} C${sx + d},${sy} ${tx - d},${ty} ${tx},${ty}`;
}
