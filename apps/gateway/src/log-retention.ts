import type { Clock, TimerHandle } from "@clauderon/core";
import { clearTurnTargetsBefore, deleteLogChunksBefore, type Db } from "@clauderon/db";

/** Log chunks are kept this long; Runs, Outputs and Artifacts are kept (NFR-5). */
export const LOG_RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;

export type LogRetentionOptions = { db: Db; clock: Clock; log?: (message: string) => void };

/**
 * The daily retention job (spec M4 §5.2): once when the Gateway boots, then
 * every 24 hours, deletes Log chunks older than 90 days and clears the targets of old Inspector turns.
 */
export class LogRetention {
  private timer: TimerHandle | null = null;
  private running: Promise<void> = Promise.resolve();

  constructor(private readonly opts: LogRetentionOptions) {}

  async start(): Promise<void> {
    this.running = this.prune();
    await this.running;
  }

  stop(): void {
    if (this.timer) this.opts.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Resolves once the current prune has finished. */
  idle(): Promise<void> {
    return this.running;
  }

  private async prune(): Promise<void> {
    const cutoff = new Date(this.opts.clock.now().getTime() - LOG_RETENTION_DAYS * DAY_MS);
    try {
      const count = await deleteLogChunksBefore(this.opts.db, cutoff);
      if (count > 0) (this.opts.log ?? console.log)(`log retention: deleted ${count} log chunks before ${cutoff.toISOString()}`);
      // Inspector turns keep their sizes but lose what they pointed at (#105).
      await clearTurnTargetsBefore(this.opts.db, cutoff);
    } catch (error) {
      // A failed prune is retried tomorrow; it must never stop the Gateway.
      (this.opts.log ?? console.warn)(`log retention failed: ${String(error)}`);
    }
    this.timer = this.opts.clock.setTimeout(() => {
      this.running = this.prune();
    }, DAY_MS);
  }
}
