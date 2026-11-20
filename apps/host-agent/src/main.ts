import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { openSync } from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { systemClock } from "@clauderon/core";
import type { DoctorReport } from "@clauderon/protocol";
import { Agent } from "./agent";
import { runDoctor } from "./doctor";
import { checkGateway, type GatewayCheck } from "./gateway-check";
import { findBash, localSystem } from "./local-system";
import { checkLogins, registerLoginHandlers, type LoginHooks, type Logins } from "./logins";
import { registerNodeHandlers, type NodeHandles } from "./nodes";
import { pair } from "./pair";
import { acquireLock, fileStateStore, pairingFile, readMachineFacts, wsConnector, type Pairing } from "./runtime";
import { installService, serviceInstalled, uninstallService, type ServiceSpec } from "./service";
import type { System } from "./system";
import { refreshToolPath } from "./tool-path";
import { updateAgent } from "./update";
import { BUILD, OPEN_PR_SCRIPT, VERSION } from "./version";
import { registerWorkspaceHandlers } from "./workspace";

const USAGE = `Clauderon Agent ${VERSION}

  pair <url> [--no-start]   pair this computer as your Machine, then run the Agent
                            <url> is the web app (https://…) or the Gateway (wss://…)
      --if-needed           keep a pairing the Gateway still accepts
  run                       run the Agent (also: start)
  doctor [--json] [--no-fail]
                            check what this computer needs to take Runs
  install-service           run the Agent whenever you are logged in
  uninstall-service         stop that`;

// The Agent's own directory (ADR 0006): its pairing, link state, clones and worktrees.
const home = process.env.CLAUDERON_HOME ?? join(homedir(), ".clauderon");
// Bundled (ADR 0007), this file is <home>/agent/agent.mjs; from a checkout, src/main.ts run with tsx.
const selfPath = fileURLToPath(import.meta.url);
const pairing = pairingFile(home);
const log = (message: string) => console.log(message);
const interactive = process.stdin.isTTY === true && process.stdout.isTTY === true;

/** The Agent's own tools (`clauderon-open-pr`): written out of the bundle into <home>/bin, or bin/ in a checkout. */
async function agentBinDir(): Promise<string> {
  if (!OPEN_PR_SCRIPT) return resolve(fileURLToPath(new URL("../bin", import.meta.url)));
  const dir = join(home, "bin");
  await mkdir(dir, { recursive: true });
  const file = join(dir, "clauderon-open-pr");
  await writeFile(file, OPEN_PR_SCRIPT);
  await chmod(file, 0o755);
  return dir;
}

/** The Gateway's answer for a pairing; null when there is none. */
const gatewayOf = (paired: Pairing | null): Promise<GatewayCheck | null> => (paired ? checkGateway(paired.gatewayUrl, paired.token) : Promise.resolve(null));

async function doctorFor(system: System, logins: Logins, gateway: GatewayCheck | null): Promise<DoctorReport> {
  return runDoctor({ system, platform: process.platform, home, logins, gateway, serviceInstalled: await serviceInstalled().catch(() => null), version: VERSION });
}

/** Opens a page in the default browser; failing is fine, the URL is printed too. */
function openUrl(url: string): void {
  if (process.env.CLAUDERON_NO_BROWSER) return;
  const [file, args] =
    process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  spawn(file, args, { stdio: "ignore", detached: true, windowsHide: true })
    .on("error", () => {})
    .unref();
}

/** Runs a login command in this terminal, in the Member's login shell. */
function runInTerminal(command: string): Promise<number> {
  return new Promise((done) => {
    spawn(findBash(), ["-lc", command], { stdio: "inherit" })
      .on("error", () => done(-1))
      .on("close", (code) => done(code ?? -1));
  });
}

