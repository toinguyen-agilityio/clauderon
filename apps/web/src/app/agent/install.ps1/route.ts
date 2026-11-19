import type { NextRequest } from "next/server";
import { installPs1 } from "../../../server/agent-install";
import { agentRepository, webUrl } from "../../../server/runtime";

export const dynamic = "force-dynamic";

/** Public: the one-line Agent install the Machines page shows (ADR 0006). It holds no secret. */
export function GET(request: NextRequest) {
  const script = installPs1({ webUrl: webUrl(request.nextUrl.origin), repository: agentRepository() });
  return new Response(script, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
