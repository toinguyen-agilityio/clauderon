import { run, runText, type System } from "./system";
import { detached, type AgentLink } from "./link";

/** Older Claude Code without a JSON status: a status command that exits 0, or a stored credentials file. */
export const CLAUDE_STATUS_SCRIPT = 'claude auth status >/dev/null 2>&1 || test -s "$HOME/.claude/.credentials.json"';

export type ClaudeLogin = { claude: boolean; claudeAccount: string | null; claudePlan: string | null };

/**
 * Reads `claude auth status`: logged in or not, and which account and plan,
 * so the Member sees which Claude account their Runs use. Never a token.
 */
export function parseClaudeStatus(output: string): ClaudeLogin | null {
  let status: { loggedIn?: unknown; email?: unknown; subscriptionType?: unknown; planTier?: unknown };
  try {
    status = JSON.parse(output);
  } catch {
    return null;
  }
  if (typeof status !== "object" || status === null || typeof status.loggedIn !== "boolean") return null;
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  return status.loggedIn
    ? { claude: true, claudeAccount: text(status.email), claudePlan: text(status.subscriptionType) ?? text(status.planTier) }
    : { claude: false, claudeAccount: null, claudePlan: null };
}

async function checkClaude(system: System): Promise<ClaudeLogin> {
  // Logged out, it still prints its JSON but exits 1: read the output either way.
  let output = "";
  await run(system, ["claude", "auth", "status"], {}, (stream, text) => {
    if (stream === "stdout") output += text;
  }).catch(() => 1);
  const parsed = parseClaudeStatus(output);
  if (parsed) return parsed;
  const ok = (await system.start(CLAUDE_STATUS_SCRIPT, [], {}).exit.catch(() => 1)) === 0;
  return { claude: ok, claudeAccount: null, claudePlan: null };
}

/** Login checks under the Member's own logins on their Machine (POD-5); never periodic. */
export async function checkLogins(system: System) {
  const ok = async (exit: Promise<number>) => (await exit.catch(() => 1)) === 0;
  const claude = await checkClaude(system);
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
  return { ...claude, gh, ghAccount, tokenRepos };
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
