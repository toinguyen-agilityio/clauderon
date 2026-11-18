"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FlowRowActions } from "./flow-row-actions";
import { filterFlows, groupFlows, pipelinePreview, problemsLabel, scopeCounts, type FlowRowView, type FlowScope } from "./flows-view";

const SCOPES: { scope: FlowScope; label: string }[] = [
  { scope: "all", label: "All" },
  { scope: "mine", label: "Mine" },
  { scope: "samples", label: "Samples" },
  { scope: "problems", label: "Problems" },
];

const EMPTY: Record<FlowScope, string> = {
  all: "No Flows yet. Samples arrive with the seed.",
  mine: "No Flows of your own yet. Clone a sample to start one.",
  samples: "No sample Flows yet. They arrive with the seed.",
  problems: "No Flow has problems.",
};

/** The Nodes of a Flow in order, so a row says what the Flow does without opening it. */
function Pipeline({ nodes }: { nodes: FlowRowView["nodes"] }) {
  if (nodes.length === 0) return <span className="faint small">No Nodes yet.</span>;
  const { shown, hidden } = pipelinePreview(nodes);
  return (
    <ol className="flow-pipe" aria-label="Nodes, in order">
      {shown.map((n, i) => (
        <li key={i}>
          {i > 0 && (
            <span className="flow-arrow" aria-hidden="true">
              ›
            </span>
          )}
          <span className={`flow-node k-${n.kind}`}>{n.name}</span>
        </li>
      ))}
      {hidden.length > 0 && (
        <li>
          <span className="flow-arrow" aria-hidden="true">
            ›
          </span>
          <span className="flow-node more" title={hidden.map((n) => n.name).join(", ")}>
            +{hidden.length} more
          </span>
        </li>
      )}
    </ol>
  );
}

function FlowCard({ flow: f }: { flow: FlowRowView }) {
  return (
    <article className="card flow-card" data-testid={`flow-${f.name}`}>
      <div className="flow-main">
        <div className="flow-title">
          <Link href={`/flows/${f.id}`} className="flow-name">
            {f.name}
          </Link>
          {f.lock && (
            <Link className="tag dry" href={`/runs/${f.lock.runId}`} title="The oldest Active Run that uses this Flow">
              Locked by Run {f.lock.runId.slice(0, 6)} ({f.lock.state.replaceAll("_", " ")})
            </Link>
          )}
        </div>
        <Pipeline nodes={f.nodes} />
        <div className="flow-meta small">
          <span className={`pill ${f.problems === 0 ? "ok" : "fail"}`}>{problemsLabel(f.problems)}</span>
          <span className="faint">
            {f.nodeCount} Node{f.nodeCount === 1 ? "" : "s"}
          </span>
          <span className="faint" title={f.updatedTitle}>
            {f.updatedBy} · {f.updatedLabel}
          </span>
        </div>
      </div>
      <FlowRowActions flowId={f.id} sample={f.isSample} locked={f.lock !== null} />
    </article>
  );
}

export function FlowsList({ flows }: { flows: FlowRowView[] }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<FlowScope>("all");
  const counts = useMemo(() => scopeCounts(flows), [flows]);
  const shown = useMemo(() => filterFlows(flows, query, scope), [flows, query, scope]);
  const groups = useMemo(() => groupFlows(shown), [shown]);

  return (
    <>
      <div className="lib-toolbar">
        <input className="input lib-search" type="search" aria-label="Search Flows" placeholder="Search Flows by name or Node" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="seg lib-groups" role="group" aria-label="Show">
          {SCOPES.filter((s) => s.scope !== "problems" || counts.problems > 0 || scope === "problems").map((s) => (
            <button key={s.scope} type="button" className={scope === s.scope ? "on" : ""} aria-pressed={scope === s.scope} onClick={() => setScope(s.scope)}>
              {s.label} <span className="n">{counts[s.scope]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flow-list" data-testid="flows-list">
        {groups.samples.length > 0 && (
          <section className="flow-section" aria-label="Samples">
            <h2 className="flow-section-h">
              <svg className="flow-pin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M9.5 2.5 13.5 6.5 11 7.5 9.5 11 5 6.5 8.5 5Z" strokeLinejoin="round" />
                <path d="M5.5 10.5 2.5 13.5" strokeLinecap="round" />
              </svg>
              <span>Samples</span>
              <span className="flow-section-note">pinned, read-only: clone one to change it</span>
              <span className="n">{groups.samples.length}</span>
            </h2>
            {groups.samples.map((f) => (
              <FlowCard key={f.id} flow={f} />
            ))}
          </section>
        )}
        {(groups.mine.length > 0 || (query.trim() === "" && (scope === "all" || scope === "mine"))) && (
          <section className="flow-section" aria-label="Your Flows">
            <h2 className="flow-section-h">
              <span>Your Flows</span>
              <span className="flow-section-note">cloned or made by the team</span>
              <span className="n">{groups.mine.length}</span>
            </h2>
            {groups.mine.map((f) => (
              <FlowCard key={f.id} flow={f} />
            ))}
            {groups.mine.length === 0 && <div className="flow-none small faint">No Flows of your own yet. Clone a sample to start one.</div>}
          </section>
        )}
        {shown.length === 0 && (
          <div className="card empty">
            <b>No Flow matches</b>
            {query.trim() ? `Nothing matches "${query.trim()}"${scope === "all" ? "" : ` in ${scope}`}.` : EMPTY[scope]}
          </div>
        )}
      </div>
    </>
  );
}
