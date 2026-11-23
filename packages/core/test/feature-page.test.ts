import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const page = read("docs/feature-page/clauderon-features.html");

/** Visible English text: the body without scripts, styles, tags and the Vietnamese copy. */
const text = page
  .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<[^>]+>/g, " ");

describe("feature page (docs/feature-page)", () => {
  it("keeps jargon out of the main text", () => {
    for (const word of ["Gateway", "worktree", "DAG", "WebSocket", "ADR", "protocol", "migration"]) {
      expect(text, word).not.toMatch(new RegExp(`\b${word}\b`));
    }
  });

  it("holds nothing secret: no emails, tokens, hostnames or personal paths", () => {
    expect(page).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(page).not.toMatch(/gh[pousr]_\w{20,}|sk-[\w-]{20,}/);
    expect(page).not.toMatch(/[A-Z]:\Users|\/home\/|\/Users\//);
  });

  it("has one block per release, newest first, each with a date", () => {
    const blocks = [...page.matchAll(/data-release="(v\d+\.\d+\.\d+)">\s*<h3>[^<]+<span class="date">([^<]+)</g)];
    const versions = blocks.map((m) => m[1]!.slice(1).split(".").map(Number));
    expect(versions.length).toBeGreaterThanOrEqual(3);
    for (const b of blocks) expect(b[2]).toMatch(/^\d{1,2} \w{3} \d{4}$/);
    for (let i = 1; i < versions.length; i++) {
      const [a, b] = [versions[i - 1]!, versions[i]!];
      expect(a[0]! * 1e6 + a[1]! * 1e3 + a[2]!).toBeGreaterThan(b[0]! * 1e6 + b[1]! * 1e3 + b[2]!);
    }
  });

  it("offers an English and a Vietnamese toggle and links the sections from the header", () => {
    expect(page).toContain('id="lang"');
    for (const id of ["features", "how", "changes", "faq"]) {
      expect(page).toContain(`href="#${id}"`);
      expect(page).toContain(`id="${id}"`);
    }
  });

  it("is linked from the README files with the same address", () => {
    const urls = (s: string) => new Set(s.match(/https:\/\/claude\.ai\/artifact\/Na23vn2TEXZ6VPgy5Wrovy/g));
    expect(urls(read("README.md")).size).toBe(1);
    expect(urls(read("docs/README.md")).size).toBe(1);
  });
});
