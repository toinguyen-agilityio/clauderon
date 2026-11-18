import type { Clock, TimerHandle } from "@clauderon/core";
import type { Payload } from "@clauderon/protocol";
import type { HostLink } from "./host-link";
import type { RunEngine } from "./run-engine";

/** No heartbeat for this long and the Pod Host counts as unreachable (RUN-12). */
export const HEARTBEAT_TIMEOUT_MS = 30_000;

export type HostWatchOptions = { link: HostLink; engine: RunEngine; clock: Clock; timeoutMs?: number };

/**
 * The heartbeat watcher (spec M3 §6). One timer, armed when the Gateway boots
 * and reset by every hello and heartbeat:
 * - it fires after 30 s of silence: Real Running Runs become Interrupted and a
 *   half-open socket is dropped so the Host Agent says hello again;
 * - on a hello after a Host Agent restart, or the first one since this
 *   Gateway booted, Attempts the Host Agent does not list as live are lost;
 * - a short drop between the same two processes checks nothing: the resume
 *   buffers resend what was missed.
 */
export class HostWatch {
  private timer: TimerHandle | null = null;
  private booting = true;

  constructor(private readonly opts: HostWatchOptions) {}

  /** Starts the boot wait: 30 s for the Host Agent's hello. */
  start(): void {
    this.opts.link.onHello((hello, info) => this.hello(hello, info.processChanged));
    this.opts.link.onHeartbeat(() => this.arm());
    this.arm();
  }

  stop(): void {
    if (this.timer) this.opts.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private arm(): void {
    this.stop();
    this.timer = this.opts.clock.setTimeout(() => void this.expired(), this.opts.timeoutMs ?? HEARTBEAT_TIMEOUT_MS);
  }

  private async expired(): Promise<void> {
    this.timer = null;
    // Still booting: no hello at all, so even simulated Dry-run Nodes were lost.
    const booting = this.booting;
    this.opts.link.drop("no heartbeat");
    await this.opts.engine.hostLost("Pod Host unreachable", booting);
  }

  private async hello(hello: Payload<"hello">, processChanged: boolean): Promise<void> {
    this.arm();
    const gatewayRestarted = this.booting;
    this.booting = false;
    await this.opts.engine.hostBack({
      liveAttempts: hello.liveAttempts,
      checkLive: processChanged || gatewayRestarted,
      gatewayRestarted,
      reason: processChanged ? "Host Agent restarted" : "Lost while the Gateway restarted",
    });
  }
}
