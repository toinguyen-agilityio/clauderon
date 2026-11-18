import { describe, expect, it } from "vitest";
import { isSetupStep, SETUP_COMMANDS } from "../src/server/pod-setup";

describe("Pod setup commands", () => {
  it("the terminal only types a known setup step, never a command from the URL", () => {
    expect(["setup", "claude", "gh"].every(isSetupStep)).toBe(true);
    for (const value of [undefined, "", "rm -rf /", "toString", "__proto__", "constructor"]) expect(isSetupStep(value)).toBe(false);
  });

  it("the one-button setup skips logins that are already done", () => {
    expect(SETUP_COMMANDS.setup).toContain("claude auth status");
    expect(SETUP_COMMANDS.setup).toContain("gh auth status >/dev/null 2>&1 && echo 'gh: already logged in' ||");
  });

  it("gh login never tries to open a browser inside the container and points to the device page", () => {
    for (const command of [SETUP_COMMANDS.setup, SETUP_COMMANDS.gh]) {
      expect(command).toContain("GH_BROWSER=true gh auth login");
      expect(command).toContain("https://github.com/login/device");
    }
  });
});
