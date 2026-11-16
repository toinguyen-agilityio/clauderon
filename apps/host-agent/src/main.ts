import { randomUUID } from "node:crypto";
import { systemClock } from "@clauderon/core";
import { HostAgent } from "./agent.js";
import { fileStateStore, readHostFacts, wsConnector } from "./runtime.js";

const VERSION = "0.1.0";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const stateDir = process.env.HOST_AGENT_STATE_DIR ?? "/var/lib/clauderon-host-agent";

const agent = new HostAgent({
  url: required("GATEWAY_URL"),
  secret: required("HOST_AGENT_SECRET"),
  clock: systemClock,
  connect: wsConnector,
  facts: () => readHostFacts(stateDir),
  state: fileStateStore(stateDir),
  // A new id per process: the Gateway tells a restart from a reconnect by it.
  processId: randomUUID(),
  version: VERSION,
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    agent.stop();
    process.exit(0);
  });
}

await agent.start();
console.log(`host agent ${VERSION} started`);
