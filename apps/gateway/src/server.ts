import { createServer, type Server } from "node:http";
import { WebSocketServer } from "ws";
import { fromWebSocket } from "@clauderon/protocol";
import type { BrowserHub } from "./browser-hub";
import type { HostLink } from "./host-link";
import type { TerminalHub } from "./terminals";

/**
 * HTTP and WebSocket front of the Gateway: `/host-agent` for the Host Agent,
 * `/browser` for browser sockets, `/terminal` for web terminals, `/health` for
 * the hosting's health check.
 */
export function createGatewayServer(link: HostLink, hub: BrowserHub, terminals?: TerminalHub): Server {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 });

  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, hostAgentConnected: link.connected }));
      return;
    }
    res.writeHead(404).end();
  });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://gateway");
    if (url.pathname === "/host-agent") {
      wss.handleUpgrade(req, socket, head, (ws) => link.attach(fromWebSocket(ws), req.headers.authorization));
    } else if (url.pathname === "/browser") {
      wss.handleUpgrade(req, socket, head, (ws) => void hub.attach(fromWebSocket(ws), url.searchParams.get("ticket")));
    } else if (url.pathname === "/terminal" && terminals) {
      const options = {
        cols: Number(url.searchParams.get("cols")) || undefined,
        rows: Number(url.searchParams.get("rows")) || undefined,
        login: url.searchParams.get("login"),
      };
      wss.handleUpgrade(req, socket, head, (ws) =>
        void terminals.attach(fromWebSocket(ws), url.searchParams.get("ticket"), url.searchParams.get("podId"), options),
      );
    } else {
      socket.destroy();
    }
  });

  server.on("close", () => wss.close());
  return server;
}
