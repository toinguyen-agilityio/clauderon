import { ago, formatTime } from "../../../components/format";
import { viewFlows, type FlowView } from "../../../server/flows";
import { viewLibrary } from "../../../server/library";
import { deps, requireMember } from "../../../server/runtime";
import { FlowsList } from "./flows-list";
import { FlowsTabs } from "./flows-tabs";
import type { FlowRowView } from "./flows-view";

export const dynamic = "force-dynamic";

export default async function FlowsPage() {
  await requireMember();
  const [{ samples, flows }, nodes] = await Promise.all([viewFlows(deps()), viewLibrary(deps())]);
  const now = new Date();
  // Only what the list needs, in a shape that can cross to the client (no Dates). Your own Flows come first.
  const row = (f: FlowView): FlowRowView => ({
    id: f.id,
    name: f.name,
    isSample: f.isSample,
    nodeCount: f.nodeCount,
    problems: f.problems,
    nodes: f.nodes,
    updatedBy: f.updatedByEmail,
    updatedLabel: ago(f.updatedAt, now),
    updatedTitle: formatTime(f.updatedAt),
    lock: f.lock ? { runId: f.lock.runId, state: f.lock.state } : null,
  });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Flows</h1>
          <p className="sub">
            A Flow is the graph of Nodes a Run follows. Samples are read-only: clone one to change it. A Flow is locked while an Active
            Run uses it.
          </p>
        </div>
      </div>

      <FlowsTabs active="flows" flows={samples.length + flows.length} nodes={nodes.length} />

      <FlowsList flows={[...flows, ...samples].map(row)} />
    </>
  );
}
