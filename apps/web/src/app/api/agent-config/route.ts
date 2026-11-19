import type { NextRequest } from "next/server";
import type { AgentConfig } from "@clauderon/protocol";
import { gatewayUrl, webUrl } from "../../../server/runtime";

export const dynamic = "force-dynamic";

/**
 * Public on purpose: an Agent pairing with the web app's URL learns where the
 * Gateway is (ADR 0006). Nothing secret: the browser gets the same URL.
 */
export function GET(request: NextRequest) {
  const body: AgentConfig = { gatewayUrl: gatewayUrl(), webUrl: webUrl(request.nextUrl.origin) };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
