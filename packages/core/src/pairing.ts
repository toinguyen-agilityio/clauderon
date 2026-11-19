// Pairing codes (ADR 0006): what the Agent shows and the Member types.

/** How long a pairing code can be approved. */
export const PAIRING_TTL_MS = 10 * 60_000;

/** 8 characters with no look-alikes (0/O, 1/I/L). */
export const PAIRING_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const PAIRING_CODE_LENGTH = 8;

/** A code as people type it: upper case, no spaces or dashes. */
export function normalizePairingCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

/** `ABCD-EFGH`, easier to read aloud. */
export function formatPairingCode(code: string): string {
  return code.length === PAIRING_CODE_LENGTH ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
