import type { Clock, TimerHandle } from "@clauderon/core";
import { runningRuns, type Db } from "@clauderon/db";
import type { Payload } from "@clauderon/protocol";
import type { MachineLinks } from "./machine-link";
import type { RunEngine } from "./run-engine";

/** No heartbeat for this long and a Machine counts as unreachable (RUN-12). */
export const HEARTBEAT_TIMEOUT_MS = 30_000;

export type MachineWatchOptions = { db: Db; links: MachineLinks; engine: RunEngine; clock: Clock; timeoutMs?: number };

/**
 * The heartbeat watcher (spec M3 §6), one timer per Machine, reset by every
 * hello and heartbeat:
 * - it fires after 30 s of silence: the Machine's Real Running Runs become
 *   Interrupted and a half-open socket is dropped so its Agent says hello again;
 * - on a hello after an Agent restart, or the first one since this Gateway
 *   booted, Attempts the Agent does not list as live are lost;
 * - a short drop between the same two processes checks nothing: the resume
 *   buffers resend what was missed.
 * At boot, each Machine with Running Runs gets 30 s for its hello.
 */
export class MachineWatch {
  private timers = new Map<string, TimerHandle>();
  /** Machines that said hello since this Gateway booted. */
  private seen = new Set<string>();

  constructor(private readonly opts: MachineWatchOptions) {}

  async start(): Promise<void> {
    this.opts.links.onHello((machineId, hello, info) => this.hello(machineId, hello, info.processChanged));
    this.opts.links.onHeartbeat((machineId) => this.arm(machineId));
    for (const r of await runningRuns(this.opts.db)) if (r.machineId) this.arm(r.machineId);
  }

  stop(): void {
    for (const timer of this.timers.values()) this.opts.clock.clearTimeout(timer);
    this.timers.clear();
  }

  private arm(machineId: string): void {
    const old = this.timers.get(machineId);
    if (old) this.opts.clock.clearTimeout(old);
    this.timers.set(
      machineId,
      this.opts.clock.setTimeout(() => void this.expired(machineId), this.opts.timeoutMs ?? HEARTBEAT_TIMEOUT_MS),
    );
  }

  private async expired(machineId: string): Promise<void> {
    this.timers.delete(machineId);
    this.opts.links.drop(machineId, "no heartbeat");
    await this.opts.engine.machineLost(machineId, "Machine unreachable");
  }

  private async hello(machineId: string, hello: Payload<"hello">, processChanged: boolean): Promise<void> {
    this.arm(machineId);
    const gatewayRestarted = !this.seen.has(machineId);
    this.seen.add(machineId);
    await this.opts.engine.machineBack(machineId, {
      liveAttempts: hello.liveAttempts,
      checkLive: processChanged || gatewayRestarted,
      reason: processChanged ? "Agent restarted" : "Lost while the Gateway restarted",
    });
  }
}
