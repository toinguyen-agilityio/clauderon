import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { Db } from "./client";
import { run, runAttachment } from "./schema";

// Files attached to a plan or summary Run (ADR 0011): stored sealed until the
// Agent has downloaded them, then only their name and SHA-256 stay.

/** A file as the web app received it, before it is sealed. */
export type NewAttachment = { name: string; data: Buffer };
/** A sealed file ready to store with its Run. */
export type SealedAttachment = { name: string; size: number; sha256: string; sealed: Buffer };
export type AttachmentInfo = { id: string; name: string; size: number; sha256: string; delivered: boolean };

const IV = 12;
const TAG = 16;

// Its own key, derived from the same secret as the GitHub token's (ADR 0010) but for another purpose.
function key(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "clauderon", "run-attachment", 32));
}

export const sha256Hex = (data: Buffer) => createHash("sha256").update(data).digest("hex");

/** AES-256-GCM: IV, then tag, then the encrypted bytes. */
export function sealAttachment(file: NewAttachment, secret: string): SealedAttachment {
  const iv = randomBytes(IV);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const data = Buffer.concat([cipher.update(file.data), cipher.final()]);
  return { name: file.name, size: file.data.length, sha256: sha256Hex(file.data), sealed: Buffer.concat([iv, cipher.getAuthTag(), data]) };
}

/** The file's bytes, or null when it was sealed under another secret or is damaged. */
export function openAttachment(sealed: Buffer, secret: string): Buffer | null {
  if (sealed.length < IV + TAG) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(secret), sealed.subarray(0, IV));
    decipher.setAuthTag(sealed.subarray(IV, IV + TAG));
    return Buffer.concat([decipher.update(sealed.subarray(IV + TAG)), decipher.final()]);
  } catch {
    return null;
  }
}

/** A Run's attachments by name, without their contents. */
export async function attachmentsOfRun(db: Db, runId: string): Promise<AttachmentInfo[]> {
  const rows = await db
    .select({ id: runAttachment.id, name: runAttachment.name, size: runAttachment.size, sha256: runAttachment.sha256, deliveredAt: runAttachment.deliveredAt })
    .from(runAttachment)
    .where(eq(runAttachment.runId, runId))
    .orderBy(asc(runAttachment.name));
  return rows.map(({ deliveredAt, ...r }) => ({ ...r, delivered: deliveredAt !== null }));
}

/** A file still waiting for delivery, only to the Machine its Run is on. */
export async function attachmentForMachine(db: Db, attachmentId: string, machineId: string): Promise<{ name: string; sealed: Buffer } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(attachmentId)) return null;
  const [row] = await db
    .select({ name: runAttachment.name, sealed: runAttachment.sealed })
    .from(runAttachment)
    .innerJoin(run, eq(run.id, runAttachment.runId))
    .where(and(eq(runAttachment.id, attachmentId), eq(run.machineId, machineId), isNotNull(runAttachment.sealed)));
  return row?.sealed ? { name: row.name, sealed: row.sealed } : null;
}

/** The Agent has every file of the Run: their contents go, their names and hashes stay. */
export async function markAttachmentsDelivered(db: Db, runId: string, now: Date): Promise<void> {
  await db.update(runAttachment).set({ sealed: null, deliveredAt: now }).where(and(eq(runAttachment.runId, runId), isNotNull(runAttachment.sealed)));
}
