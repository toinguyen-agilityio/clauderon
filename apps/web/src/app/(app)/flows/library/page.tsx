import { viewFlows } from "../../../../server/flows";
import { viewLibrary } from "../../../../server/library";
import { deps, requireMember } from "../../../../server/runtime";
import { FlowsTabs } from "../flows-tabs";
import { LibraryList } from "./library-list";
import type { LibraryNodeView } from "./library-view";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  await requireMember();
  const [rows, { samples, flows }] = await Promise.all([viewLibrary(deps()), viewFlows(deps())]);
  // Only what the list needs, in a shape that can cross to the client (no Dates or lock objects).
  const nodes: LibraryNodeView[] = rows.map((n) => ({
    id: n.id,
    name: n.name,
    kind: n.kind,
    instructions: n.instructions,
    command: n.command,
    inputs: n.inputs,
    outputs: n.outputs,
    model: n.model,
    maxTurns: n.maxTurns,
    isSample: n.isSample,
    usedBy: n.usedBy.map((u) => ({ flowId: u.flowId, name: u.name, locked: u.lock !== null })),
  }));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Flows</h1>
          <p className="sub">
            Every Node a Flow can place. Any Member can create, edit or delete a Node, samples included. Editing a Node changes every
            Flow that uses it, and is refused while one of them is locked by an Active Run.
          </p>
        </div>
      </div>

      <LibraryList nodes={nodes} tabs={<FlowsTabs active="library" flows={samples.length + flows.length} nodes={nodes.length} />} />
    </>
  );
}
