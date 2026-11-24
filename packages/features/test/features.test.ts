import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildFeatures,
  featuresFileSchema,
  MAX_BYTES,
  OUTPUT_PATH,
  parseMilestones,
  parseRequirements,
  renderFeatures,
  statusFromEvidence,
} from "../src";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const REQUIREMENTS = `# Req
## 4. Functional requirements
| ID | Requirement | Priority |
| --- | --- | --- |
| RUN-1 | **Start dialog**: pick a Flow. Then more words. | Must |
| RUN-2 | A Run executes its [Nodes](x.md) one at a time. | Should |
| NFR-1 | Security | Secrets live in the environment. | Must |
## 5. Constraints
| XXX-9 | not a requirement | Must |
`;

const README = `## Requirement coverage
| Area | M0 | M1 | M2 | M3 | M4 |
| --- | --- | --- | --- | --- | --- |
| Runs | NFR-1 | RUN-1 | RUN-2 … RUN-3 | | |
| Split | | RUN-4 | | RUN-4 | |

---
| Later | RUN-9 | | | | |
`;

function fixture(map: unknown, files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "features-"));
  const put = (p: string, text: string) => {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), text);
  };
  put("docs/requirements/v1-requirements.md", REQUIREMENTS);
  put("docs/specs/README.md", README);
  put("packages/features/features.map.json", JSON.stringify(map));
  for (const f of files) put(f, "x");
  return root;
}

describe("parseRequirements", () => {
  it("reads rows of section 4 only, with names and first sentences", () => {
    const rows = parseRequirements(REQUIREMENTS);
    expect(rows.map((r) => r.id)).toEqual(["RUN-1", "RUN-2", "NFR-1"]);
    expect(rows[0]).toMatchObject({ name: "Start dialog", summary: "Start dialog: pick a Flow.", priority: "Must" });
    expect(rows[1]?.summary).toBe("A Run executes its Nodes one at a time.");
    expect(rows[2]).toMatchObject({ name: "Security", summary: "Secrets live in the environment." });
  });
});

describe("parseMilestones", () => {
  it("maps ids to their first milestone, expands ranges and stops at the rule", () => {
    const m = parseMilestones(README);
    expect(m.get("NFR-1")).toBe("M0");
    expect(m.get("RUN-1")).toBe("M1");
    expect(m.get("RUN-2")).toBe("M2");
    expect(m.get("RUN-3")).toBe("M2");
    expect(m.get("RUN-4")).toBe("M1");
    expect(m.has("RUN-9")).toBe(false);
  });
});

describe("statusFromEvidence", () => {
  const root = fixture({}, ["a.ts", "b.ts"]);
  it("is done when every path exists, partial when some do, not-started otherwise", () => {
    expect(statusFromEvidence({ paths: ["a.ts", "b.ts"] }, root).status).toBe("done");
    expect(statusFromEvidence({ paths: ["a.ts", "c.ts"] }, root)).toEqual({ status: "partial", missing: ["c.ts"] });
    expect(statusFromEvidence({ paths: ["c.ts"] }, root).status).toBe("not-started");
    expect(statusFromEvidence({}, root).status).toBe("not-started");
  });
  it("lets a status set by hand win", () => {
    expect(statusFromEvidence({ status: "removed", paths: ["a.ts"] }, root).status).toBe("removed");
  });
});

describe("buildFeatures", () => {
  const map = {
    "RUN-1": { name: "Start", paths: ["a.ts"], docs: ["docs/specs/README.md"] },
    "RUN-2": { status: "removed", reason: "Replaced by something", paths: [] },
    "NFR-1": { paths: ["a.ts", "gone.ts"] },
    extra: { name: "Extra", summary: "An extra feature.", milestone: "M4", paths: ["b.ts"] },
  };

  it("combines requirements, milestones and evidence, and reports missing paths", () => {
    const root = fixture(map, ["a.ts", "b.ts"]);
    expect(() => buildFeatures(root)).toThrow(/NFR-1: path not found: gone\.ts/);
  });

  it("builds every feature with its status", () => {
    const root = fixture({ ...map, "NFR-1": { paths: ["a.ts"] } }, ["a.ts", "b.ts"]);
    const file = buildFeatures(root);
    const by = Object.fromEntries(file.features.map((f) => [f.id, f]));
    expect(by["RUN-1"]).toMatchObject({ name: "Start", status: "done", milestone: "M1" });
    expect(by["RUN-2"]).toMatchObject({ status: "removed", reason: "Replaced by something", milestone: "M2" });
    expect(by["NFR-1"]?.summary).toBe("Secrets live in the environment.");
    expect(by["extra"]).toMatchObject({ status: "done", milestone: "M4" });
    expect(renderFeatures(file)).toBe(renderFeatures(buildFeatures(root)));
  });

  it("refuses a map entry for an unknown requirement id and a requirement without a milestone", () => {
    const root = fixture({ "ZZZ-1": { paths: ["a.ts"] }, "RUN-1": { paths: ["a.ts"] } }, ["a.ts"]);
    expect(() => buildFeatures(root)).toThrow(/ZZZ-1: in the map but not in the requirements/);
  });
});

describe("featuresFileSchema", () => {
  const base = { id: "X-1", name: "n", summary: "s", status: "done", milestone: "M1", paths: ["p"], docs: [] };
  const file = (f: object) => ({ generated: "g", features: [f] });

  it("accepts a valid feature", () => {
    expect(featuresFileSchema.safeParse(file(base)).success).toBe(true);
  });
  it("requires a reason for a removed feature and paths for a done one", () => {
    expect(featuresFileSchema.safeParse(file({ ...base, status: "removed", paths: [] })).success).toBe(false);
    expect(featuresFileSchema.safeParse(file({ ...base, status: "removed", reason: "why" })).success).toBe(true);
    expect(featuresFileSchema.safeParse(file({ ...base, paths: [] })).success).toBe(false);
  });
  it("rejects an unknown status, a bad milestone and duplicate ids", () => {
    expect(featuresFileSchema.safeParse(file({ ...base, status: "wip" })).success).toBe(false);
    expect(featuresFileSchema.safeParse(file({ ...base, milestone: "M9" })).success).toBe(false);
    expect(featuresFileSchema.safeParse({ generated: "g", features: [base, base] }).success).toBe(false);
  });
});

describe("the committed docs/features.json", () => {
  const text = readFileSync(join(repo, OUTPUT_PATH), "utf8").replace(/\r\n/g, "\n");

  it("matches the schema and stays under the size limit", () => {
    expect(featuresFileSchema.safeParse(JSON.parse(text)).success).toBe(true);
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(MAX_BYTES);
  });

  it("is up to date (run pnpm features:build)", () => {
    expect(text).toBe(renderFeatures(buildFeatures(repo)));
  });

  it("uses Machine-era terms in features that are not removed", () => {
    const file = featuresFileSchema.parse(JSON.parse(text));
    for (const f of file.features.filter((x) => x.status !== "removed")) {
      expect(`${f.name} ${f.summary}`, f.id).not.toMatch(/\bPods?\b|Host Agent|Pod Host/);
    }
  });

  it("lists the Pod-era features as removed with a reason", () => {
    const file = featuresFileSchema.parse(JSON.parse(text));
    const removed = file.features.filter((x) => x.status === "removed").map((x) => x.id);
    expect(removed).toEqual(expect.arrayContaining(["POD-2", "POD-6", "POD-14", "TRK-3", "TIC-4"]));
  });
});
