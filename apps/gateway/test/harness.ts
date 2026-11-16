import type { Db } from "@clauderon/db";
import { FakeClock, FakeHostAgent, memorySocketPair, settle } from "@clauderon/testing";
import { createGateway, type Gateway } from "../src/gateway";

export const HOST_SECRET = "host-agent-secret";
export const SESSION_SECRET = "session-secret";

/** A Gateway on the test database with a fake Host Agent connected to it. */
export async function startGateway(db: Db, operators: string[] = []) {
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
  });
  await gateway.link.start();
  const agent = new FakeHostAgent();
  const [agentSide, gatewaySide] = memorySocketPair();
  gateway.link.attach(gatewaySide, `Bearer ${HOST_SECRET}`);
  agent.connect(agentSide);

  /** Lets messages travel and every queue drain. */
  const flush = async () => {
    for (let i = 0; i < 12; i++) {
      await settle();
      await gateway.link.idle();
      await gateway.engine.idle();
    }
  };
  await flush();
  return { gateway, agent, clock, flush };
}
