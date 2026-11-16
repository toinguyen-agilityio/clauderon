import { describe, expect, it } from "vitest";
import { mask } from "../src/index.js";

describe("mask", () => {
  it("T0-9: hides every token pattern and known secret in a mixed log line", () => {
    const line = [
      "ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "gho_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "ghu_cccccccccccccccccccccccccccccccccccc",
      "ghs_dddddddddddddddddddddddddddddddddddd",
      "ghr_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      "github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz",
      "sk-ant-api03-Zz9_Yy8-Xx7Ww6Vv5Uu4",
      "Authorization: Bearer ya29.a0Af_secret-value",
      "token=hunter2-is-my-secret",
    ].join(" | ");
    const masked = mask(line, ["hunter2-is-my-secret"]);
    expect(masked).toBe(
      "••• | ••• | ••• | ••• | ••• | ••• | ••• | Authorization: Bearer ••• | token=•••",
    );
  });

  it("leaves ordinary text alone and ignores empty secrets", () => {
    expect(mask("git push origin ghost-branch", ["", "  "])).toBe("git push origin ghost-branch");
  });

  it("treats known secrets as plain text, not patterns", () => {
    expect(mask("a.b+c a-b-c", ["a.b+c"])).toBe("••• a-b-c");
  });
});
