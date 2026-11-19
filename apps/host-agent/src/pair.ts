import { createHash, randomBytes } from "node:crypto";
import { formatPairingCode, type Clock } from "@clauderon/core";
import type { AgentConfig, PairResponse, PairingStatus } from "@clauderon/protocol";

/** Between two status checks while the Member approves. */
export const PAIR_POLL_MS = 3_000;

export type PairOptions = {
  /** The Gateway's `ws(s)://` URL, or the web app's `http(s)://` URL, which says where the Gateway is. */
  url: string;
  machine: { hostname: string; os: string; arch: string };
  clock: Clock;
  print: (line: string) => void;
  fetch?: typeof fetch;
  /** A new random token; tests pass a fixed one. */
  newToken?: () => string;
  /** Opens the page that approves the code, e.g. in the default browser. */
  openUrl?: (url: string) => void;
};

export type Paired = { gatewayUrl: string; token: string };

/** The Gateway's HTTP base for a `ws://` or `wss://` link URL. */
export function httpBase(url: string): string {
  return url.replace(/^ws(s?):\/\//, "http$1://").replace(/\/$/, "");
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** Where to connect: a `ws(s)://` URL is the Gateway; an `http(s)://` one is the web app, asked for it. */
export async function resolveGateway(url: string, http: typeof fetch = fetch): Promise<AgentConfig | { gatewayUrl: string; webUrl: null }> {
  const trimmed = url.trim().replace(/\/$/, "");
  if (/^wss?:\/\//.test(trimmed)) return { gatewayUrl: trimmed, webUrl: null };
  if (!/^https?:\/\//.test(trimmed)) throw new Error(`not a URL: ${url} (use the web app's https://… address)`);
  const res = await http(`${trimmed}/api/agent-config`);
  if (!res.ok) throw new Error(`${trimmed} did not answer as Clauderon (${res.status}); check the address`);
  return (await res.json()) as AgentConfig;
}

/**
 * Pairing on the Agent's side (ADR 0006): makes a random token, sends only its
 * hash, shows the code, opens the page that approves it and waits until the
 * Member does. Resolves with the Gateway and the token; rejects if the code
 * expires or the Gateway refuses.
 */
export async function pair(opts: PairOptions): Promise<Paired> {
  const http = opts.fetch ?? fetch;
  const { gatewayUrl, webUrl } = await resolveGateway(opts.url, http);
  const base = httpBase(gatewayUrl);
  const token = (opts.newToken ?? (() => randomBytes(32).toString("base64url")))();

  const res = await http(`${base}/pair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tokenHash: sha256(token), ...opts.machine }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`the Gateway refused to pair (${res.status}): ${body.error ?? res.statusText}`);
  }
  const { pairingId, code, expiresAt, approveUrl: fromGateway } = (await res.json()) as PairResponse;
  const approveUrl = fromGateway ?? (webUrl ? `${webUrl}/pair?code=${code}` : null);
  const until = new Date(expiresAt).toLocaleTimeString();
  opts.print(`Pairing code: ${formatPairingCode(code)} (until ${until})`);
  if (approveUrl) {
    opts.print(`Approve "${opts.machine.hostname}" in your browser: ${approveUrl}`);
    opts.openUrl?.(approveUrl);
  } else {
    opts.print(`In Clauderon, open Machines, enter this code and approve "${opts.machine.hostname}".`);
  }
  opts.print("Waiting for approval…");

  for (;;) {
    await new Promise<void>((resolve) => opts.clock.setTimeout(resolve, PAIR_POLL_MS));
    let status: PairingStatus["status"];
    try {
      const check = await http(`${base}/pair/${pairingId}`, { headers: { authorization: `Bearer ${token}` } });
      if (!check.ok) continue;
      status = ((await check.json()) as PairingStatus).status;
    } catch {
      continue; // the Gateway is briefly unreachable: keep waiting
    }
    if (status === "approved") return { gatewayUrl, token };
    if (status === "expired") throw new Error("the pairing code expired; run pair again");
  }
}
