import { describe, expect, it } from "vitest";
import { canConnect, topologicalOrder, validateFlow, type Flow, type LibraryNode } from "../src/index";
import { basicDelivery, edge, fn, library, planAndDeliver } from "./fixtures";

const codes = (flow: Flow) => validateFlow(flow, library).map((p) => p.code);

describe("validateFlow", () => {
  it("T0-1: both sample Flows have no problems", () => {
    expect(validateFlow(basicDelivery, library)).toEqual([]);
    expect(validateFlow(planAndDeliver, library)).toEqual([]);
  });

  it("T0-2: an edge from plan to an issue input is a type mismatch", () => {
    expect(canConnect({ name: "plan", type: "plan", optional: false }, { name: "issue", type: "issue", required: true })).toEqual({
      ok: false,
      reason: "Output Type plan does not match input type issue",
    });
    expect(canConnect({ name: "plan", type: "plan", optional: false }, { name: "plan", type: "plan", required: false })).toEqual({ ok: true });

    const flow: Flow = {
      nodes: [fn("t", "ticket", 0), fn("draft", "draft-a-plan", 1), fn("draft2", "draft-a-plan", 2)],
      edges: [edge("t", "issue", "draft", "issue"), edge("draft", "plan", "draft2", "issue")],
    };
    const problems = validateFlow(flow, library);
    expect(problems).toEqual([
      expect.objectContaining({ code: "type-mismatch", edgeId: "draft.plan->draft2.issue" }),
    ]);
  });

  it("T0-3: reports the edge that closes a cycle", () => {
    const flow: Flow = {
      nodes: [fn("t", "ticket", 0), fn("a", "approve-a-plan", 1), fn("b", "approve-a-plan", 2), fn("draft", "draft-a-plan", 3)],
      edges: [edge("t", "issue", "draft", "issue"), edge("a", "plan", "b", "plan"), edge("b", "plan", "a", "plan")],
    };
    const cycle = validateFlow(flow, library).filter((p) => p.code === "cycle");
    expect(cycle).toHaveLength(1);
    expect(["a.plan->b.plan", "b.plan->a.plan"]).toContain(cycle[0]?.edgeId);
  });

  it("T0-3: reports two Ticket Nodes, no Ticket Node, and an unconnected required input", () => {
    const two: Flow = {
      nodes: [fn("t", "ticket", 0), fn("t2", "ticket", 0, 1), fn("draft", "draft-a-plan", 1)],
      edges: [edge("t", "issue", "draft", "issue")],
    };
    expect(codes(two)).toContain("entry-count");

    const none: Flow = { nodes: [fn("draft", "draft-a-plan", 1)], edges: [] };
    expect(codes(none)).toEqual(expect.arrayContaining(["entry-count", "required-input-unconnected"]));

    const unconnected: Flow = {
      nodes: [fn("t", "ticket", 0), fn("draft", "draft-a-plan", 1), fn("test", "run-tests", 2)],
      edges: [edge("t", "issue", "draft", "issue")],
    };
    expect(validateFlow(unconnected, library)).toEqual([
      expect.objectContaining({ code: "required-input-unconnected", flowNodeId: "test", input: "branch" }),
    ]);
  });

  it("reports a Flow with no end Node", () => {
    expect(codes({ nodes: [fn("t", "ticket", 0)], edges: [] })).toEqual(["no-end-node"]);
  });

  it("reports a second edge into the same input", () => {
    const flow: Flow = {
      nodes: [fn("t", "ticket", 0), fn("d1", "draft-a-plan", 1), fn("d2", "draft-a-plan", 1, 1), fn("ap", "approve-a-plan", 2)],
      edges: [
        edge("t", "issue", "d1", "issue"),
        edge("t", "issue", "d2", "issue"),
        edge("d1", "plan", "ap", "plan"),
        edge("d2", "plan", "ap", "plan"),
      ],
    };
    expect(validateFlow(flow, library)).toEqual([expect.objectContaining({ code: "input-taken", edgeId: "d2.plan->ap.plan" })]);
  });

  it("reports an edge from an optional Output turned off in the Node panel", () => {
    const flow: Flow = {
      ...basicDelivery,
      nodes: basicDelivery.nodes.map((n) => (n.id === "code" ? { ...n, enabledOptionalOutputs: [] } : n)),
    };
    expect(validateFlow(flow, library)).toEqual([
      expect.objectContaining({ code: "optional-output-off", edgeId: "code.summary->pr.summary" }),
    ]);
  });

  it("reports unknown Nodes and ports instead of throwing", () => {
    const flow: Flow = {
      nodes: [fn("t", "ticket", 0), fn("x", "no-such-node", 1), fn("draft", "draft-a-plan", 1, 1)],
      edges: [edge("t", "nope", "draft", "issue")],
    };
    expect(codes(flow)).toEqual(expect.arrayContaining(["unknown-node", "unknown-port"]));
  });
});

