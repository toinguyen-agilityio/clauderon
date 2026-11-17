import { describe, expect, it } from "vitest";
import { OUTPUT_TYPES, simulatedDelayMs, simulatedOutputs, type NodeOutput } from "../src/index";

const outputs: NodeOutput[] = OUTPUT_TYPES.map((type) => ({ name: type, type, optional: false }));

describe("simulatedDelayMs (RUN-13)", () => {
  it("is 2 s at the low end of the random range and 8 s at the high end", () => {
    expect(simulatedDelayMs(() => 0)).toBe(2000);
    expect(simulatedDelayMs(() => 0.999999)).toBeLessThanOrEqual(8000);
    expect(simulatedDelayMs(() => 0.999999)).toBeGreaterThan(7990);
  });
});

describe("simulatedOutputs (RUN-13)", () => {
  it("makes a fake value of the right shape for every Output Type", () => {
    const made = simulatedOutputs(outputs, [], () => 0, { branch: "clauderon/1-x-abcdef" });
    expect(made.map((o) => o.type)).toEqual([...OUTPUT_TYPES]);
    const byType = Object.fromEntries(made.map((o) => [o.type, o.value])) as Record<string, unknown>;
    expect(byType["branch"]).toEqual({ branch: "clauderon/1-x-abcdef", headCommit: expect.any(String) });
    expect(byType["test-result"]).toEqual({ exitCode: 0, tail: expect.any(String) });
    expect(byType["pull-request"]).toEqual({ number: expect.any(Number), url: expect.stringContaining("dry-run") });
    expect(byType["summary"]).toEqual(expect.any(String));
    expect(byType["plan"]).toEqual(expect.any(String));
    expect(byType["issue"]).toEqual(expect.objectContaining({ number: expect.any(Number) }));
    expect(byType["screenshot"]).toEqual(expect.any(String));
  });

  it("includes an enabled optional Output only half the time", () => {
    const optional: NodeOutput[] = [{ name: "shot", type: "screenshot", optional: true }];
    expect(simulatedOutputs(optional, ["shot"], () => 0.2, { branch: "b" })).toHaveLength(1);
    expect(simulatedOutputs(optional, ["shot"], () => 0.7, { branch: "b" })).toHaveLength(0);
  });

  it("leaves a disabled optional Output out", () => {
    const optional: NodeOutput[] = [{ name: "shot", type: "screenshot", optional: true }];
    expect(simulatedOutputs(optional, [], () => 0, { branch: "b" })).toHaveLength(0);
  });
});
