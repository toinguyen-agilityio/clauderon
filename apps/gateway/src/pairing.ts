import type { IncomingMessage, ServerResponse } from "node:http";
import type { Clock } from "@clauderon/core";
import { createPairing, hashToken, machineOfTokenHash, pairingStatus, type Db } from "@clauderon/db";
import { pairRequest, type AgentCheck, type PairResponse, type PairingStatus } from "@clauderon/protocol";

/** Largest pairing request body accepted. */
const MAX_BODY_BYTES = 4096;

export type PairingHttpOptions = {
  db: Db;
  clock: Clock;
  /** The web app's public URL, for the page that approves a code (`WEB_URL`). */
  webUrl?: string;
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(null));
  });
}

/**
 * Pairing over plain HTTP (ADR 0006). `POST /pair` starts one and returns
 * the code to show; `GET /pair/<id>`, with the Agent's token as `Bearer`,
 * says whether a Member approved it. `GET /agent/check`, with a Machine's
 * token, says whether it is still paired (ADR 0007: the installer keeps a
 * working pairing, the doctor reports a lost one). Returns false for other paths.
 */
export async function handlePairing(req: IncomingMessage, res: ServerResponse, opts: PairingHttpOptions): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://gateway");
  if (req.method === "GET" && url.pathname === "/agent/check") {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    if (!token || !(await machineOfTokenHash(opts.db, hashToken(token)))) {
      json(res, 401, { error: "not paired" });
      return true;
    }
    const response: AgentCheck = { paired: true, webUrl: opts.webUrl?.replace(/\/$/, "") ?? null };
    json(res, 200, response);
    return true;
  }
  if (req.method === "POST" && url.pathname === "/pair") {
    const body = await readBody(req);
    let parsed: unknown = null;
    try {
      parsed = body === null ? null : JSON.parse(body);
    } catch {
      // answered below
    }
    const request = pairRequest.safeParse(parsed);
    if (!request.success) {
      json(res, 400, { error: "invalid pairing request" });
      return true;
    }
    const result = await createPairing(opts.db, request.data, opts.clock.now());
    if (!result.ok) {
      json(res, result.reason === "busy" ? 503 : 409, { error: result.reason === "busy" ? "too many pending pairings, try again later" : "this token is already in use" });
      return true;
    }
    const response: PairResponse = {
      pairingId: result.pairing.id,
      code: result.pairing.code,
      expiresAt: result.pairing.expiresAt.toISOString(),
      ...(opts.webUrl ? { approveUrl: `${opts.webUrl.replace(/\/$/, "")}/pair?code=${result.pairing.code}` } : {}),
    };
    json(res, 201, response);
    return true;
  }
  const match = /^\/pair\/([^/]+)$/.exec(url.pathname);
  if (req.method === "GET" && match) {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    if (!token) {
      json(res, 401, { error: "unauthorized" });
      return true;
    }
    const response: PairingStatus = { status: await pairingStatus(opts.db, match[1]!, hashToken(token), opts.clock.now()) };
    json(res, 200, response);
    return true;
  }
  return false;
}
