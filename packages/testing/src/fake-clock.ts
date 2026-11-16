import type { Clock, TimerHandle } from "@clauderon/core";

type Timer = { id: number; at: number; fn: () => void };

/** A clock that only moves when a test calls `advance`. */
export class FakeClock implements Clock {
  private time: number;
  private timers: Timer[] = [];
  private nextId = 1;

  constructor(start: Date | string = "2026-11-16T09:00:00Z") {
    this.time = new Date(start).getTime();
  }

  now(): Date {
    return new Date(this.time);
  }

  setTimeout(fn: () => void, ms: number): TimerHandle {
    const timer = { id: this.nextId++, at: this.time + Math.max(0, ms), fn };
    this.timers.push(timer);
    return { id: timer.id };
  }

  clearTimeout(handle: TimerHandle): void {
    const id = (handle as { id: number }).id;
    this.timers = this.timers.filter((t) => t.id !== id);
  }

  /** Delays (ms from now) of the timers still waiting, soonest first. */
  pending(): number[] {
    return this.timers.map((t) => t.at - this.time).sort((a, b) => a - b);
  }

  /** Moves time forward, firing due timers in order and letting promises settle. */
  async advance(ms: number): Promise<void> {
    const end = this.time + ms;
    for (;;) {
      const due = this.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      this.timers = this.timers.filter((t) => t !== due);
      this.time = due.at;
      due.fn();
      await settle();
    }
    this.time = end;
    await settle();
  }
}

/** Lets queued microtasks and I/O callbacks run. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
}
