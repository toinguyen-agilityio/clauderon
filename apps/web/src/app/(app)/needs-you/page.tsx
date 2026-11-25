import Link from "next/link";
import { Avatar } from "../../../components/brand";
import { duration } from "../../../components/format";
import { HumanForm } from "../../../components/human-form";
import { KeepOpen, NeedsYouRefresh } from "../../../components/needs-you-live";
import { OutputValue } from "../../../components/output-value";
import { OType } from "../../../components/state-pill";
import { viewNeedsYou } from "../../../server/runs";
import { deps, requireMember } from "../../../server/runtime";

export const dynamic = "force-dynamic";

/**
 * Needs you (RUN-5, MEM-2, spec M3 §3): every Node waiting for a person across
 * all Runs, oldest first, each with its inline form. Any Member may respond.
 */
export default async function NeedsYouPage() {
  await requireMember();
  const items = await viewNeedsYou(deps());

  return (
    <>
      <NeedsYouRefresh />
      <div className="page-head">
        <div>
          <h1>Needs you</h1>
          <p className="sub">Every Node waiting for a person, across all Runs, oldest first. Any Member can respond; each waiting Run holds a Slot on its Machine until someone does.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <div className="empty">
            <b>Nothing is waiting for a person</b>
            Runs that reach an Approve or Grill Node show up here.
          </div>
        </div>
      ) : (
        <div className="stack">
          {items.map((item) => (
            <div key={item.id} className="card" data-testid="needs-you-item">
              <div className="card-head">
                <div className="stack" style={{ gap: 2 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <b>{item.nodeName}</b>
                    <span className="tag">{item.kind === "grill" ? `Grill · round ${item.round}` : "Approve"}</span>
                  </div>
                  <div className="small faint">
                    <span className="mono">{item.key}</span> {item.ticketTitle} · {item.flowName} ·{" "}
                    <Link href={`/runs/${item.runId}`}>open the Run</Link>
                  </div>
                </div>
                <div className="row small faint" style={{ gap: 8 }}>
                  <span>waiting {duration(item.waitedMs)}</span>
                  <span>·</span>
                  <Avatar name={item.starter.name} email={item.starter.email} picture={item.starter.pictureUrl} />
                  <span>started by {item.starter.name ?? item.starter.email}</span>
                </div>
              </div>
              <KeepOpen className="card-pad" initialOpen={items.length <= 3}>
                <summary className="small">
                  {item.kind === "grill" ? "Answer the questions" : "Review and decide"}
                </summary>
                {item.kind === "approve" ? (
                  <div className="grid g2">
                    <div className="stack" style={{ gap: 6 }}>
                      {item.nodeInstructions && <p className="small muted">{item.nodeInstructions}</p>}
                      {item.subject ? (
                        <>
                          <OType type={item.subject.type} label={item.subject.name} />
                          <OutputValue type={item.subject.type} value={item.subject.value} />
                        </>
                      ) : (
                        <span className="faint small">No input reached this Node.</span>
                      )}
                    </div>
                    <HumanForm request={{ id: item.id, kind: "approve", round: item.round, questions: [] }} runId={item.runId} />
                  </div>
                ) : (
                  <HumanForm request={{ id: item.id, kind: "grill", round: item.round, questions: item.questions }} runId={item.runId} />
                )}
              </KeepOpen>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
