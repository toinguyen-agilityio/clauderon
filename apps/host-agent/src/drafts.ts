import { join } from "node:path";
import { mask } from "@clauderon/core";
import type { Payload } from "@clauderon/protocol";
import { ClaudeErrorWatch, draftClaudeCommand, parseClaudeLine } from "./claude";
import { errorText, type AgentLink, type Log } from "./link";
import { KILL_GRACE_MS, Lines, UNKNOWN_SESSION, terminate } from "./nodes";
import type { ProcessHandle, System } from "./system";

export type DraftRunnerOptions = {
  log: Log;
  knownSecrets: readonly string[];
  /** The Agent's directory: each draft gets `<home>/drafts/<draftId>`. */
  home: string;
  killGraceMs?: number;
};

/** One call in flight: its process once started, and whether a kill came first. */
type Running = { process: ProcessHandle | null; killed: boolean };

/** Where a draft's calls run: its own empty directory, so `--resume` finds the session again. */
export const draftDir = (home: string, draftId: string) => join(home, "drafts", draftId.replace(/[^A-Za-z0-9-]/g, ""));

/**
 * `flow.draft` (ADR 0008): one Claude Code call, outside any Run, that answers with a Flow file.
 * It runs in the background, takes no Slot, and reports one `flow.drafted` with the final message;
 * the Gateway reads and checks it.
 */
export function registerDraftHandlers(link: AgentLink, system: System, options: DraftRunnerOptions): { running(): string[] } {
  const graceMs = options.killGraceMs ?? KILL_GRACE_MS;
  const running = new Map<string, Running>();

  link.on("flow.draft", (payload) => {
    const entry: Running = { process: null, killed: false };
    running.set(payload.jobId, entry);
    void runDraft(link, system, options, payload, (proc) => {
      entry.process = proc;
      if (entry.killed) terminate((signal) => proc.kill(signal), graceMs);
    }).finally(() => running.delete(payload.jobId));
  });

  link.on("flow.draftKill", ({ jobId }) => {
    const entry = running.get(jobId);
    if (!entry || entry.killed) return;
    entry.killed = true;
    if (entry.process) {
      const proc = entry.process;
      terminate((signal) => proc.kill(signal), graceMs);
    }
  });

  return { running: () => [...running.keys()] };
}

export async function runDraft(
  link: AgentLink,
  system: System,
  options: Pick<DraftRunnerOptions, "home" | "knownSecrets" | "log">,
  draft: Payload<"flow.draft">,
  started: (process: ProcessHandle) => void = () => {},
): Promise<void> {
  const hide = (text: string) => mask(text, options.knownSecrets);
  const dir = draftDir(options.home, draft.draftId);
  // Hidden, and next to nothing else: Claude has no reason to look at it.
  const promptFile = join(dir, ".prompt.md");
  try {
    await system.writeFile(promptFile, draft.prompt);
    let finalText: string | undefined;
    let sessionId: string | undefined;
    let unknownSession = false;
    const errors = new ClaudeErrorWatch();
    const watch = (line: string) => {
      if (draft.resumeSessionId && UNKNOWN_SESSION.test(line)) unknownSession = true;
    };
    const stdout = new Lines((line) => {
      if (!line.trimStart().startsWith("{")) watch(line);
      const event = parseClaudeLine(line);
      errors.event(event);
      if (event.sessionId) sessionId = event.sessionId;
      if (event.finalText !== undefined) finalText = event.finalText;
    });
    const stderr = new Lines((line) => {
      watch(line);
      errors.stderr(line);
    });
    const proc = system.start(draftClaudeCommand(draft.resumeSessionId), [], { cwd: dir, env: { CLAUDERON_PROMPT_FILE: promptFile } }, (stream, text) =>
      (stream === "stdout" ? stdout : stderr).push(text),
    );
    started(proc);
    const exitCode = await proc.exit;
    stdout.flush();
    stderr.flush();
    const error = exitCode !== 0 ? hide(errors.reason(exitCode)) : undefined;
    link.send("flow.drafted", {
      jobId: draft.jobId,
      exitCode,
      ...(finalText !== undefined ? { finalText: hide(finalText) } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...(error ? { error } : {}),
      ...(unknownSession ? { unknownSession } : {}),
    });
  } catch (failure) {
    const text = hide(errorText(failure));
    options.log(`flow draft ${draft.jobId}: ${text}`);
    link.send("flow.drafted", { jobId: draft.jobId, exitCode: -1, error: text });
  } finally {
    await system.remove(promptFile).catch(() => {});
  }
}
