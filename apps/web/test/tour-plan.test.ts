import { describe, expect, it } from "vitest";
import { COPY } from "../src/components/tour/copy";
import { buildSteps, type PlanFacts } from "../src/components/tour/plan";
import { AREAS } from "../src/components/tour/steps";

const ready: PlanFacts = { machines: 1, tickets: [{ id: "t", key: "a/b#1", title: "T" }], flows: [{ id: "f", name: "F" }], runs: 1, pullRequests: 1 };
const ids = (isOperator: boolean, facts = ready) => buildSteps(isOperator, facts).map((s) => s.id);

describe("tour plan", () => {
  it("walks one round in order", () => {
    expect(ids(false)).toEqual(["machines", "tickets", "flows", "start", "runs", "pullRequests"]);
  });

  it("adds Project Settings (right after Machines, since Tickets come from a Project) and Members only for an Operator", () => {
    expect(ids(true)).toEqual(["machines", "projects", "tickets", "flows", "start", "runs", "pullRequests", "members"]);
    expect(ids(false)).not.toContain("projects");
    expect(ids(false)).not.toContain("members");
  });

  it("has no missing step when everything is set up", () => {
    expect(buildSteps(true, ready).some((s) => s.missing)).toBe(false);
  });

  it.each([
    ["tickets", { ...ready, tickets: [] }, "ticket", "/tickets"],
    ["flows", { ...ready, flows: [] }, "flow", "/flows"],
    ["runs", { ...ready, runs: 0 }, "run", "/tickets"],
    ["start", { ...ready, machines: 0 }, "machine", "/machines"],
  ] as const)("marks the %s step when a prerequisite is missing", (id, facts, need, href) => {
    const step = buildSteps(false, facts).find((s) => s.id === id);
    expect(step?.missing).toEqual({ need, href });
  });
});

describe("tour copy", () => {
  it("has the same keys in English and Vietnamese", () => {
    const keys = (v: unknown, p = ""): string[] => (typeof v === "object" && v ? Object.entries(v).flatMap(([k, x]) => keys(x, `${p}${k}.`)) : [p]);
    expect(keys(COPY.vi).sort()).toEqual(keys(COPY.en).sort());
  });

  it("explains every main area", () => {
    for (const area of AREAS) {
      expect(COPY.en.area[area].help.length).toBeGreaterThan(10);
      expect(COPY.vi.area[area].help.length).toBeGreaterThan(10);
    }
  });
});
