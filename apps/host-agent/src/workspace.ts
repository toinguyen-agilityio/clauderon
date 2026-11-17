import { mask } from "@clauderon/core";
import { POD_USER, containerName, execText, type DockerClient } from "./docker";
import { detached, type AgentLink, type Log } from "./pods";

export const projectDir = (owner: string, repo: string) => `/workspace/projects/${owner}/${repo}`;
export const worktreeDir = (runId: string) => `/workspace/runs/${runId}`;

const SAFE = /^[A-Za-z0-9._/-]+$/;

// Commits are made as the gh account, with its noreply address, unless the
// owner set their own identity in the terminal.
const GIT_IDENTITY = [
  "gh auth setup-git",
  'git config --global user.name >/dev/null || git config --global user.name "$(gh api user --jq .login)"',
  'git config --global user.email >/dev/null || git config --global user.email "$(gh api user --jq \'"\\(.id)+\\(.login)@users.noreply.github.com"\')"',
].join(" && ");

/**
 * `workspace.prepare` (spec M1 §4.2, POD-10): clone the Project once with the
 * Starter's gh login, otherwise fetch the base; then a worktree and branch per
 * Run.
 */
export function registerWorkspaceHandlers(link: AgentLink, docker: DockerClient, log: Log): void {
  link.on("workspace.prepare", detached(async ({ runId, podId, owner, repo, baseBranch, branch }) => {
    try {
      for (const value of [owner, repo, baseBranch, branch, runId]) {
        if (!SAFE.test(value) || value.includes("..")) throw new Error(`Refusing unsafe name ${JSON.stringify(value)}`);
      }
      const container = containerName(podId);
      const options = { user: POD_USER };
      const dir = projectDir(owner, repo);
      const git = (args: string[]) => execText(docker, container, ["git", "-C", dir, ...args], options);

      await execText(docker, container, ["bash", "-lc", GIT_IDENTITY], options);
      const cloned = (await docker.exec(container, ["test", "-d", `${dir}/.git`], options)) === 0;
      if (cloned) await git(["fetch", "origin", baseBranch]);
      else await execText(docker, container, ["gh", "repo", "clone", `${owner}/${repo}`, dir], options);

      const path = worktreeDir(runId);
      await git(["worktree", "add", path, "-b", branch, `origin/${baseBranch}`]);
      link.send("workspace.ready", { runId, worktreePath: path });
    } catch (error) {
      const text = mask(error instanceof Error ? error.message : String(error));
      log(`workspace ${runId}: ${text}`);
      link.send("workspace.failed", { runId, error: text });
    }
  }));
}
