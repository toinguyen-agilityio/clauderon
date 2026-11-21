import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, rename, rm, statfs, writeFile } from "node:fs/promises";
import { arch, cpus, freemem, hostname, platform, totalmem, uptime } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import WebSocket from "ws";
import { fromWebSocket } from "@clauderon/protocol";
import type { Connector, MachineFacts, MachineUsageReader, StateStore } from "./agent";

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

/** The disk holding `path`, or the root disk before `path` exists. */
async function disk(path: string): Promise<{ totalGb: number; freeGb: number } | null> {
  for (const candidate of [path, platform() === "win32" ? "C:\\" : "/"]) {
    try {
      const stats = await statfs(candidate);
      return { totalGb: Math.round((stats.blocks * stats.bsize) / 1024 ** 3), freeGb: Math.round((stats.bavail * stats.bsize) / 1024 ** 3) };
    } catch {
      // try the next one
    }
  }
  return null;
}

/** The Machine's facts for hello and Pairing (spec M0 §8, ADR 0006). */
export async function readMachineFacts(home: string): Promise<MachineFacts> {
  return {
    os: platform(),
    arch: arch(),
    hostname: hostname(),
    cpus: cpus().length,
    memoryMb: Math.round(totalmem() / 1024 ** 2),
    diskGb: (await disk(home))?.totalGb ?? 0,
  };
}

/**
 * Memory in use on macOS from `vm_stat`, as Activity Monitor counts it: app
 * memory (anonymous minus purgeable), wired and compressed pages. Null when
 * the output has none of them.
 */
export function parseVmStat(text: string): number | null {
  const pageSize = Number(/page size of (\d+) bytes/.exec(text)?.[1]);
  const pages = (label: string) => Number(new RegExp(`^${label}:\\s+(\\d+)`, "m").exec(text)?.[1] ?? Number.NaN);
  const used = pages("Anonymous pages") - pages("Pages purgeable") + pages("Pages wired down") + pages("Pages occupied by compressor");
  return Number.isFinite(pageSize) && Number.isFinite(used) ? used * pageSize : null;
}

async function memoryUsedBytes(): Promise<number> {
  // On macOS free memory leaves out the cache the system gives back on demand, so nearly all of it looks used.
  if (platform() === "darwin") {
    const used = await promisify(execFile)("vm_stat")
      .then(({ stdout }) => parseVmStat(stdout))
      .catch(() => null);
    if (used !== null) return used;
  }
  return totalmem() - freemem();
}

type CpuTimes = { busy: number; total: number };

function cpuTimes(): CpuTimes {
  let busy = 0;
  let total = 0;
  for (const { times } of cpus()) {
    const b = times.user + times.nice + times.sys + times.irq;
    busy += b;
    total += b + times.idle;
  }
  return { busy, total };
}

/** Busy share of all cores between two readings, 0-100. */
export function cpuBusyPercent(before: CpuTimes, after: CpuTimes): number {
  const total = after.total - before.total;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((after.busy - before.busy) / total) * 100)));
}

/** Reads what the Machine is using now; CPU counts since the previous reading. */
export function machineUsageReader(home: string): MachineUsageReader {
  let previous = cpuTimes();
  return async () => {
    const now = cpuTimes();
    const cpuPercent = cpuBusyPercent(previous, now);
    previous = now;
    const [used, space] = await Promise.all([memoryUsedBytes(), disk(home)]);
    if (!space) return null;
    return { memoryUsedMb: Math.round(used / 1024 ** 2), diskFreeGb: space.freeGb, cpuPercent };
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
export type Pairing = { gatewayUrl: string; token: string; webUrl?: string };

/** `<home>/agent.json`, readable by the Member only: the token is the Machine's password. */
export function pairingFile(home: string) {
  const file = join(home, "agent.json");
  return {
    async load(): Promise<Pairing | null> {
      try {
        const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<Pairing>;
        if (typeof parsed.gatewayUrl !== "string" || typeof parsed.token !== "string") return null;
        return typeof parsed.webUrl === "string" ? { gatewayUrl: parsed.gatewayUrl, token: parsed.token, webUrl: parsed.webUrl } : { gatewayUrl: parsed.gatewayUrl, token: parsed.token };
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
