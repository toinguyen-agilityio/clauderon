import { z } from "zod";
import { isMessageType, messageSchemas, type ControlType, type MessageType, type Payload } from "./messages";

/**
 * Every message on the Host Agent link (spec M0 §4.1). `id` is per sender,
 * starts at 1 and grows by 1; control messages carry id 0.
 */
export type Envelope<T = unknown> = {
  id: number;
  re?: number;
  type: string;
  payload: T;
};

const envelopeShape = z.object({
  id: z.number().int().nonnegative(),
  re: z.number().int().nonnegative().optional(),
  type: z.string().min(1),
  payload: z.unknown(),
});

export type ParseResult = { ok: true; known: boolean; envelope: Envelope } | { ok: false; error: string };

/**
 * Parses and validates one message. An unknown `type` is not an error, so a
 * newer Gateway can talk to an older Host Agent during a deploy (R10).
 */
export function parseEnvelope(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Message is not JSON" };
  }
  const shape = envelopeShape.safeParse(json);
  if (!shape.success) return { ok: false, error: "Message is not an envelope" };

  const { id, re, type, payload } = shape.data;
  const envelope: Envelope = re === undefined ? { id, type, payload } : { id, re, type, payload };
  if (!isMessageType(type)) return { ok: true, known: false, envelope };

  const parsed = messageSchemas[type].safeParse(payload);
  if (!parsed.success) return { ok: false, error: `Invalid ${type} payload: ${parsed.error.message}` };
  return { ok: true, known: true, envelope: { ...envelope, payload: parsed.data } };
}

export function serialize(envelope: Envelope): string {
  return JSON.stringify(envelope);
}

export function controlMessage<T extends ControlType>(type: T, payload: Payload<T>): Envelope<Payload<T>> {
  return { id: 0, type, payload };
}

/** Narrows a parsed envelope to a known message type. */
export function is<T extends MessageType>(envelope: Envelope, type: T): envelope is Envelope<Payload<T>> {
  return envelope.type === type;
}
