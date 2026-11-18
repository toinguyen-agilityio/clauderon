import type { Db } from "@clauderon/db";
import { FakeClock, FakeHostAgent, memorySocketPair, settle } from "@clauderon/testing";
import { createGateway, type Gateway, type GatewayOptions } from "../src/gateway";

export const HOST_SECRET = "host-agent-secret";
export const SESSION_SECRET = "session-secret";

/** A Gateway on the test database with a fake Host Agent connected to it. */
export async function startGateway(db: Db, operators: string[] = [], extra: Partial<GatewayOptions> = {}) {
  const clock = new FakeClock();
  const gateway: Gateway = createGateway({
    db,
    clock,
    hostAgentSecret: HOST_SECRET,
    podImage: "ghcr.io/acme/clauderon-pod:test",
    operators,
    sessionSecret: SESSION_SECRET,
    appSecrets: ["app-secret-value"],
    log: () => {},
    ...extra,
  });
  await gateway.link.start();
  gateway.watch.start();
  const agent = new FakeHostAgent();
  const [agentSide, gatewaySide] = memorySocketPair();
  gateway.link.attach(gatewaySide, `Bearer ${HOST_SECRET}`);
  agent.connect(agentSide);
  agent.beatEvery(clock);

  /** Connects the fake Host Agent again on a new socket, as after a drop. */
  const reconnect = (hello: Parameters<FakeHostAgent["connect"]>[1] = {}) => {
    const [a, g] = memorySocketPair();
    gateway.link.attach(g, `Bearer ${HOST_SECRET}`);
    agent.connect(a, hello);
    return g;
  };

  /** Lets messages travel and every queue drain. */
  const flush = async () => {
    for (let i = 0; i < 12; i++) {
      await settle();
      await gateway.link.idle();
      await gateway.engine.idle();
    }
  };
  await flush();
  return { gateway, agent, clock, flush, reconnect, gatewaySide };
}

/**
 * A second Gateway on the same database, as after a restart or deploy: a new
 * process with an empty outbox. The same fake Host Agent reconnects to it.
 */
export async function restartGateway(db: Db, agent: FakeHostAgent, liveAttempts: string[], extra: Partial<GatewayOptions> = {}) {
  const clock = new FakeClock();
  const gateway: Gateway = createGateway({
    db,
    clock,
    hostAgentSecret: HOST_SECRET,
    podImage: "ghcr.io/acme/clauderon-pod:test",
    operators: [],
    sessionSecret: SESSION_SECRET,
    appSecrets: ["app-secret-value"],
    log: () => {},
    ...extra,
  });
  await gateway.link.start();
  gateway.watch.start();
  const [agentSide, gatewaySide] = memorySocketPair();
  gateway.link.attach(gatewaySide, `Bearer ${HOST_SECRET}`);
  agent.connect(agentSide, { liveAttempts });
  agent.beatEvery(clock);
  const flush = async () => {
    for (let i = 0; i < 12; i++) {
      await settle();
      await gateway.link.idle();
      await gateway.engine.idle();
    }
  };
  await flush();
  return { gateway, clock, flush, gatewaySide };
}
