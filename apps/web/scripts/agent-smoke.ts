// Smoke test of the Agent install on this operating system (ADR 0007), run
// by CI on macOS, Linux and Windows: serves the built bundle and the
// installer like the web app does, runs the one-line install exactly as a
// Member would (without Pairing or the service), then the doctor, and checks
// that the Agent's own Node, the bundle, bash and the tools all work here.
//
//   pnpm --filter @clauderon/host-agent build
//   pnpm --filter @clauderon/web exec tsx scripts/agent-smoke.ts
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentBundle, agentManifest, installPs1, installSh } from "../src/server/agent-install";

const WINDOWS = process.platform === "win32";

const manifest = await agentManifest();
const bundle = await agentBundle();
if (!manifest || !bundle) throw new Error("build the Agent first: pnpm --filter @clauderon/host-agent build");

const server = createServer((req, res) => {
  const web = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const send = (type: string, body: string | Uint8Array) => res.writeHead(200, { "content-type": type }).end(body);
  if (req.url === "/agent/install.sh") return send("text/plain", installSh({ webUrl: web }));
  if (req.url === "/agent/install.ps1") return send("text/plain", installPs1({ webUrl: web }));
  if (req.url === "/agent/agent.json") return send("application/json", JSON.stringify(manifest));
  if (req.url === "/agent/agent.mjs") return send("text/javascript", new Uint8Array(bundle));
  res.writeHead(404).end();
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const web = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const home = mkdtempSync(join(tmpdir(), "clauderon-smoke-"));
const env = { ...process.env, CLAUDERON_HOME: home, CLAUDERON_SKIP_PAIR: "1", CLAUDERON_SKIP_SERVICE: "1", CLAUDERON_NO_BROWSER: "1" };

// Asynchronously: the installer downloads from this very server.
const [file, args]: [string, string[]] = WINDOWS
  ? ["powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `irm ${web}/agent/install.ps1 | iex`]]
  : ["sh", ["-c", `curl -fsSL ${web}/agent/install.sh | sh`]];
const child = await new Promise<number>((resolve) => {
  spawn(file, args, { env, stdio: "inherit" }).on("close", (code) => resolve(code ?? -1));
});
if (child !== 0) throw new Error(`the installer exited ${child}`);

const node = WINDOWS ? join(home, "node", "node.exe") : join(home, "node", "bin", "node");
const agent = join(home, "agent", "agent.mjs");
const nodeVersion = execFileSync(node, ["-v"], { encoding: "utf8" }).trim();
const doctor = spawnSync(node, [agent, "doctor", "--json", "--no-fail"], { env, encoding: "utf8" });
if (doctor.status !== 0) throw new Error(`the doctor exited ${doctor.status}: ${doctor.stderr}`);
const report = JSON.parse(doctor.stdout) as { checks: { id: string; status: string; detail?: string }[] };
server.close();

const status = (id: string) => report.checks.find((c) => c.id === id);
const problems: string[] = [];
if (!nodeVersion.startsWith("v22.")) problems.push(`the Agent's Node is ${nodeVersion}, not 22`);
for (const id of ["tool.git", "tool.gh", ...(WINDOWS ? ["tool.bash"] : [])]) {
  if (status(id)?.status !== "ok") problems.push(`${id}: ${JSON.stringify(status(id))}`);
}
if (status("agent.version")?.detail !== manifest.version) problems.push(`the installed Agent is not ${manifest.version}`);
if (status("gateway.paired")?.status !== "fail") problems.push("an unpaired install should fail the pairing check");

for (const check of report.checks) console.log(`${check.status.padEnd(4)} ${check.id}${check.detail ? `  ${check.detail}` : ""}`);
if (problems.length > 0) {
  console.error(`\nAgent smoke test failed on ${process.platform}:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nAgent smoke test passed on ${process.platform}-${process.arch} with Node ${nodeVersion}.`);
