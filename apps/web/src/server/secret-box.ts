import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// Encrypts the app's GitHub token before it is stored (ADR 0010). The key is
// derived from `SESSION_SECRET`, so the database alone never reveals it;
// changing that secret makes the stored token unreadable and an Operator sets it again.

const VERSION = "v1";

function key(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "clauderon", "github-token", 32));
}

export function seal(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

/** The plain text, or null when it was sealed with another secret or is damaged. */
export function unseal(sealed: string, secret: string): string | null {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
