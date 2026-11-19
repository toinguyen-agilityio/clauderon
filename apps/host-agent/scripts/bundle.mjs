// Builds the Agent as one file (ADR 0007): dist/agent.mjs, which the web app
// serves to installers and to Agents updating themselves, and dist/agent.json
// with its version and SHA-256. Run with `pnpm --filter @clauderon/host-agent build`.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const PLACEHOLDER = "__CLAUDERON_BUILD_PLACEHOLDER__";
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

const openPr = await readFile(join(root, "bin", "clauderon-open-pr"), "utf8");
const result = await build({
  entryPoints: [join(root, "src", "main.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  write: false,
  // ws loads these optional native speedups with require() inside try/catch.
  external: ["bufferutil", "utf-8-validate"],
  // Bundled CommonJS (ws) calls require() for Node's own modules.
  banner: { js: 'import { createRequire as __clauderonRequire } from "node:module"; const require = __clauderonRequire(import.meta.url);' },
  define: {
    __AGENT_BUILD__: JSON.stringify(PLACEHOLDER),
    __OPEN_PR_SCRIPT__: JSON.stringify(openPr),
  },
  legalComments: "none",
});

// The build id is the hash of the code itself, so the same source always gives the same version.
const text = result.outputFiles[0].text;
const buildId = sha256(text).slice(0, 10);
const bundle = text.replaceAll(PLACEHOLDER, buildId);
const versionMatch = /export const AGENT_VERSION = "([^"]+)"/.exec(await readFile(join(root, "src", "version.ts"), "utf8"));
if (!versionMatch) throw new Error("AGENT_VERSION not found in src/version.ts");
const manifest = { version: `${versionMatch[1]}+${buildId}`, sha256: sha256(bundle), size: Buffer.byteLength(bundle) };

await mkdir(dist, { recursive: true });
await writeFile(join(dist, "agent.mjs"), bundle);
await writeFile(join(dist, "agent.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`dist/agent.mjs ${manifest.version} (${Math.round(manifest.size / 1024)} KB)`);