async function ask(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${question} [Y/n] `)).trim().toLowerCase();
  rl.close();
  return answer === "" || answer === "y" || answer === "yes";
}

/**
 * Runs use the Member's own Claude Code and gh logins (POD-5): check both
 * before pairing and offer to log in right here, so the Machine is Ready the
 * moment it connects.
 */
async function loginsFirst(): Promise<void> {
  await refreshToolPath();
  const system = localSystem({ binDir: await agentBinDir() });
  let logins = await checkLogins(system);
  const steps = [
    { ok: () => logins.gh, name: "GitHub (gh)", command: "gh auth login --web --git-protocol https" },
    { ok: () => logins.claude, name: "Claude Code", command: "claude auth login" },
  ];
  for (const step of steps) {
    if (step.ok()) continue;
    if (!interactive) {
      log(`${step.name} is not logged in on this computer. Runs need it: run \`${step.command}\` later.`);
      continue;
    }
    if (await ask(`${step.name} is not logged in on this computer. Log in now?`)) {
      await runInTerminal(step.command);
      logins = await checkLogins(system);
      if (!step.ok()) log(`${step.name} still reads as logged out; you can log in later and press Check logins on your Machine's page.`);
    }
  }
  if (logins.gh && logins.ghAccount) log(`gh: logged in as ${logins.ghAccount}`);
}

async function pairCommand(args: string[]): Promise<void> {
  const url = args.find((a) => !a.startsWith("--")) ?? process.env.CLAUDERON_URL ?? process.env.GATEWAY_URL;
  if (!url) throw new Error(`usage: pair <url>, e.g. pair https://clauderon.example.com\n\n${USAGE}`);
  if (args.includes("--if-needed")) {
    // Running the installer again keeps a pairing that still works.
    const kept = await pairing.load();
    if ((await gatewayOf(kept))?.state === "paired") {
      log(`This computer is already paired with ${kept!.gatewayUrl}.`);
      return;
    }
  }
  await loginsFirst();
  const { hostname, os, arch } = await readMachineFacts(home);
  const paired = await pair({ url, machine: { hostname, os, arch }, clock: systemClock, print: log, openUrl });
  await pairing.save(paired);
  // A new Machine token starts a new link: numbering begins again.
  await fileStateStore(home).save({ lastReceivedId: 0 });
  log(`Paired as ${hostname}.`);
  if (args.includes("--no-start")) {
    log("Start the Agent with: run (or install-service to run it whenever you are logged in)");
    return;
  }
  await runCommand();
}

