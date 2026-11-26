import Link from "next/link";
import { Avatar } from "../../../components/brand";
import { duration, formatTime } from "../../../components/format";
import { HumanForm } from "../../../components/human-form";
import { Icon } from "../../../components/icons";
import { KeepOpen, NeedsYouRefresh } from "../../../components/needs-you-live";
import { OutputValue } from "../../../components/output-value";
import { OType } from "../../../components/state-pill";
import { viewNeedsYou, type NeedsYouItem } from "../../../server/runs";
import { deps, requireMember } from "../../../server/runtime";

export const dynamic = "force-dynamic";

const HOUR = 3_600_000;

/** How a waiting time reads: calm under an hour, amber past it, red past a day. Display only. */
const urgency = (ms: number) => (ms >= 24 * HOUR ? "is-late" : ms >= HOUR ? "is-slow" : "");

const KIND: Record<NeedsYouItem["kind"], { label: string; open: string; icon: React.ReactNode }> = {
  approve: { label: "Approve", open: "Review and decide", icon: Icon.check },
  grill: { label: "Grill", open: "Answer the questions", icon: <span aria-hidden>?</span> },
  turns: { label: "Turn limit", open: "Continue or stop", icon: Icon.sync },
};

/**
 * Needs you (RUN-5, MEM-2, spec M3 §3): every Node waiting for a person across
 * all Runs, oldest first, each with its inline form. Any Member may respond.
 */
export default async function NeedsYouPage() {
  await requireMember();
  const items = await viewNeedsYou(deps());
  const oldest = items[0];

  return (
    <>
      <NeedsYouRefresh />
      <div className="page-head">
        <div>
          <h1>Needs you</h1>
          <p className="sub">Every Node waiting for a person, across all Runs, oldest first. Any Member can respond; each waiting Run holds a Slot on its Machine until someone does.</p>
        </div>
        {oldest && (
          <p className="ny-tally">
            <b>{items.length}</b> waiting
            <span aria-hidden>·</span>
            <span className={urgency(oldest.waitedMs)}>oldest {duration(oldest.waitedMs)}</span>
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card ny-clear">
          <span className="ny-clear-mark" aria-hidden>
            {Icon.check}
          </span>
          <b>Nothing is waiting for a person</b>
          <p>Runs that reach an Approve or Grill Node, or an Agent&apos;s turn limit, show up here.</p>
        </div>
      ) : (
        <ol className="ny-list">
          {items.map((item) => {
            const kind = KIND[item.kind];
            return (
              <li key={item.id} className={`card ny k-${item.kind}`} data-testid="needs-you-item">
                <header className="ny-head">
                  <span className="ny-icon" aria-hidden>
                    {kind.icon}
                  </span>
                  <div className="ny-title">
                    <span className="ny-kind">
                      {kind.label}
                      {item.kind === "grill" && ` · round ${item.round}`}
                    </span>
                    <h2>{item.nodeName}</h2>
                    <p className="ny-ctx">
                      {item.ticketUrl ? (
                        <a className="ny-key" href={item.ticketUrl} target="_blank" rel="noreferrer">
                          {item.key}
                        </a>
                      ) : (
                        <span className="ny-key">{item.key}</span>
                      )}
                      <span className="ny-ticket">{item.ticketTitle}</span>
                    </p>
                    <p className="ny-meta">
                      <span>
                        Flow <b>{item.flowName}</b>
                      </span>
                      <span aria-hidden>·</span>
                      <span className="ny-by">
                        <Avatar name={item.starter.name} email={item.starter.email} picture={item.starter.pictureUrl} />
                        started by {item.starter.name ?? item.starter.email}
                      </span>
                    </p>
                  </div>
                  <div className="ny-side">
                    <span className={`ny-wait ${urgency(item.waitedMs)}`}>
                      <span className="ny-wait-l">Waiting</span>
                      <time dateTime={item.since.toISOString()} title={`Since ${formatTime(item.since)}`}>
                        {duration(item.waitedMs)}
                      </time>
                    </span>
                    <Link className="btn sm" href={`/runs/${item.runId}`}>
                      Open the Run
                    </Link>
                  </div>
                </header>

                <KeepOpen className="ny-body" initialOpen={items.length <= 3}>
                  <summary>{kind.open}</summary>
                  {item.kind === "approve" ? (
                    <div className="ny-split">
                      <div className="ny-review">
                        <span className="ny-label">To review</span>
                        {item.nodeInstructions && <p className="ny-ask">{item.nodeInstructions}</p>}
                        {item.subject ? (
                          <div className="ny-subject">
                            <OType type={item.subject.type} label={item.subject.name} />
                            <OutputValue type={item.subject.type} value={item.subject.value} />
                          </div>
                        ) : (
                          <span className="faint small">No input reached this Node.</span>
                        )}
                      </div>
                      <div className="ny-decide">
                        <span className="ny-label">Your decision</span>
                        <HumanForm request={{ id: item.id, kind: "approve", round: item.round, questions: [] }} runId={item.runId} />
                      </div>
                    </div>
                  ) : item.kind === "turns" ? (
                    <div className="ny-decide">
                      <HumanForm request={{ id: item.id, kind: "turns", round: item.round, questions: [], turns: item.turns }} runId={item.runId} />
                    </div>
                  ) : (
                    <div className="ny-decide">
                      <span className="ny-label">Claude asks</span>
                      <HumanForm request={{ id: item.id, kind: "grill", round: item.round, questions: item.questions }} runId={item.runId} />
                    </div>
                  )}
                </KeepOpen>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
