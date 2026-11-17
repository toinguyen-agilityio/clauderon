import { mask, tailLines } from "@clauderon/core";
import type { Payload } from "@clauderon/protocol";
import { claudeCommand, claudeResult, parseClaudeLine } from "./claude";
import { POD_USER, containerName, execText, type DockerClient } from "./docker";
import type { AgentLink, Log } from "./pods";

/** Inputs passed as files: the Gateway sends the text, the Node gets `<NAME>_FILE`. */
export const FILE_ENV = ["CLAUDERON_SUMMARY", "CLAUDERON_TEST_RESULT"] as const;
/** Set by the Gateway when the Node must produce a `branch`: HEAD has to move. */
export const EXPECT_COMMIT_ENV = "CLAUDERON_EXPECT_COMMIT";
export const TAIL_LINES = 200;

/** Splits streamed text into lines, holding a partial line until it ends. */
class Lines {
  private rest = "";
  constructor(private readonly emit: (line: string) => void) {}
  push(text: string): void {
    const parts = (this.rest + text).split("\n");
    this.rest = parts.pop() ?? "";
    for (const line of parts) this.emit(line.replace(/\r$/, ""));
  }
  flush(): void {
    if (this.rest) this.emit(this.rest);
    this.rest = "";
  }
}

export type NodeRunnerOptions = { log: Log; knownSecrets: readonly string[] };

/**
 * `node.run` (spec M1 §4.3, §4.4): runs a Command or Agent Node as `pod` in
 * the Run's worktree, streams masked log lines, and reports one `node.result`.
 * Runs in the background so the link keeps serving terminals and other Pods.
 */
export function registerNodeHandlers(link: AgentLink, docker: DockerClient, options: NodeRunnerOptions): void {
  link.on("node.run", (payload) => {
    void runNode(link, docker, options, payload);
  });
}

export async function runNode(link: AgentLink, docker: DockerClient, options: NodeRunnerOptions, run: Payload<"node.run">): Promise<void> {
  const container = containerName(run.podId);
  const inWorktree = { user: POD_USER, workdir: run.worktreePath };
  const secrets = [...options.knownSecrets];
  const hide = (text: string) => mask(text, secrets);
  let seq = 0;
  const log = (stream: "stdout" | "stderr" | "system", text: string) => link.send("node.log", { attemptId: run.attemptId, seq: seq++, stream, text: hide(text) });

  try {
    // The owner's own gh token is a secret too (NFR-1).
    const token = (await execText(docker, container, ["gh", "auth", "token"], { user: POD_USER }).catch(() => "")).trim();
    if (token) secrets.push(token);

    const git = async (...args: string[]) => (await execText(docker, container, ["git", ...args], inWorktree)).trim();
    const gitDir = await git("rev-parse", "--absolute-git-dir");
    const headBefore = await git("rev-parse", "HEAD");
    const writeFile = (path: string, content: string) =>
      execText(docker, container, ["bash", "-c", 'printf %s "$CLAUDERON_CONTENT" > "$1"', "_", path], { user: POD_USER, env: { CLAUDERON_CONTENT: content } });

    const env: Record<string, string> = { ...run.env };
    const expectCommit = env[EXPECT_COMMIT_ENV] === "1";
    delete env[EXPECT_COMMIT_ENV];
    for (const key of FILE_ENV) {
      const content = env[key];
      if (content === undefined) continue;
      delete env[key];
      // Inside the worktree's git directory, so it is never committed.
      const path = `${gitDir}/clauderon-${run.attemptId}-${key.toLowerCase()}`;
      await writeFile(path, content);
      env[`${key}_FILE`] = path;
    }

    let exitCode: number;
    let result: unknown;
    let sessionId: string | undefined;
    let error: string | undefined;

    if (run.kind === "command") {
      const output: string[] = [];
      let pullRequest: unknown;
      const streams = {
        stdout: new Lines((line) => {
          output.push(line);
          if (line.startsWith('{"pullRequest"')) {
            try {
              pullRequest = (JSON.parse(line) as { pullRequest: unknown }).pullRequest;
            } catch {
              // not the script's result line
            }
          }
          log("stdout", line);
        }),
        stderr: new Lines((line) => {
          output.push(line);
          log("stderr", line);
        }),
      };
      exitCode = await docker.exec(container, ["bash", "-lc", run.command ?? "true"], { ...inWorktree, env }, (stream, text) => streams[stream].push(text));
      streams.stdout.flush();
      streams.stderr.flush();
      result = { tail: hide(tailLines(output.join("\n"), TAIL_LINES)), ...(pullRequest ? { pullRequest } : {}) };
      if (exitCode !== 0) error = `Command exited ${exitCode}`;
    } else {
      const promptFile = `${gitDir}/clauderon-prompt-${run.attemptId}.md`;
      await writeFile(promptFile, run.prompt ?? "");
      let finalText: string | undefined;
      const stdout = new Lines((line) => {
        const event = parseClaudeLine(line);
        if (event.sessionId) sessionId = event.sessionId;
        if (event.usage) link.send("node.usage", { attemptId: run.attemptId, ...event.usage });
        if (event.finalText !== undefined) finalText = event.finalText;
        if (event.log) for (const part of event.log.split("\n")) log("stdout", part);
      });
      const stderr = new Lines((line) => log("stderr", line));
      exitCode = await docker.exec(
        container,
        ["bash", "-lc", claudeCommand(run.resumeSessionId)],
        { ...inWorktree, env: { ...env, CLAUDERON_PROMPT_FILE: promptFile } },
        (stream, text) => (stream === "stdout" ? stdout : stderr).push(text),
      );
      stdout.flush();
      stderr.flush();
      result = claudeResult(finalText);
      if (exitCode !== 0) error = `Claude Code exited ${exitCode}`;
    }

    const headCommit = await git("rev-parse", "HEAD");
    if (!error && expectCommit && headCommit === headBefore) error = "no commit on the branch";
    link.send("node.result", { attemptId: run.attemptId, exitCode, result, sessionId, headCommit, ...(error ? { error } : {}) });
  } catch (failure) {
    const text = hide(failure instanceof Error ? failure.message : String(failure));
    options.log(`node ${run.attemptId}: ${text}`);
    log("system", text);
    link.send("node.result", { attemptId: run.attemptId, exitCode: -1, error: text });
  }
}