async function runCommand(): Promise<void> {
  const paired = await pairing.load();
  if (!paired) throw new Error(`this computer is not paired yet: run pair <url> first (looked in ${home})`);
  // Two Agents with one token would keep replacing each other's connection.
  const lock = await acquireLock(home);
  if (!lock.ok) throw new Error(`an Agent already runs for ${home} (process ${lock.pid}); stop it first, or use uninstall-service`);

  await refreshToolPath();
  const system = localSystem({ binDir: await agentBinDir() });
  let nodes: NodeHandles | null = null;
  let webUrl = process.env.CLAUDERON_WEB_URL ?? paired.webUrl ?? null;
  const agent = new Agent({
    url: process.env.GATEWAY_URL ?? paired.gatewayUrl,
    token: paired.token,
    clock: systemClock,
    connect: wsConnector,
    facts: () => readMachineFacts(home),
    state: fileStateStore(home),
    // A new id per process: the Gateway tells a restart from a reconnect by it.
    processId: randomUUID(),
    version: VERSION,
    // Spec M3 §6: hello lists live Attempts, and every welcome kills Node
    // processes an earlier Agent process left behind.
    runningAttempts: () => nodes?.running() ?? [],
    onWelcome: async () => {
      await nodes?.killOrphans();
      // The Gateway asks for the logins (and so the doctor) when a new Agent process says hello.
      await maybeUpdate();
    },
    onUnpaired: (code) => {
      log(`The Gateway no longer accepts this computer (${code}): it was unpaired or another computer was paired. Run pair again.`);
      // A clean exit: a service restarts the Agent only after a crash.
      void lock.release().finally(() => process.exit(0));
    },
  });

  const hooks: LoginHooks = {
    before: () => refreshToolPath(),
    after: async (logins) => {
      const gateway = await gatewayOf(paired);
      if (gateway?.state === "paired" && gateway.webUrl) webUrl = gateway.webUrl;
      agent.send("machine.doctor", await doctorFor(system, logins, gateway));
    },
  };

  /** A bundled Agent takes the web app's bundle once no Node runs (ADR 0007). */
  const maybeUpdate = async (): Promise<void> => {
    if (!BUILD || !webUrl || process.env.CLAUDERON_NO_UPDATE) return;
    if ((nodes?.running().length ?? 0) > 0) {
      setTimeout(() => void maybeUpdate(), 5 * 60_000).unref();
      return;
    }
    const result = await updateAgent({ webUrl, current: VERSION, target: selfPath });
    if (!result.updated) {
      if (result.reason !== "up to date") log(`Agent update skipped: ${result.reason}`);
      return;
    }
    // Run by hand in a terminal, it keeps going: the Member restarts it when they like.
    if (!process.env.CLAUDERON_SERVICE) {
      log(`Updated the Agent to ${result.version}; restart it to use the new version.`);
      return;
    }
    log(`Updated the Agent to ${result.version}; restarting.`);
    restart();
  };

  /** Starts the updated file: launchd and systemd restart an Agent that exits non-zero; the Windows Run key does not, so it starts its successor. */
  const restart = () => {
    agent.stop();
    void lock.release().finally(() => {
      if (process.platform !== "win32") process.exit(75);
      const out = openSync(join(home, "agent.log"), "a");
      spawn(process.execPath, [selfPath, "run"], { detached: true, stdio: ["ignore", out, out], windowsHide: true }).unref();
      process.exit(0);
    });
  };

  registerLoginHandlers(agent, system, hooks);
  registerWorkspaceHandlers(agent, system, { home, log });
  nodes = registerNodeHandlers(agent, system, { log, knownSecrets: [paired.token], home });

  // As a service nobody is at its terminal: Ctrl-C or a closing console (SIGINT,
  // SIGHUP, SIGBREAK) from some other window must not stop it, only SIGTERM does.
  const stopSignals = process.env.CLAUDERON_SERVICE ? (["SIGTERM"] as const) : (["SIGINT", "SIGTERM"] as const);
  for (const signal of stopSignals) {
    process.on(signal, () => {
      agent.stop();
      void lock.release().finally(() => process.exit(0));
    });
  }
  if (process.env.CLAUDERON_SERVICE) for (const signal of ["SIGINT", "SIGHUP", "SIGBREAK"] as const) process.on(signal, () => {});

  await agent.start();
  log(`Agent ${VERSION} running for ${paired.gatewayUrl}, home ${home}. Leave it running to take Runs (Ctrl-C stops it).`);
}

async function installCommand(): Promise<void> {
  if (!(await pairing.load())) throw new Error("pair this computer first: pair <url> --no-start, then install-service");
  const path = process.env.PATH;
  const repo = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
  const spec: ServiceSpec = BUILD
    ? { node: process.execPath, args: [selfPath, "run"], cwd: home, home, path }
    : { node: process.execPath, args: ["--import", "tsx", join(repo, "apps", "host-agent", "src", "main.ts"), "run"], cwd: repo, home, path };
  const logs = await installService(spec);
  log(`The Agent now runs whenever you are logged in. Log: ${logs}`);
}

const MARK = { ok: "\u2713", warn: "!", fail: "\u2717" } as const;

/** Checks this computer and prints what to fix; exits 1 when it cannot take Runs, unless --no-fail. */
async function doctorCommand(args: string[]): Promise<void> {
  await refreshToolPath();
  const system = localSystem({ binDir: await agentBinDir() });
  const report = await doctorFor(system, await checkLogins(system), await gatewayOf(await pairing.load()));
  if (args.includes("--json")) log(JSON.stringify(report, null, 2));
  else {
    for (const check of report.checks) {
      log(`${MARK[check.status]} ${check.title}${check.detail ? `  ${check.detail}` : ""}`);
      if (check.fix) log(`    fix: ${check.fix}`);
    }
  }
  if (!args.includes("--no-fail") && report.checks.some((c) => c.status === "fail")) process.exitCode = 1;
}

const [command = "run", ...args] = process.argv.slice(2);
try {
  if (command === "pair") await pairCommand(args);
  else if (command === "run" || command === "start") await runCommand();
  else if (command === "doctor") await doctorCommand(args);
  else if (command === "install-service") await installCommand();
  else if (command === "uninstall-service") {
    await uninstallService();
    log("The Agent service is removed.");
  } else if (command === "help" || command === "--help") log(USAGE);
  else throw new Error(`unknown command ${command}\n\n${USAGE}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
