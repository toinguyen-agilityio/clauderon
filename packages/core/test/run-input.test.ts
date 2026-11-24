import { describe, expect, it } from "vitest";
import { checkRunInput, runInputTitle } from "../src/run-input";

describe("checkRunInput", () => {
  it("accepts a branch and refuses one that could read as a git option", () => {
    expect(checkRunInput("branch", { branch: " feat/x " })).toEqual({ ok: true, input: { type: "branch", value: { branch: "feat/x" } } });
    expect(checkRunInput("branch", { branch: "--upload-pack=x" }).ok).toBe(false);
    expect(checkRunInput("branch", { branch: "a..b" }).ok).toBe(false);
  });

  it("needs a real pull request", () => {
    expect(checkRunInput("pull-request", { number: 7, url: "https://github.com/o/r/pull/7" }).ok).toBe(true);
    expect(checkRunInput("pull-request", { number: 0, url: "https://github.com/o/r/pull/7" }).ok).toBe(false);
  });

  it("needs text for a plan and never takes an issue", () => {
    expect(checkRunInput("plan", "  ").ok).toBe(false);
    expect(checkRunInput("summary", "Do it").ok).toBe(true);
    expect(checkRunInput("issue", { number: 1 }).ok).toBe(false);
  });
});

describe("runInputTitle", () => {
  it("names the Run after its input", () => {
    expect(runInputTitle("Deliver", { type: "branch", value: { branch: "feat/x" } })).toBe("Deliver on feat/x");
    expect(runInputTitle("Deliver", { type: "plan", value: "First line\nSecond" })).toBe("First line");
  });
});
