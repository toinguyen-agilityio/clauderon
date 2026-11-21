import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeaveDialog } from "../src/app/(app)/flows/[id]/leave-dialog";
import { LAYOUT_GAP_X, layerOf, layeredLayout, wiresMostlyBackward } from "../src/app/(app)/flows/[id]/flow-layout";
import { describeProblems } from "../src/app/(app)/flows/[id]/problem-hints";
import { hasUnsavedChanges, leavesPage } from "../src/app/(app)/flows/[id]/unsaved";
import { advanceTestRun, edgeStates, nodeStates, startTestRun, type TestRun } from "../src/app/(app)/flows/[id]/test-run";

const node = (id: string, x: number, y: number) => ({ id, nodeId: id, x, y, enabledOptionalOutputs: [] });
const edge = (id: string, from: string, to: string) => ({ id, fromFlowNodeId: from, fromOutput: "o", toFlowNodeId: to, toInput: "i" });

describe("tidy up layout", () => {
  it("puts each Node on the step of the longest path that reaches it", () => {
    const steps = layerOf(["t", "c", "rt", "cs", "pr"], [
      { from: "t", to: "c" },
      { from: "c", to: "rt" },
      { from: "c", to: "cs" },
      { from: "c", to: "pr" },
      { from: "rt", to: "pr" },
    ]);
    expect(Object.fromEntries(steps)).toEqual({ t: 0, c: 1, rt: 2, cs: 2, pr: 3 });
  });

  it("says when most wires run backwards, as in a Flow stacked top to bottom", () => {
    const edges = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ];
    expect(wiresMostlyBackward([{ id: "a", x: 0 }, { id: "b", x: 0 }, { id: "c", x: 0 }], edges)).toBe(true);
    expect(wiresMostlyBackward([{ id: "a", x: 0 }, { id: "b", x: 300 }, { id: "c", x: 600 }], edges)).toBe(false);
    // one wire is not enough to say
    expect(wiresMostlyBackward([{ id: "a", x: 0 }, { id: "b", x: 0 }], edges.slice(0, 1))).toBe(false);
  });

  it("puts each Node one column right of the Nodes it depends on", () => {
    const at = layeredLayout(
      [
        { id: "t", x: 500, y: 0, w: 100, h: 40 },
        { id: "a", x: 0, y: 300, w: 180, h: 60 },
        { id: "b", x: 0, y: 0, w: 180, h: 60 },
        { id: "c", x: 900, y: 900, w: 180, h: 60 },
      ],
      [
        { from: "t", to: "a" },
        { from: "t", to: "b" },
        { from: "a", to: "c" },
        { from: "b", to: "c" },
      ],
    );
    expect(at.get("t")!.x).toBe(0);
    expect(at.get("a")!.x).toBe(100 + LAYOUT_GAP_X);
    expect(at.get("b")!.x).toBe(at.get("a")!.x);
    expect(at.get("c")!.x).toBe(at.get("a")!.x + 180 + LAYOUT_GAP_X);
    // the column keeps the current top-to-bottom order (b was above a)
    expect(at.get("b")!.y).toBeLessThan(at.get("a")!.y);
    // and columns are centred on one line
    expect(at.get("t")!.y + 20).toBeCloseTo((at.get("b")!.y + at.get("a")!.y + 60) / 2, 0);
  });

  it("survives a cycle and an empty Flow", () => {
    expect(layeredLayout([], []).size).toBe(0);
    const at = layeredLayout(
      [
        { id: "a", x: 0, y: 0, w: 10, h: 10 },
        { id: "b", x: 0, y: 0, w: 10, h: 10 },
      ],
      [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
    );
    expect(at.size).toBe(2);
  });
});

describe("test run", () => {
  const flow = { nodes: [node("t", 0, 0), node("a", 200, 0), node("ok", 400, 0)], edges: [edge("e1", "t", "a"), edge("e2", "a", "ok")] };
  const kinds: Record<string, "ticket" | "agent" | "approve"> = { t: "ticket", a: "agent", ok: "approve" };

  it("walks the Nodes in run order, pausing on Nodes that wait for a person", () => {
    let run = startTestRun(flow) as TestRun;
    expect(run.order).toEqual(["t", "a", "ok"]);
    const seen: string[] = [];
    while (run.phase !== "done") {
      seen.push(`${run.order[run.index]}:${run.phase}`);
      run = advanceTestRun(run, (id) => kinds[id]);
    }
    expect(seen).toEqual(["t:running", "a:running", "ok:running", "ok:waiting"]);
    expect([...nodeStates(run).values()].every((s) => s === "succeeded")).toBe(true);
    expect(advanceTestRun(run, (id) => kinds[id])).toBe(run);
  });

  it("shows finished, current and queued Nodes and the edge feeding the current one", () => {
    const run: TestRun = { order: ["t", "a", "ok"], index: 1, phase: "running" };
    expect(Object.fromEntries(nodeStates(run))).toEqual({ t: "succeeded", a: "running", ok: "queued" });
    expect(Object.fromEntries(edgeStates(run, flow.edges))).toEqual({ e1: "active" });
    const later: TestRun = { ...run, index: 2, phase: "waiting" };
    expect(Object.fromEntries(edgeStates(later, flow.edges))).toEqual({ e1: "done", e2: "active" });
  });

  it("refuses an empty Flow and a Flow with a cycle", () => {
    expect(startTestRun({ nodes: [], edges: [] })).toEqual({ error: "Add a Node first." });
    const cyclic = { nodes: [node("a", 0, 0), node("b", 0, 0)], edges: [edge("1", "a", "b"), edge("2", "b", "a")] };
    expect("error" in startTestRun(cyclic)).toBe(true);
  });
});

