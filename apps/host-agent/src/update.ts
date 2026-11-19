import { createHash } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";
import type { AgentManifest } from "@clauderon/protocol";

// The Agent updating itself (ADR 0007): after connecting, a bundled Agent
// asks the web app which bundle it serves; when that differs and no Node is
// running, it downloads it, checks its SHA-256, replaces its own file and
// restarts. Every Machine so runs what the web app ships.

export type UpdateOptions = {
  webUrl: string;
  current: string;
  /** The bundle file this Agent runs from, replaced in place. */
  target: string;
  http?: typeof fetch;
};

export type UpdateResult = { updated: false; reason: string } | { updated: true; version: string };

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

/** Fetches the manifest; null when the web app serves no bundle or cannot be reached. */
export async function latestAgent(webUrl: string, http: typeof fetch = fetch): Promise<AgentManifest | null> {
  try {
    const res = await http(`${webUrl.replace(/\/$/, "")}/agent/agent.json`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<AgentManifest>;
    return typeof body.version === "string" && typeof body.sha256 === "string" ? { version: body.version, sha256: body.sha256, size: Number(body.size) || 0 } : null;
  } catch {
    return null;
  }
}

/** Downloads and installs the web app's bundle when it is another version. Never throws. */
export async function updateAgent(opts: UpdateOptions): Promise<UpdateResult> {
  const http = opts.http ?? fetch;
  const latest = await latestAgent(opts.webUrl, http);
  if (!latest) return { updated: false, reason: "the web app serves no Agent bundle" };
  if (latest.version === opts.current) return { updated: false, reason: "up to date" };
  try {
    const res = await http(`${opts.webUrl.replace(/\/$/, "")}/agent/agent.mjs`, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) return { updated: false, reason: `download failed (${res.status})` };
    const data = new Uint8Array(await res.arrayBuffer());
    if (sha256(data) !== latest.sha256) return { updated: false, reason: "the download does not match its SHA-256" };
    // Replace atomically: a half-written file must never be what the service starts.
    const tmp = `${opts.target}.new`;
    await writeFile(tmp, data);
    await rename(tmp, opts.target);
    return { updated: true, version: latest.version };
  } catch (error) {
    return { updated: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
