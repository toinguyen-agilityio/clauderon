// Pod limits (POD-2): Slots, CPU and RAM, each capped by `POD_LIMIT_CEILING`.

export type PodLimits = { slots: number; cpus: number; memoryMb: number };

/** Used when `POD_LIMIT_CEILING` is not set; the same as `.env.example`. */
export const DEFAULT_LIMIT_CEILING: PodLimits = { slots: 4, cpus: 4, memoryMb: 8192 };

/** Reads `slots=4,cpus=4,memoryMb=8192`; a key left out keeps its default. */
export function parseLimitCeiling(text: string | undefined): PodLimits {
  const ceiling = { ...DEFAULT_LIMIT_CEILING };
  for (const part of (text ?? "").split(",")) {
    const [key, raw] = part.split("=").map((s) => s.trim());
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (key === "slots" || key === "cpus" || key === "memoryMb") ceiling[key] = value;
  }
  return ceiling;
}

export type LimitsCheck = { ok: true; limits: PodLimits } | { ok: false; error: string };

/** A request must be whole Slots and memory, positive, and not above the ceiling. */
export function checkLimits(requested: { slots: unknown; cpus: unknown; memoryMb: unknown }, ceiling: PodLimits): LimitsCheck {
  const slots = Number(requested.slots);
  const cpus = Number(requested.cpus);
  const memoryMb = Number(requested.memoryMb);
  if (!Number.isInteger(slots) || slots < 1) return { ok: false, error: "Slots must be a whole number, at least 1." };
  if (!Number.isFinite(cpus) || cpus <= 0) return { ok: false, error: "CPU must be more than 0." };
  if (!Number.isInteger(memoryMb) || memoryMb < 1) return { ok: false, error: "RAM must be more than 0 GB." };
  if (slots > ceiling.slots) return { ok: false, error: `Slots are capped at ${ceiling.slots}.` };
  if (cpus > ceiling.cpus) return { ok: false, error: `CPU is capped at ${ceiling.cpus}.` };
  if (memoryMb > ceiling.memoryMb) return { ok: false, error: `RAM is capped at ${ceiling.memoryMb / 1024} GB.` };
  return { ok: true, limits: { slots, cpus, memoryMb } };
}

/**
 * Where `count` new Runs would land on a Pod: 0 starts at once, n is the n-th
 * Run waiting for a Slot (first in, first out). Spec M2 §6, the Start dialog.
 */
export function queuePositions(pod: { slots: number; inUse: number; queued: number }, count: number): number[] {
  const free = Math.max(0, pod.slots - pod.inUse);
  return Array.from({ length: count }, (_, i) => {
    const ahead = pod.queued + i;
    return ahead < free ? 0 : ahead - free + 1;
  });
}
