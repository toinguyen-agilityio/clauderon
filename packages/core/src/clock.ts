export type TimerHandle = { readonly id: number } | ReturnType<typeof setTimeout>;

/**
 * Time as the app sees it. Heartbeats, reconnect backoff, and
 * session expiry read it, so tests can drive it with a fake clock.
 */
export interface Clock {
  now(): Date;
  setTimeout(fn: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export const systemClock: Clock = {
  now: () => new Date(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
