/**
 * The smallest socket the link logic needs. The Gateway and the Host Agent
 * adapt a `ws` WebSocket to it; tests use an in-memory pair.
 */
export interface LinkSocket {
  send(text: string): void;
  close(code?: number, reason?: string): void;
  onMessage(listener: (text: string) => void): void;
  onClose(listener: (code: number) => void): void;
}

/** Minimal shape of a `ws` WebSocket, so this package needs no `ws` import. */
type WsLike = {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: "message", listener: (data: unknown) => void): void;
  on(event: "close", listener: (code: number) => void): void;
};

const OPEN = 1;

export function fromWebSocket(ws: WsLike): LinkSocket {
  return {
    send: (text) => {
      if (ws.readyState === OPEN) ws.send(text);
    },
    close: (code, reason) => ws.close(code, reason),
    onMessage: (listener) => ws.on("message", (data) => listener(String(data))),
    onClose: (listener) => ws.on("close", (code) => listener(code)),
  };
}
