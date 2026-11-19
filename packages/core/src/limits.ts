// Machine Slots (ADR 0006): the Member sets how many Runs their Machine runs at once.

export const MAX_SLOTS = 8;

export type SlotsCheck = { ok: true; slots: number } | { ok: false; error: string };

/** Slots must be a whole number from 1 to `MAX_SLOTS`. */
export function checkSlots(requested: unknown): SlotsCheck {
  const slots = Number(requested);
  if (!Number.isInteger(slots) || slots < 1) return { ok: false, error: "Slots must be a whole number, at least 1." };
  if (slots > MAX_SLOTS) return { ok: false, error: `Slots are capped at ${MAX_SLOTS}.` };
  return { ok: true, slots };
}

/**
 * Where `count` new Runs would land on a Machine: 0 starts at once, n is the n-th
 * Run waiting for a Slot (first in, first out). Spec M2 §6, the Start dialog.
 */
export function queuePositions(machine: { slots: number; inUse: number; queued: number }, count: number): number[] {
  const free = Math.max(0, machine.slots - machine.inUse);
  return Array.from({ length: count }, (_, i) => {
    const ahead = machine.queued + i;
    return ahead < free ? 0 : ahead - free + 1;
  });
}
