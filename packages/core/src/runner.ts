import type { NodeKind, NodeOutput, OutputType } from "./flow";
import { renderRetryContext, resultContract, type RetryContext } from "./human";

// What the Run engine and the Host Agent agree on for running a Node (spec M1
// §4): branch names, Agent prompts, the result contract of M0 §6 and the
// Outputs of Command Nodes. Pure functions, shared by both sides.

const SLUG_MAX = 40;

/** `clauderon/<issue>-<slug>-<first 6 of run id>` (RUN-3). */
export function branchName(issueNumber: number, title: string, runId: string): string {
  const slug =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, SLUG_MAX)
      .replace(/^-+|-+$/g, "") || "ticket";
  return `clauderon/${issueNumber}-${slug}-${runId.replaceAll("-", "").slice(0, 6)}`;
}

/**
 * Ticket keys (TIC-1): `repo#n`, or `owner/repo#n` when two Projects share a
 * repository name.
 */
export function ticketKeys(projects: readonly { id: string; owner: string; repo: string }[]) {
  const counts = new Map<string, number>();
  for (const p of projects) counts.set(p.repo, (counts.get(p.repo) ?? 0) + 1);
  const byId = new Map(projects.map((p) => [p.id, p]));
  return (projectId: string, number: number): string => {
    const p = byId.get(projectId);
    if (!p) return `#${number}`;
    return (counts.get(p.repo) ?? 0) > 1 ? `${p.owner}/${p.repo}#${number}` : `${p.repo}#${number}`;
  };
}

/** Pod Ready: running with both Claude Code and gh logged in (POD-5). */
export function isPodReady(pod: { status: string; claudeLoggedIn: boolean; ghLoggedIn: boolean }): boolean {
  return pod.status === "running" && pod.claudeLoggedIn && pod.ghLoggedIn;
}

/** The Pods' limits add up to more than the Pod Host's CPU or RAM (POD-2). */
export function overCommitted(
  host: { cpus: number | null; memoryMb: number | null } | null,
  pods: readonly { cpus: number; memoryMb: number }[],
): boolean {
  if (!host?.cpus || !host.memoryMb) return false;
  const cpus = pods.reduce((sum, p) => sum + p.cpus, 0);
  const memoryMb = pods.reduce((sum, p) => sum + p.memoryMb, 0);
  return cpus > host.cpus || memoryMb > host.memoryMb;
}

export type PromptInput = { name: string; value: unknown };

export type PromptParts = {
  instructions: string;
  placementInstructions: string;
  batchInstructions: string;
  inputs: readonly PromptInput[];
  /** Names of the Outputs the Node must report (optional ones turned on). */
  outputs: readonly string[];
  /** A Grill Node may ask questions instead (spec M3 §2.2). */
  grill?: boolean;
  /** Set on a retried Attempt (RUN-7). */
  retryContext?: RetryContext | null;
};

