import { describe, expect, it } from "vitest";
import { claudeAccountLabel } from "../src/app/(app)/machines/machine-parts";

describe("claudeAccountLabel", () => {
  it("names the Claude account Runs use by the email's name, with its plan, in one short label", () => {
    expect(claudeAccountLabel({ claudeLoggedIn: true, claudeAccount: "ann@example.com", claudePlan: "pro" })).toBe("ann · Pro");
    expect(claudeAccountLabel({ claudeLoggedIn: true, claudeAccount: "ann@example.com", claudePlan: null })).toBe("ann");
    // Logged out, or an older Agent that does not say: nothing to show.
    expect(claudeAccountLabel({ claudeLoggedIn: false, claudeAccount: "ann@example.com", claudePlan: "pro" })).toBeNull();
    expect(claudeAccountLabel({ claudeLoggedIn: true, claudeAccount: null, claudePlan: null })).toBeNull();
  });
});
