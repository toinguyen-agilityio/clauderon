import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { localSystem } from "../src/local-system";
import { runText, type System } from "../src/system";

// The real processes and files on this computer (ADR 0006), POSIX only.
const posix = process.platform !== "win32";

let dir: string;
let system: System;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agent-system-"));
  system = localSystem({ binDir: join(dir, "bin") });
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe.runIf(posix)("localSystem", () => {
  it("runs a program with its arguments as they are, in a login bash, in the given directory", async () => {
    expect(await runText(system, ["printf", "%s|", "a b", "$HOME", "it's"], { cwd: dir })).toBe("a b|$HOME|it's|");
    expect((await runText(system, ["pwd"], { cwd: dir })).trim()).toMatch(/agent-system-/);
  });

  it("streams output and resolves with the exit code; env is added to the Agent's own", async () => {
    const out: string[] = [];
    const proc = system.start('echo "$GREETING"; echo oops >&2; exit 3', [], { env: { GREETING: "hi" } }, (stream, text) => out.push(`${stream}:${text}`));
    expect(await proc.exit).toBe(3);
    expect(out.join("")).toContain("stdout:hi\n");
    expect(out.join("")).toContain("stderr:oops\n");
  });

  it("puts the Agent's own tools first on the PATH", async () => {
    await system.writeFile(join(dir, "bin", "clauderon-hello"), "#!/usr/bin/env bash\necho from-agent-bin\n");
    await runText(system, ["chmod", "+x", join(dir, "bin", "clauderon-hello")]);
    expect((await system.start("clauderon-hello", [], {}).exit)).toBe(0);
    expect((await runText(system, ["bash", "-c", "command -v clauderon-hello"])).trim()).toBe(join(dir, "bin", "clauderon-hello"));
  });

  it("a kill reaches the whole process group, children included", async () => {
    const pidFile = join(dir, "child.pid");
    const proc = system.start(`sleep 30 & echo $! > "$1"; wait`, [pidFile], {});
    for (let i = 0; i < 50 && !(await system.readFile(pidFile)); i++) await new Promise((r) => setTimeout(r, 20));
    const child = Number((await system.readFile(pidFile))!.trim());
    proc.kill("TERM");
    expect(await proc.exit).toBe(-1);
    await new Promise((r) => setTimeout(r, 50));
    expect(() => process.kill(child, 0)).toThrow();
  });

  it("files: write creates directories, list and remove, missing ones read as null", async () => {
    const file = join(dir, "nodes", "att-1.json");
    await system.writeFile(file, "{}");
    expect(await system.list(join(dir, "nodes"))).toEqual(["att-1.json"]);
    expect(await system.exists(file)).toBe(true);
    await system.remove(file);
    expect(await system.readFile(file)).toBeNull();
    expect(await system.list(join(dir, "missing"))).toEqual([]);
  });
});
