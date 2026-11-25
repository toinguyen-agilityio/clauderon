import { createServer, type Server } from "node:http";
import { WebSocketServer } from "ws";
import type { Clock } from "@clauderon/core";
import type { Db } from "@clauderon/db";
import { fromWebSocket } from "@clauderon/protocol";
import type { BrowserHub } from "./browser-hub";
import type { MachineLinks } from "./machine-link";
import { handleAttachments } from "./attachments-http";
import { handlePairing } from "./pairing";

export type GatewayServerOptions = { db: Db; clock: Clock; links: MachineLinks; hub: BrowserHub; sessionSecret: string; webUrl?: string; log?: (message: string) => void };

/**
 * HTTP and WebSocket front of the Gateway: `/agent` for Agents, `/pair` for
 * Pairing, `/agent/attachments` for a Run's files (ADR 0011), `/browser` for
 * browser sockets, `/health` for the hosting's health check.
 */
export function createGatewayServer({ db, clock, links, hub, sessionSecret, webUrl, log }: GatewayServerOptions): Server {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 });

  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    handleAttachments(req, res, { db, sessionSecret })
      .then((handled) => handled || handlePairing(req, res, { db, clock, webUrl }))
      .then((handled) => {
        if (!handled) res.writeHead(404).end();
      })
      .catch((error: unknown) => {
        (log ?? console.warn)(`http ${req.url ?? ""}: ${String(error)}`);
        if (!res.headersSent) res.writeHead(500).end();
      });
  });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://gateway");
    if (url.pathname === "/agent") {
      wss.handleUpgrade(req, socket, head, (ws) => links.attach(fromWebSocket(ws), req.headers.authorization));
    } else if (url.pathname === "/browser") {
      wss.handleUpgrade(req, socket, head, (ws) => void hub.attach(fromWebSocket(ws), url.searchParams.get("ticket")));
    } else {
      socket.destroy();
    }
  });

  server.on("close", () => wss.close());
  return server;
}