function render(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

/**
 * The Agent Node prompt (spec M1 §4.3): the Node's instructions, the
 * placement's and the Batch's extra instructions, each input under a heading
 * named after it, the retry context of a retried Attempt (RUN-7), then the
 * result contract of M0 §6.
 */
export function buildAgentPrompt(parts: PromptParts): string {
  const sections = [parts.instructions.trim()];
  if (parts.placementInstructions.trim()) sections.push(`Extra instructions for this step:\n${parts.placementInstructions.trim()}`);
  if (parts.batchInstructions.trim()) sections.push(`Extra instructions from the person who started this run:\n${parts.batchInstructions.trim()}`);
  for (const input of parts.inputs) sections.push(`## ${input.name}\n\n${render(input.value)}`);
  const retry = renderRetryContext(parts.retryContext);
  if (retry) sections.push(retry);
  sections.push(resultContract(parts.outputs, parts.grill ?? false));
  return `${sections.join("\n\n")}\n`;
}

const JSON_FENCE = /```json[ \t]*\r?\n/g;
const FENCE = "```";

function parseOrUndefined(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * The last fenced JSON block of the agent's final message, or null. A message
 * that is nothing but a JSON object counts too: the M0 spike saw a resumed
 * session answer with bare JSON (docs/specs/notes/claude-headless.md).
 *
 * An Output often holds its own code fences (a plan's test commands), so the
 * block does not end at the first ``` after its opening: each later fence is
 * tried until the text between parses as JSON.
 */
export function extractResultBlock(text: string): unknown {
  const last = [...text.matchAll(JSON_FENCE)].at(-1);
  if (!last) return /^\s*\{[\s\S]*\}\s*$/.test(text) ? (parseOrUndefined(text) ?? null) : null;
  const start = last.index + last[0].length;
  for (let end = text.indexOf(FENCE, start); end !== -1; end = text.indexOf(FENCE, end + FENCE.length)) {
    const value = parseOrUndefined(text.slice(start, end));
    if (value !== undefined) return value;
  }
  return null;
}

export type OutputValue = { name: string; type: OutputType; value: unknown };
export type CheckResult = { ok: true; outputs: OutputValue[] } | { ok: false; reason: string };
export type BranchFacts = { branch: string; headCommit: string | null };

/** The Outputs a placement reports: every required one and the optional ones turned on. */
export function activeOutputs(outputs: readonly NodeOutput[], enabledOptional: readonly string[]): NodeOutput[] {
  return outputs.filter((o) => !o.optional || enabledOptional.includes(o.name));
}

/**
 * Checks an Agent result against its Node (M0 §6): a required Output missing,
 * an unknown name, or questions from a non-Grill Node fail the Attempt. A
 * `branch` Output is filled in from the Host Agent's facts, never by Claude.
 */
export function checkAgentResult(
  node: { kind: NodeKind; outputs: readonly NodeOutput[] },
  enabledOptional: readonly string[],
  result: unknown,
  branch?: BranchFacts,
): CheckResult {
  if (!result || typeof result !== "object") return { ok: false, reason: "The agent did not end with a result block" };
  if ("questions" in result && node.kind !== "grill") return { ok: false, reason: "Only a Grill Node can ask questions" };
  const given = (result as { outputs?: unknown }).outputs;
  const values = given && typeof given === "object" ? (given as Record<string, unknown>) : {};

  const known = new Set(node.outputs.map((o) => o.name));
  for (const name of Object.keys(values)) if (!known.has(name)) return { ok: false, reason: `Unknown Output ${name}` };

  const outputs: OutputValue[] = [];
  for (const output of activeOutputs(node.outputs, enabledOptional)) {
    if (output.type === "branch") {
      if (!branch) return { ok: false, reason: "Required Output branch is missing" };
      outputs.push({ name: output.name, type: output.type, value: branch });
      continue;
    }
    const value = values[output.name];
    if (value === undefined || value === null || value === "") {
      if (output.optional) continue;
      return { ok: false, reason: `Required Output ${output.name} is missing` };
    }
    outputs.push({ name: output.name, type: output.type, value });
  }
  return { ok: true, outputs };
}

export type CommandFacts = { exitCode: number; tail: string; pullRequest?: { number: number; url: string } };

/** Outputs of a Command Node (spec M1 §4.4, §4.5). */
export function commandOutputs(
  outputs: readonly NodeOutput[],
  enabledOptional: readonly string[],
  facts: CommandFacts,
  branch: BranchFacts,
): OutputValue[] {
  const values: OutputValue[] = [];
  for (const output of activeOutputs(outputs, enabledOptional)) {
    if (output.type === "test-result") values.push({ name: output.name, type: output.type, value: { exitCode: facts.exitCode, tail: facts.tail } });
    else if (output.type === "branch") values.push({ name: output.name, type: output.type, value: branch });
    else if (output.type === "pull-request" && facts.pullRequest) values.push({ name: output.name, type: output.type, value: facts.pullRequest });
  }
  return values;
}

/** The last `n` lines of a text, without a trailing newline. */
export function tailLines(text: string, n: number): string {
  const lines = text.replace(/\n$/, "").split("\n");
  return lines.slice(-n).join("\n");
}
