import { describe, expect, it } from "vitest";
import { FakeClock, FakeGitHub, memorySocketPair, settle } from "../src/index.js";

describe("FakeClock", () => {
  it("fires timers in order only when advanced", async () => {
    const clock = new FakeClock("2026-11-16T00:00:00Z");
    const fired: string[] = [];
    clock.setTimeout(() => fired.push("b"), 2000);
    clock.setTimeout(() => fired.push("a"), 1000);
    const cancelled = clock.setTimeout(() => fired.push("x"), 1500);
    clock.clearTimeout(cancelled);

    await clock.advance(999);
    expect(fired).toEqual([]);
    await clock.advance(1001);
    expect(fired).toEqual(["a", "b"]);
    expect(clock.now().toISOString()).toBe("2026-11-16T00:00:02.000Z");
  });

  it("runs timers scheduled by other timers within the same advance", async () => {
    const clock = new FakeClock();
    const fired: number[] = [];
    clock.setTimeout(() => clock.setTimeout(() => fired.push(2), 500), 500);
    await clock.advance(1000);
    expect(fired).toEqual([2]);
  });
});

describe("memorySocketPair", () => {
  it("delivers messages asynchronously and loses those in flight when cut", async () => {
    const [a, b] = memorySocketPair();
    const got: string[] = [];
    const closes: number[] = [];
    b.onMessage((t) => got.push(t));
    b.onClose((c) => closes.push(c));

    a.send("one");
    await settle();
    a.send("lost");
    a.cut();
    await settle();

    expect(got).toEqual(["one"]);
    expect(closes).toEqual([1006]);
  });
});

describe("FakeGitHub", () => {
  it("serves repositories, issues and pull requests from memory", async () => {
    const github = new FakeGitHub()
      .addRepository({ owner: "acme", repo: "shop", defaultBranch: "main" })
      .addIssue("acme", "shop", { number: 1, title: "Fix cart" })
      .addIssue("acme", "shop", { number: 2, title: "Old", state: "closed" })
      .addPullRequest("acme", "shop", { number: 9, branch: "clauderon/1-fix-cart-ab12", state: "open", url: "u" });

    expect(await github.listRepositories()).toEqual([{ owner: "acme", repo: "shop", defaultBranch: "main" }]);
    expect((await github.listOpenIssues("acme", "shop")).map((i) => i.number)).toEqual([1]);
    expect(await github.findPullRequest("acme", "shop", "clauderon/1-fix-cart-ab12")).toMatchObject({ number: 9 });
    await expect(github.listBranches("acme", "secret")).rejects.toThrow(/not readable/);
  });
});
