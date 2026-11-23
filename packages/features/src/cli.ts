import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFeatures, OUTPUT_PATH, renderFeatures } from "./build";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = join(root, OUTPUT_PATH);
const text = renderFeatures(buildFeatures(root));

if (process.argv.includes("--check")) {
  const current = existsSync(out) ? readFileSync(out, "utf8").replace(/\r\n/g, "\n") : "";
  if (current !== text) {
    console.error(`${OUTPUT_PATH} is out of date. Run: pnpm features:build`);
    process.exit(1);
  }
  console.log(`${OUTPUT_PATH} is up to date`);
} else {
  writeFileSync(out, text);
  console.log(`wrote ${OUTPUT_PATH}`);
}
