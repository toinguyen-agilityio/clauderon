import { SEEDED_BY } from "@clauderon/db";
import { ago, formatTime } from "../../../components/format";
import { flowBuildAvailability, viewFlows, type FlowView } from "../../../server/flows";
import { viewLibrary } from "../../../server/library";
import { deps, gatewayUrl, requireMember } from "../../../server/runtime";
import { BuildFlow } from "./build-flow";
import { FlowsList } from "./flows-list";
import { ImportFlow } from "./import-flow";
import { NewFlow } from "./new-flow";
import { FlowsTabs } from "./flows-tabs";
import type { FlowRowView } from "./flows-view";

export const dynamic = "force-dynamic";

export default async function FlowsPage() {
  const member = await requireMember();
  const [{ samples, flows }, nodes, buildable] = await Promise.all([viewFlows(deps()), viewLibrary(deps()), flowBuildAvailability(deps(), member)]);
  const now = new Date();
  // Only what the list needs, in a shape that can cross to the client (no Dates). Your own Flows come first.
  const row = (f: FlowView): FlowRowView => ({
    id: f.id,
    name: f.name,
    isSample: f.isSample,
    nodeCount: f.nodeCount,
    runCount: f.runCount,
    problems: f.problems,
    nodes: f.nodes,
    // A sample nobody has changed shows no author.
    updatedBy: f.updatedByEmail === SEEDED_BY ? null : (f.updatedByName ?? f.updatedByEmail),
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
            A Flow is the graph of Nodes a Run follows. Any Member can create, edit or delete a Flow, samples included. A Flow is locked
            while an Active Run uses it.
          </p>
        </div>
      </div>

      <FlowsList
        flows={[...flows, ...samples].map(row)}
        tabs={<FlowsTabs active="flows" flows={samples.length + flows.length} nodes={nodes.length} />}
        actions={
          <>
            <ImportFlow />
            <BuildFlow gatewayUrl={gatewayUrl()} availability={buildable} />
            <NewFlow />
          </>
        }
      />
    </>
  );
}
