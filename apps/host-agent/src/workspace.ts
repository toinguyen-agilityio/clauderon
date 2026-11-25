import { createHash } from "node:crypto";
import { join } from "node:path";
import { ATTACHMENTS_DIR, attachmentName, mask } from "@clauderon/core";
import type { Payload } from "@clauderon/protocol";
import { detached, errorText, type AgentLink, type Log } from "./link";
import { run, runScript, runText, type System } from "./system";

/** Where the Agent keeps its clones and worktrees, never the Member's own checkouts (ADR 0006). */
export const projectDir = (home: string, owner: string, repo: string) => join(home, "projects", owner, repo);
export const worktreeDir = (home: string, runId: string) => join(home, "runs", runId);

const SAFE = /^[A-Za-z0-9._/-]+$/;

/** Downloads one of a Run's attached files from the Gateway (ADR 0011). */
export type DownloadAttachment = (id: string) => Promise<Uint8Array>;

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

/** The line in the clone's `.git/info/exclude` that keeps the Agent's own files out of every commit. */
const EXCLUDE = ".clauderon/";

/** A clone's exclude list, with `.clauderon/` added once; worktrees share it. */
async function excludeAgentFiles(system: System, clone: string): Promise<void> {
  const path = join(clone, ".git", "info", "exclude");
  const current = (await system.readFile(path)) ?? "";
  if (current.split(/\r?\n/).some((line) => line.trim() === EXCLUDE)) return;
  await system.writeFile(path, `${current}${current === "" || current.endsWith("\n") ? "" : "\n"}${EXCLUDE}\n`);
}

/**
 * Writes a Run's attached files into its worktree, each checked against the size and
 * SHA-256 the Gateway named; any mismatch fails the whole Workspace.
 */
async function writeAttachments(system: System, worktree: string, attachments: NonNullable<Payload<"workspace.prepare">["attachments"]>, download: DownloadAttachment | undefined) {
  if (attachments.length === 0) return;
  if (!download) throw new Error("This Agent cannot download attached files");
  for (const file of attachments) {
    // The web app already cleaned the name; never trust a path from the message.
    if (attachmentName(file.name) !== file.name) throw new Error(`Refusing unsafe file name ${JSON.stringify(file.name)}`);
    const data = await download(file.id);
    if (data.length !== file.size || sha256(data) !== file.sha256) throw new Error(`${file.name} arrived damaged`);
    await system.writeBytes(join(worktree, ATTACHMENTS_DIR, file.name), data);
  }
}

// Commits are made as the Member's own git identity; a clone with none gets
// the gh account and its noreply address, in that clone's config only.
const GIT_IDENTITY = [
  'git -C "$1" config user.name >/dev/null || git -C "$1" config user.name "$(gh api user --jq .login)"',
  'git -C "$1" config user.email >/dev/null || git -C "$1" config user.email "$(gh api user --jq \'"\\(.id)+\\(.login)@users.noreply.github.com"\')"',
].join(" && ");

/**
 * `workspace.prepare` (spec M1 §4.2, POD-10): clone the Project once with the
 * Member's gh login, otherwise fetch the base; then a worktree and branch per
 * Run. `workspace.cleanup` (RUN-14) removes that worktree and its local branch
 * once the Run is Succeeded or Cancelled.
 */
export function registerWorkspaceHandlers(link: AgentLink, system: System, { home, log, download }: { home: string; log: Log; download?: DownloadAttachment }): void {
  // One prepare at a time per clone: a Batch starts several Runs of the same
  // Project together, and two first-time clones into one directory collide.
  const queues = new Map<string, Promise<void>>();
  const oneAtATime = (key: string, task: () => Promise<void>): Promise<void> => {
    const next = (queues.get(key) ?? Promise.resolve()).then(task);
    const tail = next.catch(() => undefined);
    queues.set(key, tail);
    void tail.then(() => {
      if (queues.get(key) === tail) queues.delete(key);
    });
    return next;
  };

  link.on(
    "workspace.prepare",
    detached(async ({ runId, owner, repo, baseBranch, branch, attachments = [] }) => {
      try {
        for (const value of [owner, repo, baseBranch, branch, runId]) {
          if (!SAFE.test(value) || value.includes("..")) throw new Error(`Refusing unsafe name ${JSON.stringify(value)}`);
        }
        const dir = projectDir(home, owner, repo);
        const git = (args: string[]) => runText(system, ["git", "-C", dir, ...args]);
        const path = worktreeDir(home, runId);

        await oneAtATime(dir, async () => {
          if (await system.exists(join(dir, ".git"))) await git(["fetch", "origin", baseBranch]);
          else await runText(system, ["gh", "repo", "clone", `${owner}/${repo}`, dir]);
          await runScript(system, GIT_IDENTITY, [dir]);
          await excludeAgentFiles(system, dir);
          await git(["worktree", "add", path, "-b", branch, `origin/${baseBranch}`]);
        });
        await writeAttachments(system, path, attachments, download);
        link.send("workspace.ready", { runId, worktreePath: path, ...(attachments.length > 0 ? { attachments: attachments.length } : {}) });
      } catch (error) {
        const text = mask(errorText(error));
        log(`workspace ${runId}: ${text}`);
        link.send("workspace.failed", { runId, error: text });
      }
    }),
  );

  link.on(
    "workspace.cleanup",
    detached(async ({ runId, worktreePath, owner, repo, branch }) => {
      try {
        for (const value of [owner, repo, branch, runId]) {
          if (!SAFE.test(value) || value.includes("..")) throw new Error(`Refusing unsafe name ${JSON.stringify(value)}`);
        }
        // Only the worktree this Agent made for the Run: never a path the message names.
        const path = worktreeDir(home, runId);
        if (worktreePath !== path) throw new Error(`Refusing to clean up ${JSON.stringify(worktreePath)}`);
        const dir = projectDir(home, owner, repo);
        const git = (args: string[]) => runText(system, ["git", "-C", dir, ...args]);

        await oneAtATime(dir, async () => {
          if (await system.exists(join(dir, ".git"))) {
            if (await system.exists(path)) await git(["worktree", "remove", "--force", path]);
            await git(["worktree", "prune"]);
            // The pushed branch stays on GitHub; only the local one goes.
            if ((await run(system, ["git", "-C", dir, "show-ref", "--verify", "--quiet", `refs/heads/${branch}`])) === 0) await git(["branch", "-D", branch]);
          }
          if (await system.exists(path)) await system.remove(path);
        });
        link.send("workspace.cleaned", { runId });
      } catch (error) {
        // Not acknowledged: the Gateway asks again when the Agent next connects.
        log(`workspace cleanup ${runId}: ${mask(errorText(error))}`);
      }
    }),
  );
}
