import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// `clauderon-open-pr` from the Pod image (spec M1 §4.5), run against a real
// git repository with a local "origin" and a fake `gh` that records its calls.

const SCRIPT = resolve(__dirname, "../../../images/pod/clauderon-open-pr");

let dir: string;
let work: string;
let bin: string;

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "open-pr-"));
  const origin = join(dir, "origin.git");
  work = join(dir, "work");
  bin = join(dir, "bin");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
  execFileSync("git", ["clone", "-q", origin, work], { stdio: "pipe" });
  git(work, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
  git(work, "push", "-q", "origin", "HEAD:main");
  git(work, "checkout", "-q", "-b", "clauderon/412-fix-ledger-totals-abc123");

  // gh: `pr list` answers from $FAKE_EXISTING, `pr create` records its body, `pr view` gives a number.
  execFileSync("mkdir", ["-p", bin]);
  const gh = join(bin, "gh");
  writeFileSync(
    gh,
    `#!/usr/bin/env bash
echo "$*" >> "${dir}/gh-calls"
case "$1 $2" in
  "pr list") if [ -n "\${FAKE_EXISTING:-}" ]; then echo "$FAKE_EXISTING"; fi ;;
  "pr create") while [ $# -gt 0 ]; do if [ "$1" = "--body-file" ]; then cp "$2" "${dir}/body"; fi; shift; done; echo "https://github.com/acme/web/pull/12" ;;
  "pr view") echo 12 ;;
esac
`,
  );
  chmodSync(gh, 0o755);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(env: Record<string, string> = {}) {
  writeFileSync(join(dir, "summary"), "Fixed the totals.");
  writeFileSync(join(dir, "tests"), "Exit code 0\n\n3 passing");
  return spawnSync("bash", [SCRIPT], {
    cwd: work,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      CLAUDERON_ISSUE_NUMBER: "412",
      CLAUDERON_BASE: "main",
      CLAUDERON_BRANCH: "clauderon/412-fix-ledger-totals-abc123",
      CLAUDERON_TITLE: "Fix: Ledger totals!",
      CLAUDERON_SUMMARY_FILE: join(dir, "summary"),
      CLAUDERON_TEST_RESULT_FILE: join(dir, "tests"),
      ...env,
    },
  });
}

const calls = () => {
  try {
    return readFileSync(join(dir, "gh-calls"), "utf8");
  } catch {
    return "";
  }
};

describe("clauderon-open-pr (RUN-11, TIC-8)", () => {
  it("T1-13: no commits ahead of the base prints 'no changes', exits 0 and opens nothing", () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("no changes");
    expect(calls()).toBe("");
  });

  it("pushes the branch and opens a pull request titled after the issue, with Refs #n", () => {
    git(work, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "fix");
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split("\n").at(-1)).toBe('{"pullRequest":{"number":12,"url":"https://github.com/acme/web/pull/12"}}');
    expect(git(join(dir, "origin.git"), "branch", "--list", "clauderon/*")).toContain("clauderon/412-fix-ledger-totals-abc123");
    expect(calls()).toContain("pr create --base main --head clauderon/412-fix-ledger-totals-abc123 --title Fix: Ledger totals! (#412)");
    const body = readFileSync(join(dir, "body"), "utf8");
    expect(body).toContain("Fixed the totals.");
    expect(body).toContain("3 passing");
    expect(body.trim().endsWith("Refs #412")).toBe(true);
  });

  it("reuses the open pull request for the branch: pushing is enough", () => {
    git(work, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "fix");
    const result = run({ FAKE_EXISTING: '{"number": 7, "url": "https://github.com/acme/web/pull/7"}' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split("\n").at(-1)).toBe('{"pullRequest":{"number":7,"url":"https://github.com/acme/web/pull/7"}}');
    expect(calls()).not.toContain("pr create");
  });
});
