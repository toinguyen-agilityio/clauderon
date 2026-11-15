/** Time source of the core, so tests can drive it by hand. */
export interface Clock {
  now(): number;
  /** Calls `fn` after `ms`; the returned function cancels the timer. */
  setTimer(fn: () => void, ms: number): () => void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimer(fn, ms) {
    const handle = setTimeout(fn, ms);
    return () => clearTimeout(handle);
  },
};

/** A clock that only moves when a test calls `advance`. */
export class FakeClock implements Clock {
  private time: number;
  private nextId = 1;
  private timers: { id: number; at: number; fn: () => void }[] = [];

  constructor(start = 0) {
    this.time = start;
  }

  now(): number {
    return this.time;
  }

  setTimer(fn: () => void, ms: number): () => void {
    const id = this.nextId++;
    this.timers.push({ id, at: this.time + Math.max(0, ms), fn });
    return () => {
      this.timers = this.timers.filter((t) => t.id !== id);
    };
  }

  /** Moves time forward and fires due timers in order, including ones they schedule. */
  advance(ms: number): void {
    const end = this.time + ms;
    for (;;) {
      const due = this.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      this.timers = this.timers.filter((t) => t.id !== due.id);
      this.time = due.at;
      due.fn();
    }
    this.time = end;
  }

  get pendingTimers(): number {
    return this.timers.length;
  }
}
