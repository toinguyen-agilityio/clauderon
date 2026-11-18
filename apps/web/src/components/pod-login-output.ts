// Reads what a login command prints in the Pod (the Connect buttons, POD-5),
// so the page can show the one thing the Member needs: gh's one-time code or
// Claude's sign-in link. Pure, so tests feed it real captured output.

export type LoginTool = "gh" | "claude";

export const GH_DEVICE_URL = "https://github.com/login/device";

/** Removes terminal colour codes, links and cursor moves; keeps the text. */
export function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "") // OSC: hyperlinks, titles, colour queries
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "") // CSI: colours, cursor
    .replace(/\x1b[@-_]/g, "")
    .replace(/\r/g, "");
}

export type LoginPrompt = { code: string | null; url: string | null; asksForCode: boolean; error: string | null };

// The lines each CLI prints when the login fails, e.g. a wrong pasted code or
// an expired device code. gh's clipboard warning is not a failure.
const ERRORS: Record<LoginTool, RegExp> = {
  gh: /^.*\b(?:error|expired|denied)\b.*$/im,
  claude: /^.*(?:Invalid code|Login failed|OAuth error|\berror\b).*$/im,
};

const lastLine = (line: string) => line.split("> ").at(-1)!.trim();

/** What the output so far asks of the Member. */
export function readLoginOutput(tool: LoginTool, raw: string): LoginPrompt {
  const text = stripAnsi(raw);
  if (tool === "gh") {
    const code = /one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/.exec(text)?.[1] ?? null;
    return { code, url: code ? GH_DEVICE_URL : null, asksForCode: false, error: errorOf(tool, text) };
  }
  const url = /(https:\/\/claude\.(?:com|ai)\/\S*oauth\/authorize\?\S+)/.exec(text)?.[1] ?? null;
  return { code: null, url, asksForCode: /Paste code here/i.test(text), error: errorOf(tool, text) };
}

function errorOf(tool: LoginTool, text: string): string | null {
  const match = ERRORS[tool].exec(text.replace(/https:\/\/\S+/g, ""));
  return match ? lastLine(match[0]) : null;
}
