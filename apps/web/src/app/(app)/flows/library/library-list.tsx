"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NodeKind, OutputType } from "@clauderon/core";
import { Icon } from "../../../../components/icons";
import { cloneNodeAction } from "./actions";
import { EMPTY_NODE, NodeForm } from "./node-form";
import { KIND_GROUP_LABEL, cardMeta, filterNodes, groupCounts, type KindGroup, type LibraryNodeView } from "./library-view";
import { closeOnBackdrop } from "../../../../components/dialog";

type Port = { name: string; type: OutputType; optional: boolean };

const KIND_MARK: Record<NodeKind, string> = { agent: "AI", command: "$_", approve: "H", grill: "H", ticket: "#" };

/** Ports as chips: the square's colour is the Output Type; a dashed chip with "opt" is optional. */
function PortChips({ ports }: { ports: Port[] }) {
  return ports.map((p) => (
    <span key={p.name} className={`lib-port t-${p.type} ${p.optional ? "opt" : ""}`} title={`${p.name}: ${p.type}${p.optional ? ", optional" : ""}`}>
      <i aria-hidden="true" />
      {p.name}
      {p.name !== p.type && <span className="faint">: {p.type}</span>}
      {p.optional && <span className="lib-opt">opt</span>}
    </span>
  ));
}

function NodeCard({ node, onOpen, onClone, cloning }: { node: LibraryNodeView; onOpen: () => void; onClone: () => void; cloning: boolean }) {
  const inputs: Port[] = node.inputs.map((i) => ({ name: i.name, type: i.type, optional: !i.required }));
  const outputs: Port[] = node.outputs.map((o) => ({ name: o.name, type: o.type, optional: o.optional }));
  const locked = node.usedBy.some((u) => u.locked);
  return (
    <div className="lib-card-wrap">
    <button type="button" className="card lib-card" onClick={onOpen} aria-haspopup="dialog">
      <span className="lib-card-h">
        <span className={`lib-kind k-${node.kind}`} aria-hidden="true">
          {KIND_MARK[node.kind]}
        </span>
        <b className="lib-card-name">{node.name}</b>
        {node.isSample && <span className="tag sample">Sample</span>}
      </span>
      {node.kind === "command" ? (
        <code className="lib-card-desc mono">$ {node.command}</code>
      ) : (
        <span className="lib-card-desc">{node.instructions || <span className="faint">No instructions.</span>}</span>
      )}
      {(inputs.length > 0 || outputs.length > 0) && (
        <span className="lib-flow-ports">
          <PortChips ports={inputs} />
          {inputs.length > 0 && outputs.length > 0 && (
            <span className="lib-arrow" aria-label="to">
              →
            </span>
          )}
          <PortChips ports={outputs} />
        </span>
      )}
      <span className="lib-card-f small faint">
        {cardMeta(node)}
        {locked && <span className="tag dry">locked</span>}
      </span>
    </button>
      {/* The Ticket sample cannot be cloned: a Flow has exactly one Ticket Node. */}
      {node.isSample && node.kind !== "ticket" && (
        <button type="button" className="btn sm lib-clone" disabled={cloning} aria-label={`Clone ${node.name}`} onClick={onClone}>
          {cloning ? "Cloning…" : "Clone"}
        </button>
      )}
    </div>
  );
}

/** The editor in a modal dialog; closing it (Esc, ×, Cancel) returns to the grid. */
function NodeDialog({ node, onClose }: { node: LibraryNodeView | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);
  const title = node ? node.name : "New Node";
  return (
    <dialog ref={ref} {...closeOnBackdrop} className="modal wide lib-dialog" aria-labelledby="nd-title" onClose={onClose}>
      <div className="modal-in">
        <div className="modal-h">
          <div>
            <h2 id="nd-title">{title}</h2>
            {node && <p className="muted small" style={{ marginTop: 4 }}>{cardMeta(node)}</p>}
          </div>
          <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
            {Icon.x}
          </button>
        </div>
        <div className="modal-b" data-testid={node ? undefined : "new-node"}>
          {node ? (
            <>
              <NodeForm
                initial={{ id: node.id, name: node.name, kind: node.kind, instructions: node.instructions, command: node.command, inputs: node.inputs, outputs: node.outputs }}
                readOnly={node.isSample}
                usedBy={node.usedBy}
                onClose={() => ref.current?.close()}
              />
              {node.usedBy.length > 0 && (
                <p className="small faint">
                  {node.usedBy.map((u, i) => (
                    <span key={u.flowId}>
                      {i > 0 && " · "}
                      <Link href={`/flows/${u.flowId}`}>Open {u.name}</Link>
                    </span>
                  ))}
                </p>
              )}
            </>
          ) : (
            <NodeForm initial={EMPTY_NODE} onClose={() => ref.current?.close()} />
          )}
        </div>
      </div>
    </dialog>
  );
}

export function LibraryList({ nodes }: { nodes: LibraryNodeView[] }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<KindGroup | "all">("all");
  const [open, setOpen] = useState<string | null>(null); // a Node id, or "new"
  const [cloning, setCloning] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => groupCounts(nodes), [nodes]);
  const shown = useMemo(() => filterNodes(nodes, query, group), [nodes, query, group]);
  // A Node deleted from its dialog leaves the list, which closes the dialog too.
  const openNode = open && open !== "new" ? (nodes.find((n) => n.id === open) ?? null) : null;

  const clone = async (id: string) => {
    setCloning(id);
    setCloneError(null);
    const result = await cloneNodeAction(id);
    setCloning(null);
    if (!result.ok) return setCloneError(result.error);
    setOpen(result.id); // the copy opens for editing; the list refreshes behind it
  };

  // "/" jumps to the search box, as the hint in it says.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (target?.closest("input, textarea, select, [contenteditable], dialog")) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="lib-toolbar">
        <label className="lib-search">
          {Icon.search}
          <input
            ref={search}
            type="search"
            aria-label="Search Nodes and Output Types"
            placeholder="Search Nodes and Output Types"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd aria-hidden="true">/</kbd>
        </label>
        <div className="seg lib-groups" role="group" aria-label="Filter by Kind">
          <button type="button" className={group === "all" ? "on" : ""} aria-pressed={group === "all"} onClick={() => setGroup("all")}>
            All <span className="n">{nodes.length}</span>
          </button>
          {counts.map((c) => (
            <button key={c.group} type="button" className={group === c.group ? "on" : ""} aria-pressed={group === c.group} onClick={() => setGroup(c.group)}>
              {KIND_GROUP_LABEL[c.group]} <span className="n">{c.count}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn primary" onClick={() => setOpen("new")}>
          {Icon.plus} New Node
        </button>
      </div>

      {cloneError && (
        <div className="banner error" role="alert">
          {cloneError}
        </div>
      )}

      <div className="lib-grid" data-testid="library-list">
        {shown.map((n) => (
          <NodeCard key={n.id} node={n} onOpen={() => setOpen(n.id)} onClone={() => void clone(n.id)} cloning={cloning === n.id} />
        ))}
        {shown.length === 0 && (
          <div className="card empty lib-empty">
            <b>No Node matches</b>
            {query.trim()
              ? `Nothing matches "${query.trim()}"${group === "all" ? "" : ` in ${KIND_GROUP_LABEL[group]}`}.`
              : `No ${KIND_GROUP_LABEL[group as KindGroup]} Nodes yet.`}
          </div>
        )}
      </div>

      {(open === "new" || openNode) && <NodeDialog key={open} node={openNode} onClose={() => setOpen(null)} />}
    </>
  );
}
