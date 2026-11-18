import type { Clock } from "@clauderon/core";
import type { Db } from "@clauderon/db";
import { BrowserHub } from "./browser-hub";
import { HostLink } from "./host-link";
import { HostWatch } from "./host-watch";
import { LiveHub } from "./live-hub";
import { PodService } from "./pods";
import { RunEngine } from "./run-engine";
import { TerminalHub } from "./terminals";

export type GatewayOptions = {
  db: Db;
  clock: Clock;
  hostAgentSecret: string;
  podImage: string;
  operators: readonly string[];
  sessionSecret: string;
  /** Secret values masked out of every stored log line (NFR-1). */
  appSecrets: readonly string[];
  /** Chance that a simulated Dry-run Node fails, 0 to 1 (DRY_RUN_FAILURE_RATE). */
  dryRunFailureRate?: number;
  random?: () => number;
  log?: (message: string) => void;
  /** Heartbeat timeout; default 30 s (RUN-12). */
  heartbeatTimeoutMs?: number;
};

/** Every Gateway part, wired to the Host Agent's messages. */
export function createGateway(opts: GatewayOptions) {
  const { db, clock, log } = opts;
  const live = new LiveHub(db);
  const link = new HostLink({ db, secret: opts.hostAgentSecret, podImage: opts.podImage, clock, log });
  const hub = new BrowserHub({ db, operators: opts.operators, sessionSecret: opts.sessionSecret, clock, live });
  const engine = new RunEngine({
    db,
    link,
    clock,
    live,
    secrets: opts.appSecrets,
    dryRunFailureRate: opts.dryRunFailureRate,
    random: opts.random,
    log,
    hostConnected: () => link.connected,
  });
  const watch = new HostWatch({ link, engine, clock, timeoutMs: opts.heartbeatTimeoutMs });
  const pods = new PodService({ db, link, engine, log });
  const terminals = new TerminalHub({ db, hub, link, clock });

  link.on("pod.status", (p) => pods.status(p));
  link.on("pod.logins", (p) => pods.logins(p));
  link.on("workspace.ready", (p) => engine.workspaceReady(p));
  link.on("workspace.failed", (p) => engine.workspaceFailed(p));
  link.on("node.log", (p) => engine.nodeLog(p));
  link.on("node.usage", (p) => engine.nodeUsage(p));
  link.on("node.result", (p) => engine.nodeResult(p));
  link.on("terminal.output", (p) => terminals.output(p));
  link.on("terminal.closed", (p) => terminals.closed(p));
  link.onHeartbeat((p) => pods.heartbeat(p));

  return { link, hub, live, engine, pods, terminals, watch };
}

export type Gateway = ReturnType<typeof createGateway>;
