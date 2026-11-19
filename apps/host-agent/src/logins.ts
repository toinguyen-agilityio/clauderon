import { run, runText, type System } from "./system";
import { detached, type AgentLink } from "./link";

/**
 * The Claude Code login check: a status command that exits 0, or a stored
 * credentials file (Linux and Windows; macOS keeps them in the Keychain).
 */
export const CLAUDE_STATUS_SCRIPT = 'claude auth status >/dev/null 2>&1 || test -s "$HOME/.claude/.credentials.json"';

/** Login checks under the Member's own logins on their Machine (POD-5); never periodic. */
export async function checkLogins(system: System) {
  const ok = async (exit: Promise<number>) => (await exit.catch(() => 1)) === 0;
  const claude = await ok(system.start(CLAUDE_STATUS_SCRIPT, [], {}).exit);
  const gh = await ok(run(system, ["gh", "auth", "status"]));
  let ghAccount: string | null = null;
  let tokenRepos: string[] = [];
  if (gh) {
    ghAccount = (await runText(system, ["gh", "api", "user", "--jq", ".login"]).catch(() => "")).trim() || null;
    // Every repository the login reaches; the Gateway keeps the Projects' ones.
    const repos = await runText(system, ["gh", "api", "user/repos?per_page=100", "--paginate", "--jq", ".[].full_name"]).catch(() => "");
    tokenRepos = repos
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
  }
  return { claude, gh, ghAccount, tokenRepos };
}

export function registerLoginHandlers(link: AgentLink, system: System): void {
  link.on(
    "machine.checkLogins",
    detached(async () => {
      // checkLogins never throws: each failed check reads as logged out.
      link.send("machine.logins", { ...(await checkLogins(system)), checkedAt: new Date().toISOString() });
    }),
  );
}
