import Link from "next/link";
import { viewLibrary } from "../../../../server/library";
import { deps, requireMember } from "../../../../server/runtime";
import { EMPTY_NODE, NodeForm, type NodeFormValue } from "./node-form";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  await requireMember();
  const nodes = await viewLibrary(deps());
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

      <details className="card card-pad" data-testid="new-node">
        <summary>
          <b>New Node</b>
        </summary>
        <div className="details-body">
          <NodeForm initial={EMPTY_NODE} />
        </div>
      </details>

      <div className="card" data-testid="library-list">
        <div className="tbl-wrap">
          <table className="tbl top">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Inputs</th>
                <th>Outputs</th>
                <th>Used by</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => {
                const value: NodeFormValue = { id: n.id, name: n.name, kind: n.kind, instructions: n.instructions, command: n.command, inputs: n.inputs, outputs: n.outputs };
                const locked = n.usedBy.find((u) => u.lock);
                return (
                  <tr key={n.id}>
                    <td className="t-title" colSpan={1}>
                      <details>
                        <summary>
                          <b>{n.name}</b> {n.isSample && <span className="tag">sample</span>}
                        </summary>
                        <div className="details-body node-form-wrap">
                          <NodeForm initial={value} readOnly={n.isSample} usedBy={n.usedBy.length} />
                        </div>
                      </details>
                    </td>
                    <td className="small">
                      {n.kind}
                    </td>
                    <td className="small mono">
                      {n.inputs.map((i) => `${i.name}:${i.type}${i.required ? "*" : ""}`).join(", ") || <span className="faint">none</span>}
                    </td>
                    <td className="small mono">
                      {n.outputs.map((o) => `${o.name}:${o.type}${o.optional ? "?" : ""}`).join(", ") || <span className="faint">none</span>}
                    </td>
                    <td className="small">
                      {n.usedBy.length === 0 ? (
                        <span className="faint">no Flow</span>
                      ) : (
                        n.usedBy.map((u, i) => (
                          <span key={u.flowId}>
                            {i > 0 && ", "}
                            <Link href={`/flows/${u.flowId}`}>{u.name}</Link>
                          </span>
                        ))
                      )}
                      {locked && <span className="tag dry">locked</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
