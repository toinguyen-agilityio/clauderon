import type { IncomingMessage, ServerResponse } from "node:http";
import { attachmentForMachine, hashToken, machineOfTokenHash, openAttachment, type Db } from "@clauderon/db";

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

/**
 * `GET /agent/attachments/<id>` with a Machine's token as `Bearer` (ADR 0011): the
 * decrypted file, only for a Run on that Machine and only until it was delivered.
 * Returns false for other paths.
 */
export async function handleAttachments(req: IncomingMessage, res: ServerResponse, opts: { db: Db; sessionSecret: string }): Promise<boolean> {
  const match = /^\/agent\/attachments\/([^/]+)$/.exec(new URL(req.url ?? "/", "http://gateway").pathname);
  if (req.method !== "GET" || !match) return false;
  const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
  const machine = token ? await machineOfTokenHash(opts.db, hashToken(token)) : null;
  if (!machine) {
    json(res, 401, { error: "not paired" });
    return true;
  }
  // Another Machine's file, an unknown id and one already delivered all read the same.
  const found = await attachmentForMachine(opts.db, decodeURIComponent(match[1]!), machine.id);
  if (!found) {
    json(res, 404, { error: "no such attachment" });
    return true;
  }
  const data = openAttachment(found.sealed, opts.sessionSecret);
  if (!data) {
    json(res, 410, { error: "the attachment cannot be read since SESSION_SECRET changed; start a new Run" });
    return true;
  }
  res.writeHead(200, { "content-type": "application/octet-stream", "content-length": String(data.length), "cache-control": "no-store" });
  res.end(data);
  return true;
}
