import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { statusFromEvidence, type MapEntry } from "./evidence";
import { parseMilestones, parseRequirements } from "./requirements";
import { featuresFileSchema, MAX_BYTES, type Feature, type FeaturesFile } from "./schema";

export const MAP_PATH = "packages/features/features.map.json";
export const OUTPUT_PATH = "docs/features.json";
/** The file lists the main paths and docs only; the map keeps all of them as evidence. */
const MAX_PATHS = 2;
const MAX_DOCS = 1;
const REQUIREMENTS = "docs/requirements/v1-requirements.md";
const SPECS_README = "docs/specs/README.md";

const read = (root: string, p: string) => readFileSync(join(root, p), "utf8");

/** Build the features file from the requirements, the specs README and the evidence map. */
export function buildFeatures(root: string): FeaturesFile {
  const requirements = parseRequirements(read(root, REQUIREMENTS));
  const milestones = parseMilestones(read(root, SPECS_README));
  const map = JSON.parse(read(root, MAP_PATH)) as Record<string, MapEntry>;
  const problems: string[] = [];
  const features: Feature[] = [];
  const seen = new Set<string>();

  const add = (id: string, base: { name: string; summary: string; milestone?: string }) => {
    const entry = map[id] ?? {};
    seen.add(id);
    const { status, missing } = statusFromEvidence(entry, root);
    for (const p of missing) problems.push(`${id}: path not found: ${p}`);
    for (const d of entry.docs ?? []) {
      if (!existsSync(join(root, d.split("#")[0] ?? d))) problems.push(`${id}: doc not found: ${d}`);
    }
    const milestone = entry.milestone ?? base.milestone;
    if (!milestone) {
      problems.push(`${id}: no milestone`);
      return;
    }
    const feature: Feature = {
      id,
      name: entry.name ?? base.name,
      summary: entry.summary ?? base.summary,
      status,
      milestone: milestone as Feature["milestone"],
      paths: (entry.paths ?? []).slice(0, MAX_PATHS),
      docs: (entry.docs ?? []).slice(0, MAX_DOCS),
    };
    if (entry.reason) feature.reason = entry.reason;
    features.push(feature);
  };

  for (const r of requirements) add(r.id, { ...r, milestone: milestones.get(r.id) as string });
  for (const [id, e] of Object.entries(map)) {
    if (seen.has(id)) continue;
    if (/^[A-Z]{3}-\d+$/.test(id)) problems.push(`${id}: in the map but not in the requirements`);
    else if (!e.name || !e.summary) problems.push(`${id}: an extra feature needs a name and a summary`);
    else add(id, { name: e.name, summary: e.summary });
  }
  if (problems.length > 0) throw new Error(`features map problems:\n${problems.join("\n")}`);

  return featuresFileSchema.parse({
    generated: `by pnpm features:build from ${REQUIREMENTS}, ${SPECS_README} and ${MAP_PATH}; do not edit`,
    features,
  });
}

/** One feature per line, so diffs stay readable and the file stays small. */
export function renderFeatures(file: FeaturesFile): string {
  const lines = file.features.map((f) => `    ${JSON.stringify(f)}`);
  const out = `{\n  "generated": ${JSON.stringify(file.generated)},\n  "features": [\n${lines.join(",\n")}\n  ]\n}\n`;
  const bytes = Buffer.byteLength(out);
  if (bytes > MAX_BYTES) throw new Error(`features.json is ${bytes} bytes, over the ${MAX_BYTES} limit`);
  return out;
}
