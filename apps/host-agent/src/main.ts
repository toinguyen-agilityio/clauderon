import { randomUUID } from "node:crypto";
import { systemClock } from "@clauderon/core";
import { HostAgent } from "./agent";
import { dockerEngine } from "./docker-engine";
import { podStatuses, registerNodeHandlers, type NodeHandles } from "./nodes";
import { registerPodHandlers } from "./pods";
import { registerTerminalHandlers } from "./terminals";
import { registerWorkspaceHandlers } from "./workspace";
import { fileStateStore, readHostFacts, wsConnector } from "./runtime";

const VERSION = "0.1.0";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const stateDir = process.env.HOST_AGENT_STATE_DIR ?? "/var/lib/clauderon-host-agent";

const secret = required("HOST_AGENT_SECRET");
const docker = dockerEngine();
const log = (message: string) => console.log(message);
let nodes: NodeHandles | null = null;
const agent = new HostAgent({
  url: required("GATEWAY_URL"),
  secret,
  clock: systemClock,
  connect: wsConnector,
  facts: () => readHostFacts(stateDir),
  state: fileStateStore(stateDir),
  // A new id per process: the Gateway tells a restart from a reconnect by it.
  processId: randomUUID(),
  version: VERSION,
  // Spec M3 §6: hello lists live Attempts, heartbeats carry Pod states, and
  // every welcome kills Node processes this process holds no handle for.
  runningAttempts: () => nodes?.running() ?? [],
  podStatuses: () => podStatuses(docker),
  onWelcome: () => nodes?.killOrphans(),
});

registerPodHandlers(agent, docker, log);
registerWorkspaceHandlers(agent, docker, log);
nodes = registerNodeHandlers(agent, docker, { log, knownSecrets: [secret] });
registerTerminalHandlers(agent, docker, log);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    agent.stop();
    process.exit(0);
  });
}

await agent.start();
console.log(`host agent ${VERSION} started`);
