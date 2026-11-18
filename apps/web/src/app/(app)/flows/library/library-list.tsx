"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { NodeKind } from "@clauderon/core";
import { EMPTY_NODE, NodeForm } from "./node-form";
import { filterNodes, kindCounts, type LibraryNodeView } from "./library-view";

type Port = { name: string; type: string; flag: boolean };

/** Ports as chips: a solid border is required, a dashed one is optional (the legend says so). */
function Ports({ ports }: { ports: Port[] }) {
  if (ports.length === 0) return <span className="faint small">none</span>;
  return (
    <span className="lib-ports">
      {ports.map((p) => (
        <span key={p.name} className={`lib-port ${p.flag ? "" : "opt"}`} title={`${p.name}, ${p.type}, ${p.flag ? "required" : "optional"}`}>
          <b>{p.name}</b>
          <i>{p.type}</i>
        </span>
      ))}
    </span>
  );
}

export function LibraryList({ nodes }: { nodes: LibraryNodeView[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<NodeKind | "all">("all");
  const [open, setOpen] = useState<string | null>(null); // a Node id, or "new"

  const counts = useMemo(() => kindCounts(nodes), [nodes]);
  const shown = useMemo(() => filterNodes(nodes, query, kind), [nodes, query, kind]);
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));

  return (
    <>
      <div className="lib-toolbar">
        <input className="input lib-search" type="search" aria-label="Search Nodes" placeholder="Search Nodes by name or instructions" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="chips" role="group" aria-label="Filter by Kind">
          <button type="button" className={`fchip ${kind === "all" ? "on" : ""}`} aria-pressed={kind === "all"} onClick={() => setKind("all")}>
            All <span className="n">{nodes.length}</span>
          </button>
          {counts.map((c) => (
            <button key={c.kind} type="button" className={`fchip ${kind === c.kind ? "on" : ""}`} aria-pressed={kind === c.kind} onClick={() => setKind(c.kind)}>
              {c.kind} <span className="n">{c.count}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn primary" disabled={open === "new"} onClick={() => setOpen("new")}>
          New Node
        </button>
      </div>

      <div className="lib-legend small faint">
        <span>
          <span className="lib-port">
            <b>name</b>
            <i>type</i>
          </span>{" "}
          required
        </span>
        <span>
          <span className="lib-port opt">
            <b>name</b>
            <i>type</i>
          </span>{" "}
          optional
        </span>
        <span>Inputs come in, Outputs go out. The grey text is the Output Type; only matching types connect.</span>
      </div>

      {open === "new" && (
        <section className="card card-pad" data-testid="new-node" aria-label="New Node">
          <h2 className="lib-new-h">New Node</h2>
          <NodeForm initial={EMPTY_NODE} onClose={() => setOpen(null)} />
        </section>
      )}

      <div className="lib-list" data-testid="library-list">
        <div className="lib-cols lib-head" aria-hidden="true">
          <span>Name</span>
          <span>Kind</span>
          <span>Inputs</span>
          <span>Outputs</span>
          <span>Used by</span>
        </div>
        {shown.map((n) => {
          const isOpen = open === n.id;
          const locked = n.usedBy.some((u) => u.locked);
          return (
            <article key={n.id} className={`card lib-row ${isOpen ? "open" : ""}`}>
              <button type="button" className="lib-cols lib-row-head" aria-expanded={isOpen} onClick={() => toggle(n.id)}>
                <span className="lib-name">
                  <span className="lib-chev" aria-hidden="true" />
                  <b>{n.name}</b>
                  {n.isSample && <span className="tag sample">sample</span>}
                </span>
                <span>
                  <span className="lib-cell-label">Kind</span>
                  <span className={`tag k-${n.kind}`}>{n.kind}</span>
                </span>
                <span>
                  <span className="lib-cell-label">Inputs</span>
                  <Ports ports={n.inputs.map((i) => ({ name: i.name, type: i.type, flag: i.required }))} />
                </span>
                <span>
                  <span className="lib-cell-label">Outputs</span>
                  <Ports ports={n.outputs.map((o) => ({ name: o.name, type: o.type, flag: !o.optional }))} />
                </span>
                <span className="small">
                  <span className="lib-cell-label">Used by</span>
                  {n.usedBy.length === 0 ? <span className="faint">no Flow</span> : n.usedBy.map((u) => (
                    <span key={u.flowId} className="lib-flow">
                      {u.name}
                    </span>
                  ))}
                  {locked && <span className="tag dry">locked</span>}
                </span>
              </button>
              {isOpen && (
                <div className="lib-editor">
                  <NodeForm
                    initial={{ id: n.id, name: n.name, kind: n.kind, instructions: n.instructions, command: n.command, inputs: n.inputs, outputs: n.outputs }}
                    readOnly={n.isSample}
                    usedBy={n.usedBy}
                    onClose={() => setOpen(null)}
                  />
                  <p className="small faint lib-links">
                    {n.usedBy.map((u, i) => (
                      <span key={u.flowId}>
                        {i > 0 && " · "}
                        <Link href={`/flows/${u.flowId}`}>Open {u.name}</Link>
                      </span>
                    ))}
                  </p>
                </div>
              )}
            </article>
          );
        })}
        {shown.length === 0 && (
          <div className="card empty">
            <b>No Node matches</b>
            {query.trim() ? `Nothing matches "${query.trim()}"${kind === "all" ? "" : ` in ${kind}`}.` : `No ${kind} Nodes yet.`}
          </div>
        )}
      </div>
    </>
  );
}
