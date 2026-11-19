import { agentManifest } from "../../../server/agent-install";

export const dynamic = "force-dynamic";

/** Public: the Agent bundle's version and SHA-256, for installers and Agents updating themselves (ADR 0007). */
export async function GET() {
  const manifest = await agentManifest();
  if (!manifest) return Response.json({ error: "the Agent bundle is not built (pnpm --filter @clauderon/host-agent build)" }, { status: 404 });
  return Response.json(manifest, { headers: { "cache-control": "no-store" } });
}
