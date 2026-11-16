export const MASK = "•••";

const TOKEN_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bsk-ant-[A-Za-z0-9_-]{8,}/g,
];
const BEARER = /\b(Bearer\s+)[^\s"']+/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Hides GitHub tokens, Anthropic keys, bearer values and every known secret
 * value (NFR-1). Used by the Host Agent before sending logs and by the app.
 */
export function mask(text: string, knownSecrets: readonly string[] = []): string {
  let out = text;
  // Longest first, so a secret that contains another is hidden whole.
  const secrets = knownSecrets.filter((s) => s.trim().length > 0).sort((a, b) => b.length - a.length);
  for (const secret of secrets) out = out.replace(new RegExp(escapeRegExp(secret), "g"), MASK);
  for (const pattern of TOKEN_PATTERNS) out = out.replace(pattern, MASK);
  return out.replace(BEARER, `$1${MASK}`);
}
