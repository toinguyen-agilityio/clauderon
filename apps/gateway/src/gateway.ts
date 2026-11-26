import type { Clock } from "@clauderon/core";
import type { Db } from "@clauderon/db";
import { BrowserHub } from "./browser-hub";
import { FlowDrafts } from "./flow-drafts";
import { LiveHub } from "./live-hub";
import { LogRetention } from "./log-retention";
import { MachineLinks } from "./machine-link";
import { MachineWatch } from "./machine-watch";
import { MachineService } from "./machines";
import { RunNotices } from "./notices";
import { RunEngine } from "./run-engine";

export type GatewayOptions = {
  db: Db;
  clock: Clock;
  operators: readonly string[];
  sessionSecret: string;
  /** Secret values masked out of every stored log line (NFR-1). */
  appSecrets: readonly string[];
  log?: (message: string) => void;
  /** Heartbeat timeout; default 30 s (RUN-12). */
  heartbeatTimeoutMs?: number;
};

/** Every Gateway part, wired to the Agents' messages. */
export function createGateway(opts: GatewayOptions) {
  const { db, clock, log } = opts;
  const live = new LiveHub(db);
  const links = new MachineLinks({ db, clock, log });
  const drafts = new FlowDrafts({ db, links, clock, secrets: opts.appSecrets, log });
  const hub = new BrowserHub({ db, operators: opts.operators, sessionSecret: opts.sessionSecret, clock, live, drafts, log });
  const notices = new RunNotices({ db, notifyMember: (email, event) => hub.notifyMember(email, event), log });
  const engine = new RunEngine({
    db,
    links,
    clock,
    live,
    notices,
    secrets: opts.appSecrets,
    log,
  });
  const watch = new MachineWatch({ db, links, engine, clock, timeoutMs: opts.heartbeatTimeoutMs });
  const machines = new MachineService({ db, links, engine, live, notices, log });
  const retention = new LogRetention({ db, clock, log });

  links.on("machine.logins", (p, machineId) => machines.logins(p, machineId));
  links.on("machine.doctor", (p, machineId) => machines.doctor(p, machineId));
  links.on("workspace.ready", (p) => engine.workspaceReady(p));
  links.on("workspace.failed", (p) => engine.workspaceFailed(p));
  links.on("workspace.cleaned", (p) => engine.workspaceCleaned(p));
  links.on("node.log", (p) => engine.nodeLog(p));
  links.on("node.usage", (p) => engine.nodeUsage(p));
  links.on("node.turns", (p, machineId) => engine.nodeTurns(p, machineId));
  links.on("node.result", (p) => engine.nodeResult(p));
  links.on("flow.drafted", (p, machineId) => drafts.drafted(p, machineId));
  // A new Agent process, e.g. right after Pairing: its logins are unknown until checked (POD-5).
  links.onHello((machineId, _hello, { processChanged }) => {
    if (processChanged) links.send(machineId, "machine.checkLogins", {});
  });

  /** Loads the links, arms the boot wait (spec M3 §6). */
  const start = async () => {
    await links.start();
    await watch.start();
  };

  return { links, hub, live, notices, drafts, engine, machines, watch, retention, start };
}

export type Gateway = ReturnType<typeof createGateway>;
