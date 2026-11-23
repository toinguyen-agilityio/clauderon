import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BADGES,
  buildSummary,
  checkCoverage,
  GROUPS,
  loadFeatures,
  loadVi,
  renderSummary,
  STATUSES,
  SUMMARY_PATH,
} from "../src";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const features = loadFeatures(root);
const vi = loadVi(root);
const html = buildSummary(root);

/** The part of the page before the Removed section. */
const current = html.slice(0, html.indexOf("<details>"));
const removedPart = html.slice(html.indexOf("<details>"), html.indexOf("</details>"));

describe("features summary page", () => {
  it("puts every feature that is not removed in exactly one group", () => {
    const ids = GROUPS.flatMap((g) => [...g.ids]);
    expect(new Set(ids).size).toBe(ids.length);
    const live = features.filter((f) => f.status !== "removed").map((f) => f.id);
    expect([...ids].sort()).toEqual([...live].sort());
  });

  it("has a group for every area a Member works in", () => {
    for (const g of GROUPS) expect(g.ids.length).toBeGreaterThan(0);
    const titles = GROUPS.map((g) => g.title).join("|");
    for (const word of ["Tickets", "Flows and Nodes", "Runs", "Approve, Grill", "Machines and the Agent", "Sign-in", "Deploy"]) {
      expect(titles).toContain(word);
    }
  });

  it("fails when a feature is in no group", () => {
    const extra = { ...features[0]!, id: "NEW-1" };
    expect(() => checkCoverage([...features, extra], vi)).toThrow(/NEW-1 is not in any group/);
  });

  it("fails when a feature has no Vietnamese line", () => {
    const { ["TIC-1"]: _gone, ...rest } = vi.features;
    expect(() => checkCoverage(features, { ...vi, features: rest })).toThrow(/no Vietnamese text for TIC-1/);
  });

  it("shows removed features only in the Removed section, with their reason", () => {
    for (const f of features.filter((x) => x.status === "removed")) {
      expect(current).not.toContain(`(${f.id})`);
      expect(current).not.toContain(`>${f.name}<`);
      expect(removedPart).toContain(`(${f.id})`);
      expect(removedPart).toContain(f.reason!.slice(0, 20));
    }
    for (const f of features.filter((x) => x.status !== "removed")) expect(current).toContain(f.summary.slice(0, 30));
  });

  it("maps every status to a badge", () => {
    for (const s of STATUSES) if (s !== "removed") expect(BADGES[s].en.length).toBeGreaterThan(0);
    const partial = features.map((f, i) => (i === 0 ? { ...f, status: "partial" as const } : f));
    const notStarted = features.map((f, i) => (i === 1 ? { ...f, status: "not-started" as const } : f));
    expect(renderSummary(partial, vi)).toContain('class="badge partial"');
    expect(renderSummary(notStarted, vi)).toContain("Not yet built");
  });

  it("holds no email, token or host other than the repo's GitHub links", () => {
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(html).not.toMatch(/\b(?:ghp_|github_pat_|sk-|xox[bp]-)\w+/);
    const hosts = [...html.matchAll(/https?:\/\/([^/"\s<]+)/g)].map((m) => m[1]);
    expect(new Set(hosts)).toEqual(new Set(["github.com"]));
    expect(html).not.toMatch(/localhost|\.local\b|\.internal\b|tailscale|trycloudflare/i);
  });

  it("does not use Pod-era words for current features", () => {
    expect(current).not.toMatch(/\bPods?\b/);
  });

  it("is deterministic and matches the committed file", () => {
    expect(buildSummary(root)).toBe(html);
    expect(readFileSync(resolve(root, SUMMARY_PATH), "utf8").replace(/\r\n/g, "\n")).toBe(html);
  });
});
