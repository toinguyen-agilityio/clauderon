import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, boundsOf, centerOn, edgePath, fitBounds, screenToWorld, zoomAt } from "../src/app/(app)/flows/[id]/canvas-geometry";

describe("flow canvas geometry", () => {
  it("maps a screen point to the canvas and back through the viewport", () => {
    const vp = { x: 100, y: 50, k: 2 };
    const world = screenToWorld(vp, { left: 10, top: 20 }, 310, 220);
    expect(world).toEqual({ x: 100, y: 75 });
    // the screen position of that world point: origin + offset + world * k
    expect({ x: 10 + vp.x + world.x * vp.k, y: 20 + vp.y + world.y * vp.k }).toEqual({ x: 310, y: 220 });
  });

  it("zooms around a point and keeps that point fixed on screen", () => {
    const vp = { x: 30, y: -10, k: 1 };
    const next = zoomAt(vp, 200, 120, 2);
    expect(next.k).toBe(2);
    const before = { x: (200 - vp.x) / vp.k, y: (120 - vp.y) / vp.k };
    const after = { x: (200 - next.x) / next.k, y: (120 - next.y) / next.k };
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("clamps zoom to the allowed range", () => {
    expect(zoomAt({ x: 0, y: 0, k: 1 }, 0, 0, 100).k).toBe(MAX_ZOOM);
    expect(zoomAt({ x: 0, y: 0, k: 1 }, 0, 0, 0.0001).k).toBe(MIN_ZOOM);
  });

  it("fits the bounds of all Nodes inside the canvas, centred", () => {
    const bounds = boundsOf([
      { x: 0, y: 0, w: 200, h: 100 },
      { x: 400, y: 300, w: 200, h: 100 },
    ]);
    expect(bounds).toEqual({ x: 0, y: 0, w: 600, h: 400 });
    const vp = fitBounds(bounds, { w: 1200, h: 800 }, 0.1, 5);
    // content fits within the padded canvas and is centred on both axes
    expect(600 * vp.k).toBeLessThanOrEqual(1200 * 0.8 + 1e-9);
    expect(400 * vp.k).toBeLessThanOrEqual(800 * 0.8 + 1e-9);
    expect(vp.x + (600 * vp.k) / 2).toBeCloseTo(600);
    expect(vp.y + (400 * vp.k) / 2).toBeCloseTo(400);
  });

  it("returns the default viewport when there is nothing to fit", () => {
    expect(boundsOf([])).toBeNull();
    expect(fitBounds(null, { w: 800, h: 600 })).toEqual({ x: 0, y: 0, k: 1 });
  });

  it("centres a canvas point in the middle of the canvas element", () => {
    const vp = centerOn(100, 50, { w: 800, h: 400 }, 1);
    expect({ x: 100 * vp.k + vp.x, y: 50 * vp.k + vp.y }).toEqual({ x: 400, y: 200 });
  });

  it("draws an edge from the source handle to the target handle", () => {
    expect(edgePath(0, 0, 100, 40)).toBe("M0,0 C50,0 50,40 100,40");
    // a target left of its source still bends smoothly rather than looping through the origin
    expect(edgePath(200, 0, 0, 40)).toMatch(/^M200,0 C\d/);
  });
});
