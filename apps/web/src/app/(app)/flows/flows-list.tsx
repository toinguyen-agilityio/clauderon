"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FlowRowActions } from "./flow-row-actions";
import { kindIcon } from "./[id]/flow-icons";
import { filterFlows, flowSteps, groupFlows, problemsLabel, scopeCounts, type FlowRowView, type FlowScope } from "./flows-view";

const SCOPES: { scope: FlowScope; label: string }[] = [
  { scope: "all", label: "All" },
  { scope: "mine", label: "Mine" },
  { scope: "samples", label: "Samples" },
  { scope: "problems", label: "Problems" },
];

const EMPTY: Record<FlowScope, string> = {
  all: "No Flows yet. Samples arrive with the seed.",
  mine: "No Flows of your own yet. Create one, or clone a sample.",
  samples: "No sample Flows yet. They arrive with the seed.",
  problems: "No Flow has problems.",
};

/**
 * The Flow as its steps in run order: Nodes that run side by side share a column, so a
 * branch reads as one. Long Flows wrap instead of being cut short.
 */
function Steps({ nodes }: { nodes: FlowRowView["nodes"] }) {
  if (nodes.length === 0) return <span className="faint small">No Nodes yet.</span>;
  return (
    <ol className="flow-steps" aria-label="Nodes, step by step">
      {flowSteps(nodes).map((step, i) => (
        <li key={i} className={step.length > 1 ? "par" : undefined} aria-label={step.length > 1 ? `Side by side: ${step.map((n) => n.name).join(", ")}` : undefined}>
          {step.map((n, j) => (
            <span key={j} className={`flow-step k-${n.kind} ${n.kind === "ticket" ? "ticket" : ""}`}>
              <span className="flow-step-ic" aria-hidden="true">
                {kindIcon(n.kind)}
              </span>
              {n.name}
            </span>
          ))}
        </li>
      ))}
    </ol>
  );
}

/** A Flow; the whole row opens it in the editor (its name is the link), the icons act on it. */
function FlowCard({ flow: f }: { flow: FlowRowView }) {
  const steps = flowSteps(f.nodes).length;
  return (
    <article id={`flow-${f.id}`} className="card flow-card" data-testid={`flow-${f.name}`}>
      <div className="flow-title">
        <Link href={`/flows/${f.id}`} className="flow-name">
          {f.name}
        </Link>
        {f.problems > 0 && (
          <span className="pill fail flow-flag">
            {problemsLabel(f.problems)}
          </span>
        )}
        {f.lock && (
          <Link className="pill run flow-flag" href={`/runs/${f.lock.runId}`} title="The oldest Active Run that uses this Flow">
            Locked by Run {f.lock.runId.slice(0, 6)} ({f.lock.state.replaceAll("_", " ")})
          </Link>
        )}
        <span className="faint small">
          {f.nodeCount} Node{f.nodeCount === 1 ? "" : "s"}
          {steps > 0 && steps !== f.nodeCount ? ` in ${steps} steps` : ""}
        </span>
      </div>
      <FlowRowActions flowId={f.id} name={f.name} locked={f.lock !== null} />
      <Steps nodes={f.nodes} />
      {f.updatedBy && (
        <span className="flow-who small faint" title={f.updatedTitle}>
          {f.updatedBy} · {f.updatedLabel}
        </span>
      )}
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
              <span className="flow-section-note">pinned; seeded with the app, editable like any Flow</span>
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
            {groups.mine.length === 0 && <div className="flow-none small faint">No Flows of your own yet. Create one, or clone a sample.</div>}
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
