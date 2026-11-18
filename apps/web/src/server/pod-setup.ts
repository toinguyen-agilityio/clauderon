// The setup commands the Pod page offers and the web terminal may type.

/**
 * The container has no browser, so `gh` cannot open the device page itself.
 * `GH_BROWSER=true` makes its "open the browser" step a silent no-op, and the
 * echo tells the Member to open the page on their own computer instead.
 */
const GH_LOGIN =
  "{ echo 'Open https://github.com/login/device on your computer and enter the one-time code gh shows below.'; GH_BROWSER=true gh auth login --hostname github.com --git-protocol https; }";

/**
 * Commands the web terminal may type for the owner (`?run=` on the terminal
 * page). Only these keys are accepted, never a command from the URL.
 * `setup` does every login step left and skips the ones already done.
 */
export const SETUP_COMMANDS = {
  setup: [
    "(claude auth status >/dev/null 2>&1 || test -s ~/.claude/.credentials.json) && echo 'Claude Code: already logged in' || { echo 'Log in to Claude Code, then type /exit'; claude; }",
    `gh auth status >/dev/null 2>&1 && echo 'gh: already logged in' || ${GH_LOGIN}`,
    "echo 'Done. Go back to your Pod page: it checks the logins again.'",
  ].join("; "),
  claude: "claude",
  gh: GH_LOGIN,
} as const;

export type SetupStep = keyof typeof SETUP_COMMANDS;

export const isSetupStep = (value: unknown): value is SetupStep => typeof value === "string" && Object.hasOwn(SETUP_COMMANDS, value);
