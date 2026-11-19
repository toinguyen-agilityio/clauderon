import { chmod, mkdir, readFile, rename, rm, statfs, writeFile } from "node:fs/promises";
import { arch, cpus, hostname, platform, totalmem, uptime } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { fromWebSocket } from "@clauderon/protocol";
import type { Connector, MachineFacts, StateStore } from "./agent";

/** Opens a `ws` WebSocket and resolves once it is open. */
export const wsConnector: Connector = (url, headers) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers, handshakeTimeout: 10_000 });
    const socket = fromWebSocket(ws);
    ws.once("open", () => {
      ws.off("error", reject);
      // After opening, errors surface as a close, which reconnects.
      ws.on("error", () => {});
      resolve(socket);
    });
    ws.once("error", reject);
  });

/** Size of the disk holding `path`, or of the root disk before `path` exists. */
async function diskGb(path: string): Promise<number> {
  for (const candidate of [path, platform() === "win32" ? "C:\\" : "/"]) {
    try {
      const stats = await statfs(candidate);
      return Math.round((stats.blocks * stats.bsize) / 1024 ** 3);
    } catch {
      // try the next one
    }
  }
  return 0;
}

/** The Machine's facts for hello and Pairing (spec M0 §8, ADR 0006). */
export async function readMachineFacts(home: string): Promise<MachineFacts> {
  return {
    os: platform(),
    arch: arch(),
    hostname: hostname(),
    cpus: cpus().length,
    memoryMb: Math.round(totalmem() / 1024 ** 2),
    diskGb: await diskGb(home),
  };
}

/** Keeps the last received id in `<dir>/state.json`, written atomically. */
export function fileStateStore(dir: string): StateStore {
  const file = join(dir, "state.json");
  return {
    async load() {
      try {
        const parsed = JSON.parse(await readFile(file, "utf8")) as { lastReceivedId?: unknown };
        return { lastReceivedId: typeof parsed.lastReceivedId === "number" ? parsed.lastReceivedId : 0 };
      } catch {
        return { lastReceivedId: 0 };
      }
    },
    async save(state) {
      await mkdir(dir, { recursive: true });
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify(state));
      await rename(tmp, file);
    },
  };
}

/** What Pairing leaves behind: the Gateway to connect to and the Machine's token. */
export type Pairing = { gatewayUrl: string; token: string };

/** `<home>/agent.json`, readable by the Member only: the token is the Machine's password. */
export function pairingFile(home: string) {
  const file = join(home, "agent.json");
  return {
    async load(): Promise<Pairing | null> {
      try {
        const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<Pairing>;
        return typeof parsed.gatewayUrl === "string" && typeof parsed.token === "string" ? { gatewayUrl: parsed.gatewayUrl, token: parsed.token } : null;
      } catch {
        return null;
      }
    },
    async save(pairing: Pairing): Promise<void> {
      await mkdir(home, { recursive: true });
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify(pairing), { mode: 0o600 });
      await chmod(tmp, 0o600);
      await rename(tmp, file);
    },
  };
}

export type Lock = { ok: true; release(): Promise<void> } | { ok: false; pid: number };

/** Whether a process with this pid exists (EPERM: it does, under another user). */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * One Agent per home (`<home>/agent.pid`): two with one token would keep
 * replacing each other's connection. A pid written before the last boot means
 * nothing now and is ignored.
 */
export async function acquireLock(home: string, pid = process.pid): Promise<Lock> {
  const file = join(home, "agent.pid");
  const bootAt = Date.now() - uptime() * 1000;
  await mkdir(home, { recursive: true });
  try {
    const held = JSON.parse(await readFile(file, "utf8")) as { pid?: unknown; bootAt?: unknown };
    const sameBoot = typeof held.bootAt === "number" && Math.abs(held.bootAt - bootAt) < 120_000;
    if (typeof held.pid === "number" && held.pid !== pid && sameBoot && alive(held.pid)) return { ok: false, pid: held.pid };
  } catch {
    // no lock, or an unreadable one: take it
  }
  await writeFile(file, JSON.stringify({ pid, bootAt }));
  return {
    ok: true,
    async release() {
      try {
        if ((JSON.parse(await readFile(file, "utf8")) as { pid?: unknown }).pid === pid) await rm(file, { force: true });
      } catch {
        // already gone
      }
    },
  };
}
