import { mask } from "./mask";
import type { InputType } from "./flow";

// What a Member supplies for a Flow's Input Node when starting a Run without a Ticket.

export type RunInput =
  | { type: "branch"; value: { branch: string } }
  | { type: "pull-request"; value: { number: number; url: string } }
  | { type: "plan" | "summary"; value: string };

export type RunInputCheck = { ok: true; input: RunInput } | { ok: false; error: string };

const TEXT_MAX = 20_000;
// The characters the Agent accepts for a ref; a leading dash could read as a git option.
const BRANCH = /^[A-Za-z0-9._/][A-Za-z0-9._/-]{0,199}$/;

/** Cleans and checks a value for an Input Type; an `issue` comes from a Ticket, never from here. */
export function checkRunInput(type: InputType, raw: unknown): RunInputCheck {
  const value = raw as Record<string, unknown> | string | null | undefined;
  if (type === "branch") {
    const branch = typeof value === "object" && value ? String(value.branch ?? "").trim() : "";
    if (!BRANCH.test(branch) || branch.includes("..")) return { ok: false, error: "Pick a branch." };
    return { ok: true, input: { type, value: { branch } } };
  }
  if (type === "pull-request") {
    const number = typeof value === "object" && value ? Number(value.number) : NaN;
    const url = typeof value === "object" && value ? String(value.url ?? "") : "";
    if (!Number.isInteger(number) || number < 1 || !url.startsWith("https://")) return { ok: false, error: "Pick a pull request." };
    return { ok: true, input: { type, value: { number, url } } };
  }
  if (type === "plan" || type === "summary") {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) return { ok: false, error: `Enter the ${type}.` };
    if (text.length > TEXT_MAX) return { ok: false, error: `The ${type} is at most ${TEXT_MAX} characters.` };
    return { ok: true, input: { type, value: mask(text) } };
  }
  return { ok: false, error: "An issue comes from a Ticket." };
}

/** The title of a Run without a Ticket, shown where a Ticket's title would be. */
export function runInputTitle(flowName: string, input: RunInput): string {
  if (input.type === "branch") return `${flowName} on ${input.value.branch}`;
  if (input.type === "pull-request") return `${flowName} on PR #${input.value.number}`;
  const line = input.value.split("\n")[0]!.trim();
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
}
