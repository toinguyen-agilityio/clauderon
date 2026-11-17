import Link from "next/link";
import { ago } from "../../../components/format";
import { viewFlows, type FlowView } from "../../../server/flows";
import { deps, requireMember } from "../../../server/runtime";
import { FlowRowActions } from "./flow-row-actions";

export const dynamic = "force-dynamic";

export default async function FlowsPage() {
  await requireMember();
  const { samples, flows } = await viewFlows(deps());
  const now = new Date();
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

      <FlowTable title="Samples" rows={samples} now={now} empty="No sample Flows yet. They arrive with the seed." />
      <FlowTable title="Flows" rows={flows} now={now} empty="No Flows of your own yet. Clone a sample to start one." />
    </>
  );
}

function FlowTable({ title, rows, now, empty }: { title: string; rows: FlowView[]; now: Date; empty: string }) {
  return (
    <div className="card" data-testid={`flows-${title.toLowerCase()}`}>
      <div className="card-head">
        <h2>{title}</h2>
        <span className="faint small num">{rows.length}</span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Nodes</th>
              <th>Problems</th>
              <th>Last change</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty">{empty}</div>
                </td>
              </tr>
            )}
            {rows.map((f) => (
              <tr key={f.id}>
                <td className="t-title">
                  <Link href={`/flows/${f.id}`}>
                    <b>{f.name}</b>
                  </Link>
                  {f.lock && (
                    <>
                      {" "}
                      <Link className="tag dry" href={`/runs/${f.lock.runId}`} title="The oldest Active Run that uses this Flow">
                        Locked by Run {f.lock.runId.slice(0, 6)} ({f.lock.state.replaceAll("_", " ")})
                      </Link>
                    </>
                  )}
                </td>
                <td className="num">{f.nodeCount}</td>
                <td className="num">{f.problems === 0 ? <span className="faint">none</span> : <span className="err-text">{f.problems}</span>}</td>
                <td className="small">
                  {f.updatedByEmail} <span className="faint">· {ago(f.updatedAt, now)}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <FlowRowActions flowId={f.id} sample={f.isSample} locked={f.lock !== null} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
