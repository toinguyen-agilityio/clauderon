import { join } from "node:path";
import { mask } from "@clauderon/core";
import { detached, errorText, type AgentLink, type Log } from "./link";
import { runScript, runText, type System } from "./system";

/** Where the Agent keeps its clones and worktrees, never the Member's own checkouts (ADR 0006). */
export const projectDir = (home: string, owner: string, repo: string) => join(home, "projects", owner, repo);
export const worktreeDir = (home: string, runId: string) => join(home, "runs", runId);

const SAFE = /^[A-Za-z0-9._/-]+$/;

// Commits are made as the Member's own git identity; a clone with none gets
// the gh account and its noreply address, in that clone's config only.
const GIT_IDENTITY = [
  'git -C "$1" config user.name >/dev/null || git -C "$1" config user.name "$(gh api user --jq .login)"',
  'git -C "$1" config user.email >/dev/null || git -C "$1" config user.email "$(gh api user --jq \'"\\(.id)+\\(.login)@users.noreply.github.com"\')"',
].join(" && ");

/**
 * `workspace.prepare` (spec M1 §4.2, POD-10): clone the Project once with the
 * Member's gh login, otherwise fetch the base; then a worktree and branch per
 * Run.
 */
export function registerWorkspaceHandlers(link: AgentLink, system: System, { home, log }: { home: string; log: Log }): void {
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
    detached(async ({ runId, owner, repo, baseBranch, branch }) => {
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
          await git(["worktree", "add", path, "-b", branch, `origin/${baseBranch}`]);
        });
        link.send("workspace.ready", { runId, worktreePath: path });
      } catch (error) {
        const text = mask(errorText(error));
        log(`workspace ${runId}: ${text}`);
        link.send("workspace.failed", { runId, error: text });
      }
    }),
  );
}
