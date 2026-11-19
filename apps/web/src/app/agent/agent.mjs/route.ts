import { agentBundle } from "../../../server/agent-install";

export const dynamic = "force-dynamic";

/** Public: the Agent as one file (ADR 0007). It holds no secret: Machines get their token by Pairing. */
export async function GET() {
  const bundle = await agentBundle();
  if (!bundle) return new Response("the Agent bundle is not built (pnpm --filter @clauderon/host-agent build)\n", { status: 404 });
  return new Response(new Uint8Array(bundle), { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" } });
}
