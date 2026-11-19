import { z } from "zod";

// Pairing (ADR 0006), plain HTTP on the Gateway: the Agent makes a random
// token, sends only its SHA-256 hash with the Machine's facts and gets a
// short code to show; once the Member approves the code in the web app, the
// Agent connects with the token.

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

export const pairRequest = z.object({
  tokenHash: sha256Hex,
  hostname: z.string().min(1).max(200),
  os: z.string().min(1).max(40),
  arch: z.string().min(1).max(40),
});
export type PairRequest = z.infer<typeof pairRequest>;

export type PairResponse = {
  pairingId: string;
  code: string;
  expiresAt: string;
  /** The web app's page that approves this code, when the Gateway knows the web app's URL. */
  approveUrl?: string;
};

/** `GET /api/agent-config` on the web app: where an Agent pairing from the web app's URL connects. */
export type AgentConfig = { gatewayUrl: string; webUrl: string };

export type PairingStatus = { status: "pending" | "approved" | "expired" };
