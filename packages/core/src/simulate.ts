import type { NodeOutput } from "./flow";
import { activeOutputs, type OutputValue } from "./runner";

// The Dry-run runner's fakes (spec M2 §7, RUN-13): nothing here touches a Machine,
// GitHub or Claude.

const MIN_MS = 2000;
const MAX_MS = 8000;

/** How long one simulated Node takes: 2 to 8 seconds. */
export function simulatedDelayMs(random: () => number): number {
  return MIN_MS + Math.floor(random() * (MAX_MS - MIN_MS));
}

function fake(type: NodeOutput["type"], name: string, context: { branch: string }): unknown {
  switch (type) {
    case "issue":
      return { number: 0, title: "Dry-run issue", body: "", labels: [], url: "https://example.invalid/dry-run" };
    case "plan":
      return `Dry-run plan for ${name}`;
    case "branch":
      return { branch: context.branch, headCommit: "0000000" };
    case "test-result":
      return { exitCode: 0, tail: "dry-run: all tests passed" };
    case "pull-request":
      return { number: 0, url: "https://example.invalid/dry-run/pull/0" };
    case "summary":
      return `Dry-run summary for ${name}`;
    case "screenshot":
      return "dry-run screenshot";
  }
}

/** Fake Outputs for a Node: every required one, and each enabled optional one half the time. */
export function simulatedOutputs(
  outputs: readonly NodeOutput[],
  enabledOptional: readonly string[],
  random: () => number,
  context: { branch: string },
): OutputValue[] {
  return activeOutputs(outputs, enabledOptional)
    .filter((o) => !o.optional || random() < 0.5)
    .map((o) => ({ name: o.name, type: o.type, value: fake(o.type, o.name, context) }));
}
