import type { Db } from "@clauderon/db";
import { FakeAgent, FakeClock, memorySocketPair, settle, type HelloOverrides } from "@clauderon/testing";
import { createGateway, type Gateway, type GatewayOptions } from "../src/gateway";

export const SESSION_SECRET = "session-secret";

function newGateway(db: Db, clock: FakeClock, operators: string[], extra: Partial<GatewayOptions>): Gateway {
  return createGateway({
    db,
    clock,
    operators,
    sessionSecret: SESSION_SECRET,
    appSecrets: ["app-secret-value"],
    log: () => {},
    ...extra,
  });
}

/** Lets messages travel and every queue drain. */
function flusher(gateway: Gateway) {
  return async () => {
    for (let i = 0; i < 12; i++) {
      await settle();
      await gateway.links.idle();
      await gateway.engine.idle();
    }
  };
}

/**
 * A Gateway on the test database with a fake Agent connected for one paired
 * Machine; `token` is the one the Machine was paired with (see `machineRow`).
 */
export async function startGateway(db: Db, token: string, operators: string[] = [], extra: Partial<GatewayOptions> = {}) {
  const clock = new FakeClock();
  const gateway = newGateway(db, clock, operators, extra);
  await gateway.start();
  const agent = new FakeAgent();
  const [agentSide, gatewaySide] = memorySocketPair();
  gateway.links.attach(gatewaySide, `Bearer ${token}`);
  agent.connect(agentSide);
  agent.beatEvery(clock);

  /** Connects the fake Agent again on a new socket, as after a drop. */
  const reconnect = (hello: HelloOverrides = {}) => {
    const [a, g] = memorySocketPair();
    gateway.links.attach(g, `Bearer ${token}`);
    agent.connect(a, hello);
    return g;
  };

  const flush = flusher(gateway);
  await flush();
  return { gateway, agent, clock, flush, reconnect, gatewaySide };
}

/**
 * A second Gateway on the same database, as after a restart or deploy: a new
 * process with an empty outbox. The same fake Agent reconnects to it.
 */
export async function restartGateway(db: Db, token: string, agent: FakeAgent, liveAttempts: string[], extra: Partial<GatewayOptions> = {}) {
  const clock = new FakeClock();
  const gateway = newGateway(db, clock, [], extra);
  await gateway.start();
  const [agentSide, gatewaySide] = memorySocketPair();
  gateway.links.attach(gatewaySide, `Bearer ${token}`);
  agent.connect(agentSide, { liveAttempts });
  agent.beatEvery(clock);
  const flush = flusher(gateway);
  await flush();
  return { gateway, clock, flush, gatewaySide };
}
