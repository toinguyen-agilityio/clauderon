import { ATTACHMENT_LIMITS } from "@clauderon/core";
import type { AgentCheck } from "@clauderon/protocol";
import { httpBase } from "./pair";

export type GatewayCheck =
  | { state: "paired"; webUrl: string | null; skewMs: number | null }
  | { state: "unpaired" }
  | { state: "unreachable"; error: string };

/**
 * Asks the Gateway whether this Machine's token is still paired
 * (`GET /agent/check`, ADR 0007), and how far this computer's clock is off
 * from the Gateway's `Date` header. Never throws.
 */
export async function checkGateway(gatewayUrl: string, token: string, http: typeof fetch = fetch, now = () => Date.now()): Promise<GatewayCheck> {
  try {
    const sentAt = now();
    const res = await http(`${httpBase(gatewayUrl)}/agent/check`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 || res.status === 403) return { state: "unpaired" };
    // An older Gateway has no check: being reachable is all it tells.
    if (res.status === 404) return { state: "paired", webUrl: null, skewMs: skew(res, sentAt, now()) };
    if (!res.ok) return { state: "unreachable", error: `the Gateway answered ${res.status}` };
    const body = (await res.json()) as AgentCheck;
    return { state: "paired", webUrl: body.webUrl ?? null, skewMs: skew(res, sentAt, now()) };
  } catch (error) {
    return { state: "unreachable", error: error instanceof Error ? (error.cause instanceof Error ? error.cause.message : error.message) : String(error) };
  }
}

/** This clock minus the Gateway's, from its `Date` header (a second's precision is plenty). */
function skew(res: Response, sentAt: number, receivedAt: number): number | null {
  const date = res.headers.get("date");
  const gateway = date ? Date.parse(date) : NaN;
  return Number.isNaN(gateway) ? null : Math.round((sentAt + receivedAt) / 2 - gateway);
}

/**
 * Downloads a Run's attached file (`GET /agent/attachments/<id>`, ADR 0011) with the
 * Machine's token; throws on any answer but the file, or on one larger than the limit.
 */
export function attachmentDownloader(gatewayUrl: string, token: string, http: typeof fetch = fetch) {
  return async (id: string): Promise<Uint8Array> => {
    const res = await http(`${httpBase(gatewayUrl)}/agent/attachments/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(300_000),
    });
    if (!res.ok) throw new Error(`the Gateway answered ${res.status} for an attached file`);
    if (Number(res.headers.get("content-length") ?? 0) > ATTACHMENT_LIMITS.fileBytes) throw new Error("an attached file is larger than allowed");
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.length > ATTACHMENT_LIMITS.fileBytes) throw new Error("an attached file is larger than allowed");
    return data;
  };
}
