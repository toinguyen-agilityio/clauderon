import type { LinkSocket } from "@clauderon/protocol";

/**
 * One end of an in-memory socket pair. Messages arrive asynchronously, like
 * on a network; a message still in flight when the pair closes is lost.
 */
export class MemorySocket implements LinkSocket {
  peer!: MemorySocket;
  closed = false;
  closeCode: number | null = null;
  private messageListeners: ((text: string) => void)[] = [];
  private closeListeners: ((code: number) => void)[] = [];

  send(text: string): void {
    if (this.closed) return;
    const peer = this.peer;
    queueMicrotask(() => {
      if (!peer.closed) for (const listener of peer.messageListeners) listener(text);
    });
  }

  close(code = 1000): void {
    if (this.closed) return;
    this.closed = true;
    this.peer.closed = true;
    queueMicrotask(() => {
      this.emitClose(code);
      this.peer.emitClose(code);
    });
  }

  /** Drops the connection abruptly, as a network failure would. */
  cut(): void {
    this.close(1006);
  }

  onMessage(listener: (text: string) => void): void {
    this.messageListeners.push(listener);
  }

  onClose(listener: (code: number) => void): void {
    this.closeListeners.push(listener);
  }

  private emitClose(code: number): void {
    this.closeCode = code;
    for (const listener of this.closeListeners) listener(code);
  }
}

export function memorySocketPair(): [MemorySocket, MemorySocket] {
  const a = new MemorySocket();
  const b = new MemorySocket();
  a.peer = b;
  b.peer = a;
  return [a, b];
}
