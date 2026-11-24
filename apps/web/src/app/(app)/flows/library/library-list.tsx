"use client";

import { isEntryKind } from "@clauderon/core";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../../../components/icons";
import { cloneNodeAction, exportNodesAction } from "./actions";
import { ImportNodes } from "./import-nodes";
import { EMPTY_NODE, NodeForm } from "./node-form";
import { KIND_GROUP_LABEL, emptyText, filterNodes, groupCounts, groupNodes, kindLabel, usageLabel, type KindGroup, type LibraryNodeView } from "./library-view";
import { kindIcon } from "../[id]/flow-icons";
import { Signature } from "../[id]/node-library";
import { closeOnBackdrop } from "../../../../components/dialog";

/**
 * One library Node: its kind icon (as on the canvas), name, what it does and its signature;
 * the footer says how many Flows place it and holds Clone. The card opens the editor.
 */
function NodeCard({ node, onOpen, onClone, cloning }: { node: LibraryNodeView; onOpen: () => void; onClone: () => void; cloning: boolean }) {
  const locked = node.usedBy.some((u) => u.locked);
  return (
    <div className={`card lib-card-wrap k-${node.kind}`}>
      <button type="button" className="lib-card" onClick={onOpen} aria-haspopup="dialog">
        <span className="lib-card-h">
          <span className="lib-kind" aria-hidden="true">
            {kindIcon(node.kind)}
          </span>
          <b className="lib-card-name">{node.name}</b>
          {node.isSample && <span className="tag sample">Sample</span>}
        </span>
        {node.kind === "command" ? (
          <code className="lib-card-desc mono">$ {node.command}</code>
        ) : (
          <span className="lib-card-desc">{node.instructions || <span className="faint">No instructions.</span>}</span>
        )}
        <Signature inputs={node.inputs} outputs={node.outputs} />
      </button>
      <div className="lib-card-f small">
        <span className={node.usedBy.length === 0 ? "faint" : undefined}>{usageLabel(node.usedBy)}</span>
        {locked && <span className="tag dry">locked</span>}
        {/* Input samples cannot be cloned: there is one per Input Type. */}
        {node.isSample && !isEntryKind(node.kind) && (
          <button type="button" className="btn sm icon ghost lib-clone" disabled={cloning} aria-label={`Clone ${node.name}`} data-tip={cloning ? "Cloning…" : "Clone"} onClick={onClone}>
            {cloning ? Icon.spin : Icon.copy}
          </button>
        )}
      </div>
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
          <div className="nd-head">
            {node && (
              <span className={`lib-kind nd-kind k-${node.kind}`} aria-hidden="true">
                {kindIcon(node.kind)}
              </span>
            )}
            <div>
              <h2 id="nd-title">{title}</h2>
              {node && (
                <p className="muted small nd-used">
                  {kindLabel(node.kind)}
                  {node.isSample ? " · Sample" : ""} ·{" "}
                  {node.usedBy.length === 0 ? (
                    usageLabel(node.usedBy)
                  ) : (
                    <>
                      used in{" "}
                      {node.usedBy.map((u, i) => (
                        <span key={u.flowId}>
                          {i > 0 && ", "}
                          <Link href={`/flows/${u.flowId}`}>{u.name}</Link>
                          {u.locked && <span className="tag dry">locked</span>}
                        </span>
                      ))}
                    </>
                  )}
                </p>
              )}
            </div>
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
                usedBy={node.usedBy}
                onClose={() => ref.current?.close()}
              />
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
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
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

  // Export (issue #116): the server builds the file, the browser saves it.
  const exportNodes = async (ids: string[], key: string) => {
    setExporting(key);
    setExportError(null);
    const result = await exportNodesAction(ids);
    setExporting(null);
    if (!result.ok) return setExportError(result.error);
    const url = URL.createObjectURL(new Blob([result.json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
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
        <button type="button" className="btn" disabled={shown.length === 0 || exporting !== null} onClick={() => void exportNodes(shown.map((n) => n.id), "all")}>
          {exporting === "all" ? "Exporting…" : "Export Nodes"}
        </button>
        <ImportNodes />
        <button type="button" className="btn primary" onClick={() => setOpen("new")}>
          {Icon.plus} New Node
        </button>
      </div>

      {(cloneError ?? exportError) && (
        <div className="banner error" role="alert">
          {cloneError ?? exportError}
        </div>
      )}

      <div className="lib-groups-list" data-testid="library-list">
        {/* "All" shows the Nodes under their Kind; one Kind shows them as one grid. */}
        {(group === "all" ? groupNodes(shown) : [{ group, nodes: shown }]).map((g) =>
          g.nodes.length === 0 ? null : (
            <section key={g.group} className="lib-section" aria-label={KIND_GROUP_LABEL[g.group]}>
              {group === "all" && (
                <h2 className="lib-section-h">
                  {KIND_GROUP_LABEL[g.group]} <span className="n">{g.nodes.length}</span>
                </h2>
              )}
              <div className="lib-grid">
                {g.nodes.map((n) => (
                  <NodeCard key={n.id} node={n} onOpen={() => setOpen(n.id)} onClone={() => void clone(n.id)} cloning={cloning === n.id} />
                ))}
              </div>
            </section>
          ),
        )}
        {shown.length === 0 && (
          <div className="card empty lib-empty">
            <b>No Node matches</b>
            {query.trim()
              ? `Nothing matches "${query.trim()}"${group === "all" ? "" : ` in ${KIND_GROUP_LABEL[group]}`}.`
              : emptyText(group)}
          </div>
        )}
      </div>

      {(open === "new" || openNode) && <NodeDialog key={open} node={openNode} onClose={() => setOpen(null)} />}
    </>
  );
}
