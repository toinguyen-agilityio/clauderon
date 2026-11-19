import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { systemClock } from "@clauderon/core";
import { Agent } from "./agent";
import { findBash, localSystem } from "./local-system";
import { checkLogins, registerLoginHandlers } from "./logins";
import { registerNodeHandlers, type NodeHandles } from "./nodes";
import { pair } from "./pair";
import { acquireLock, fileStateStore, pairingFile, readMachineFacts, wsConnector } from "./runtime";
import { installService, uninstallService } from "./service";
import { registerWorkspaceHandlers } from "./workspace";

const VERSION = "0.3.0";

const USAGE = `Clauderon Agent ${VERSION}

  pair <url> [--no-start]   pair this computer as your Machine, then run the Agent
                            <url> is the web app (https://…) or the Gateway (wss://…)
  run                       run the Agent (also: start)
  install-service           run the Agent whenever you are logged in
  uninstall-service         stop that`;

// The Agent's own directory (ADR 0006): its pairing, link state, clones and worktrees.
const home = process.env.CLAUDERON_HOME ?? join(homedir(), ".clauderon");
const binDir = resolve(fileURLToPath(new URL("../bin", import.meta.url)));
const repo = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const pairing = pairingFile(home);
const log = (message: string) => console.log(message);
const interactive = process.stdin.isTTY === true && process.stdout.isTTY === true;

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
  const system = localSystem({ binDir });
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

  const system = localSystem({ binDir });
  let nodes: NodeHandles | null = null;
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
    onWelcome: () => nodes?.killOrphans(),
    onUnpaired: (code) => {
      log(`The Gateway no longer accepts this computer (${code}): it was unpaired or another computer was paired. Run pair again.`);
      // A clean exit: a service restarts the Agent only after a crash.
      void lock.release().finally(() => process.exit(0));
    },
  });

  registerLoginHandlers(agent, system);
  registerWorkspaceHandlers(agent, system, { home, log });
  nodes = registerNodeHandlers(agent, system, { log, knownSecrets: [paired.token], home });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      agent.stop();
      void lock.release().finally(() => process.exit(0));
    });
  }

  await agent.start();
  log(`Agent ${VERSION} running for ${paired.gatewayUrl}, home ${home}. Leave it running to take Runs (Ctrl-C stops it).`);
}

async function installCommand(): Promise<void> {
  if (!(await pairing.load())) throw new Error("pair this computer first: pair <url> --no-start, then install-service");
  const logs = await installService({ node: process.execPath, repo, home });
  log(`The Agent now runs whenever you are logged in. Log: ${logs}`);
}

const [command = "run", ...args] = process.argv.slice(2);
try {
  if (command === "pair") await pairCommand(args);
  else if (command === "run" || command === "start") await runCommand();
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
