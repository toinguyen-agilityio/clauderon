import type { MessageType, Payload } from "@clauderon/protocol";

/** The part of the Agent the handlers use: register handlers, send messages. */
export interface AgentLink {
  on<T extends MessageType>(type: T, handler: (payload: Payload<T>) => void | Promise<void>): void;
  send<T extends MessageType>(type: T, payload: Payload<T>): unknown;
}

export type Log = (message: string) => void;

/**
 * Runs a handler without holding the link's queue: cloning or running a Node
 * can take minutes, and other Runs must go on meanwhile.
 */
export function detached<T>(handler: (payload: T) => Promise<void>): (payload: T) => void {
  return (payload) => {
    void handler(payload);
  };
}

export const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
