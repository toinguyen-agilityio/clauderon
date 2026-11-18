import Link from "next/link";
import { viewLibrary } from "../../../../server/library";
import { deps, requireMember } from "../../../../server/runtime";
import { LibraryList } from "./library-list";
import type { LibraryNodeView } from "./library-view";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  await requireMember();
  const rows = await viewLibrary(deps());
  // Only what the list needs, in a shape that can cross to the client (no Dates or lock objects).
  const nodes: LibraryNodeView[] = rows.map((n) => ({
    id: n.id,
    name: n.name,
    kind: n.kind,
    instructions: n.instructions,
    command: n.command,
    inputs: n.inputs,
    outputs: n.outputs,
    isSample: n.isSample,
    usedBy: n.usedBy.map((u) => ({ flowId: u.flowId, name: u.name, locked: u.lock !== null })),
  }));
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/flows">Flows</Link> / <span>Node library</span>
      </nav>
      <div className="page-head">
        <div>
          <h1>Node library</h1>
          <p className="sub">
            Every Node a Flow can place. Any Member can create, edit or delete a Node that is not a sample. Editing a Node changes every
            Flow that uses it, and is refused while one of them is locked by an Active Run.
          </p>
        </div>
      </div>
      <LibraryList nodes={nodes} />
    </>
  );
}
