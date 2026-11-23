import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSummary, SUMMARY_PATH } from "./summary";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = join(root, SUMMARY_PATH);
const text = buildSummary(root);

if (process.argv.includes("--check")) {
  const current = existsSync(out) ? readFileSync(out, "utf8").replace(/\r\n/g, "\n") : "";
  if (current !== text) {
    console.error(`${SUMMARY_PATH} is out of date. Run: pnpm features:summary`);
    process.exit(1);
  }
  console.log(`${SUMMARY_PATH} is up to date`);
} else {
  writeFileSync(out, text);
  console.log(`wrote ${SUMMARY_PATH}`);
}
