import type { GitHubReader, OpenPullRequest } from "@clauderon/core";
import { describe, expect, it, vi } from "vitest";
import { withCachedPullRequests } from "../src/server/github";

const pull = (number: number): OpenPullRequest => ({
  number,
  branch: `b${number}`,
  state: "open",
  url: `u${number}`,
  title: `PR ${number}`,
  authorLogin: "octocat",
  createdAt: new Date(0),
  reviewers: [],
});

function setup() {
  const list = vi.fn<GitHubReader["listOpenPullRequests"]>(async () => [pull(1)]);
  let time = 0;
  const reader = withCachedPullRequests({ listOpenPullRequests: list } as unknown as GitHubReader, 30_000, () => time);
  return { list, reader, advance: (ms: number) => (time += ms) };
}

describe("withCachedPullRequests", () => {
  it("reads GitHub once within the TTL and again after it", async () => {
    const { list, reader, advance } = setup();
    await reader.listOpenPullRequests("acme", "web");
    advance(29_999);
    await reader.listOpenPullRequests("acme", "web");
    expect(list).toHaveBeenCalledTimes(1);
    advance(1);
    await reader.listOpenPullRequests("acme", "web");
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("keeps repositories apart and shares concurrent reads", async () => {
    const { list, reader } = setup();
    await Promise.all([reader.listOpenPullRequests("acme", "web"), reader.listOpenPullRequests("acme", "web"), reader.listOpenPullRequests("acme", "api")]);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failed read", async () => {
    const { list, reader } = setup();
    list.mockRejectedValueOnce(new Error("GitHub: rate limit"));
    await expect(reader.listOpenPullRequests("acme", "web")).rejects.toThrow("rate limit");
    await expect(reader.listOpenPullRequests("acme", "web")).resolves.toEqual([pull(1)]);
    expect(list).toHaveBeenCalledTimes(2);
  });
});
