import { describe, expect, it } from "vitest";
import { GH_DEVICE_URL, readLoginOutput, stripAnsi } from "../src/components/pod-login-output";

// Output captured from the Pod image (gh with GH_PROMPT_DISABLED, Claude Code 2.1.325).
const GH = [
  "\x1b]11;?\x1b\\\x1b[6n\x1b[0;33m!\x1b[0m Did you know that expiring tokens can be requested with \x1b[0;1;39m--expiring\x1b[0m?\r\n",
  "\x1b[0;31m!\x1b[0m Failed to copy one-time code to clipboard\r\n",
  "\x1b[0;33m!\x1b[0m First copy your one-time code: \x1b[0;1;39m06B8-38FE\x1b[0m\r\n",
  "\x1b[0;1;39mOpen this URL\x1b[0m to continue in your web browser: https://github.com/login/device\r\n",
].join("");

const URL = "https://claude.com/cai/oauth/authorize?code=true&client_id=abc&response_type=code&state=xyz";
const CLAUDE = [
  "Opening browser to sign in…\r\n",
  `If the browser didn't open, visit: \x1b]8;;${URL}\x07\x1b[94m${URL}\x1b[39m\x1b]8;;\x07\r\n`,
  "Paste code here if prompted > \x1b[?25h",
].join("");

describe("Connect login output (POD-5)", () => {
  it("finds gh's one-time code and the device page", () => {
    expect(readLoginOutput("gh", GH)).toEqual({ code: "06B8-38FE", url: GH_DEVICE_URL, asksForCode: false, error: null });
  });

  it("waits for more gh output while the code has not arrived, even across chunks", () => {
    expect(readLoginOutput("gh", GH.slice(0, 120))).toEqual({ code: null, url: null, asksForCode: false, error: null });
  });

  it("finds Claude's sign-in link and its prompt for the code", () => {
    expect(readLoginOutput("claude", CLAUDE)).toEqual({ code: null, url: URL, asksForCode: true, error: null });
  });

  it("reports the line a failed login prints, not gh's clipboard warning", () => {
    const wrong = `${CLAUDE}not-a-real-code\r\nInvalid code. Please make sure the full code was copied.\r\n`;
    expect(readLoginOutput("claude", wrong).error).toBe("Invalid code. Please make sure the full code was copied.");
    expect(readLoginOutput("gh", `${GH}error: the device code has expired\r\n`).error).toBe("error: the device code has expired");
  });

  it("strips colours and terminal links to plain text", () => {
    expect(stripAnsi("\x1b[0;1;39m06B8-38FE\x1b[0m\r\n")).toBe("06B8-38FE\n");
  });
});