describe("topologicalOrder", () => {
  it("orders Plan and deliver by dependencies, then canvas y, x and id", () => {
    expect(topologicalOrder(planAndDeliver)).toEqual(["t", "grill", "approve", "code", "test", "shots", "pr", "approvePr"]);
  });

  it("T0-4: is stable across 100 shuffles of the Node and edge lists", () => {
    const expected = topologicalOrder(planAndDeliver);
    let seed = 42;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const shuffle = <T>(items: T[]) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    };
    for (let i = 0; i < 100; i++) {
      expect(topologicalOrder({ nodes: shuffle(planAndDeliver.nodes), edges: shuffle(planAndDeliver.edges) })).toEqual(expected);
    }
  });

  it("throws on a cycle", () => {
    expect(() =>
      topologicalOrder({ nodes: [fn("a", "approve-a-plan", 0), fn("b", "approve-a-plan", 1)], edges: [edge("a", "plan", "b", "plan"), edge("b", "plan", "a", "plan")] }),
    ).toThrow(/cycle/);
  });
});

describe("validateFlow with Input Nodes", () => {
  const library: LibraryNode[] = [
    { id: "branch", name: "Branch", kind: "input", inputs: [], outputs: [{ name: "branch", type: "branch", optional: false }] },
    { id: "plan", name: "Plan", kind: "input", inputs: [], outputs: [{ name: "plan", type: "plan", optional: false }] },
    { id: "tests", name: "Run tests", kind: "command", inputs: [{ name: "branch", type: "branch", required: true }], outputs: [] },
    {
      id: "code",
      name: "Code a change",
      kind: "agent",
      inputs: [
        { name: "issue", type: "issue", required: false, group: "context" },
        { name: "plan", type: "plan", required: false, group: "context" },
      ],
      outputs: [],
    },
  ];
  const place = (id: string, nodeId: string) => ({ id, nodeId, x: 0, y: 0, enabledOptionalOutputs: [] });
  const edge = (from: string, fromOutput: string, to: string, toInput: string) => ({ id: `${from}-${to}`, fromFlowNodeId: from, fromOutput, toFlowNodeId: to, toInput });

  it("accepts a Flow that starts from a non-issue Input", () => {
    const flow = { nodes: [place("b", "branch"), place("t", "tests")], edges: [edge("b", "branch", "t", "branch")] };
    expect(validateFlow(flow, library)).toEqual([]);
  });

  it("refuses two Input Nodes", () => {
    const flow = { nodes: [place("b", "branch"), place("p", "plan"), place("t", "tests")], edges: [edge("b", "branch", "t", "branch")] };
    expect(validateFlow(flow, library).map((p) => p.code)).toContain("entry-count");
  });

  it("needs one input of a group connected", () => {
    const without = { nodes: [place("p", "plan"), place("c", "code")], edges: [] };
    expect(validateFlow(without, library).map((p) => p.code)).toContain("input-group-unconnected");
    const withPlan = { ...without, edges: [edge("p", "plan", "c", "plan")] };
    expect(validateFlow(withPlan, library)).toEqual([]);
  });
});
