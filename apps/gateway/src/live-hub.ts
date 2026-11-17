import { logChunksOf, type Db } from "@clauderon/db";
import { browserRequest, parseBrowserMessage, type BrowserEvent, type LinkSocket } from "@clauderon/protocol";

type LogLine = Extract<BrowserEvent, { type: "log" }>;

/**
 * Live log lines and Run changes for browser sockets (spec M1 §5.1, NFR-4).
 * A log subscription is backfilled from `log_chunk` first; the browser drops
 * a line it already has by its `seq`.
 */
export class LiveHub {
  private logs = new Map<string, Set<LinkSocket>>();
  private runs = new Map<string, Set<LinkSocket>>();

  constructor(private readonly db: Db) {}

  /** Handles one message from an authenticated browser socket. */
  async handle(socket: LinkSocket, text: string): Promise<void> {
    const request = parseBrowserMessage(browserRequest, text);
    if (!request) return;
    switch (request.type) {
      case "subscribe.log": {
        add(this.logs, request.attemptId, socket);
        if (!/^[0-9a-f-]{36}$/i.test(request.attemptId)) return;
        for (const chunk of await logChunksOf(this.db, request.attemptId, request.afterSeq ?? -1)) {
          send(socket, { type: "log", attemptId: request.attemptId, seq: chunk.seq, stream: chunk.stream, text: chunk.text });
        }
        return;
      }
      case "unsubscribe.log":
        this.logs.get(request.attemptId)?.delete(socket);
        return;
      case "subscribe.run":
        add(this.runs, request.runId, socket);
        return;
    }
  }

  drop(socket: LinkSocket): void {
    for (const map of [this.logs, this.runs]) {
      for (const [key, set] of map) {
        set.delete(socket);
        if (set.size === 0) map.delete(key);
      }
    }
  }

  log(line: Omit<LogLine, "type">): void {
    for (const socket of this.logs.get(line.attemptId) ?? []) send(socket, { type: "log", ...line });
  }

  runChanged(runId: string): void {
    for (const socket of this.runs.get(runId) ?? []) send(socket, { type: "run.changed", runId });
  }
}

function add(map: Map<string, Set<LinkSocket>>, key: string, socket: LinkSocket): void {
  const set = map.get(key) ?? new Set();
  set.add(socket);
  map.set(key, set);
}

function send(socket: LinkSocket, event: BrowserEvent): void {
  socket.send(JSON.stringify(event));
}
