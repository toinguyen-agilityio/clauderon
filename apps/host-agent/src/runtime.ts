import { execFile } from "node:child_process";
import { mkdir, readFile, rename, statfs, writeFile } from "node:fs/promises";
import { arch, cpus, totalmem } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import WebSocket from "ws";
import { fromWebSocket } from "@clauderon/protocol";
import type { Connector, HostFacts, StateStore } from "./agent.js";

const run = promisify(execFile);

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

async function dockerRunning(): Promise<boolean> {
  try {
    await run("docker", ["info", "--format", "{{.ServerVersion}}"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/** Size of the disk holding `path`, or of the root disk before `path` exists. */
async function diskGb(path: string): Promise<number> {
  for (const candidate of [path, "/"]) {
    try {
      const stats = await statfs(candidate);
      return Math.round((stats.blocks * stats.bsize) / 1024 ** 3);
    } catch {
      // try the next one
    }
  }
  return 0;
}

/** Host facts for hello (spec M0 §8): architecture, CPU, RAM, disk, Docker. */
export async function readHostFacts(stateDir: string): Promise<HostFacts> {
  return {
    arch: arch(),
    cpus: cpus().length,
    memoryMb: Math.round(totalmem() / 1024 ** 2),
    diskGb: await diskGb(stateDir),
    dockerRunning: await dockerRunning(),
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