describe("problem hints", () => {
  const library = [
    { id: "L-t", name: "Ticket", kind: "ticket" as const, inputs: [], outputs: [{ name: "issue", type: "issue" as const, optional: false }] },
    {
      id: "L-c",
      name: "Code a change",
      kind: "agent" as const,
      inputs: [{ name: "issue", type: "issue" as const, required: true }],
      outputs: [
        { name: "branch", type: "branch" as const, optional: false },
        { name: "summary", type: "summary" as const, optional: true },
      ],
    },
  ];
  const placements = [
    { id: "t", nodeId: "L-t", label: null },
    { id: "c", nodeId: "L-c", label: "Implement" },
  ];

  it("names the Nodes and the port that is not there, and offers to remove the edge", () => {
    const edges = [{ id: "e", fromFlowNodeId: "t", fromOutput: "issue", toFlowNodeId: "c", toInput: "ticket" }];
    const [view] = describeProblems([{ code: "unknown-port", edgeId: "e", message: "Edge e names an Output or input the Node does not have" }], placements, edges, library);
    expect(view!.title).toBe("Broken edge “Ticket” → “Implement”");
    expect(view!.hint).toContain("“Implement” has no input “ticket”");
    expect(view!.missing).toEqual({ from: undefined, to: "ticket" });
    expect(view!.fix).toEqual({ kind: "remove-edge", edgeId: "e", label: "Remove this edge" });
    expect(view!.nodeIds).toEqual(["t", "c"]);
  });

  it("offers to switch on an optional Output, and says which input type is missing", () => {
    const edges = [{ id: "e", fromFlowNodeId: "c", fromOutput: "summary", toFlowNodeId: "t", toInput: "x" }];
    const [off, missing] = describeProblems(
      [
        { code: "optional-output-off", edgeId: "e", message: "" },
        { code: "required-input-unconnected", flowNodeId: "c", input: "issue", message: "" },
      ],
      placements,
      edges,
      library,
    );
    expect(off!.fix).toEqual({ kind: "enable-output", flowNodeId: "c", output: "summary", label: "Switch “summary” on" });
    expect(missing!.title).toBe("“Implement” is missing its “issue” input");
    expect(missing!.hint).toContain("type issue");
    expect(missing!.fix).toBeUndefined();
  });
});

describe("unsaved changes check (issue #77)", () => {
  const saved = { readOnly: false, graphChanged: false, name: "Plan", savedName: "Plan" };

  it("is clean when nothing changed, and right after Save", () => {
    expect(hasUnsavedChanges(saved)).toBe(false);
    // Save copies the sent Flow and name into the saved state, so both match again.
    expect(hasUnsavedChanges({ ...saved, name: "  Plan  " })).toBe(false);
  });

  it("is dirty after a graph edit or a rename", () => {
    expect(hasUnsavedChanges({ ...saved, graphChanged: true })).toBe(true);
    expect(hasUnsavedChanges({ ...saved, name: "Plan v2" })).toBe(true);
  });

  it("never asks for a read-only Flow", () => {
    expect(hasUnsavedChanges({ ...saved, readOnly: true, graphChanged: true, name: "x" })).toBe(false);
  });
});

describe("which link clicks leave the editor (issue #77)", () => {
  const here = { origin: "https://app.test", pathname: "/flows/1", search: "" };
  const plain = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  const link = (href: string, over: { target?: string; download?: boolean } = {}) => ({ href, target: over.target ?? "", hasAttribute: (n: string) => n === "download" && !!over.download });

  it("asks for a link to another page of the app", () => {
    expect(leavesPage(plain, link("https://app.test/flows"), here)).toBe(true);
    expect(leavesPage(plain, link("/tickets"), here)).toBe(true);
  });

  it("does not ask for the same page, a hash, a new tab, a download or a modified click", () => {
    expect(leavesPage(plain, link("https://app.test/flows/1#problems"), here)).toBe(false);
    expect(leavesPage(plain, link("https://app.test/flows", { target: "_blank" }), here)).toBe(false);
    expect(leavesPage(plain, link("https://app.test/x.csv", { download: true }), here)).toBe(false);
    expect(leavesPage({ ...plain, ctrlKey: true }, link("https://app.test/flows"), here)).toBe(false);
    expect(leavesPage({ ...plain, defaultPrevented: true }, link("https://app.test/flows"), here)).toBe(false);
  });

  it("leaves another site to the browser's own prompt", () => {
    expect(leavesPage(plain, link("https://github.com/x"), here)).toBe(false);
  });
});

describe("leave dialog (issue #77)", () => {
  it("is our own dialog with a way to stay and a way to leave, closed until the guard stops a move", () => {
    const html = renderToStaticMarkup(createElement(LeaveDialog, { pending: null, onStay: () => {}, onLeave: () => {} }));
    expect(html).toContain("<dialog");
    expect(html).not.toMatch(/<dialog[^>]* open/);
    expect(html).toContain("Leave without saving?");
    expect(html).toContain("Keep editing");
    expect(html).toContain("Leave without saving</button>");
  });
});
