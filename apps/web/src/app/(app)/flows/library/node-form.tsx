"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CREATABLE_KINDS, NODE_KINDS, OUTPUT_TYPES, type NodeInput, type NodeOutput } from "@clauderon/core";
import { Icon } from "../../../../components/icons";
import { deleteNodeAction, saveNodeAction } from "./actions";
import { INSTRUCTIONS_MAX, KIND_HELP, TYPE_HELP, deleteBlocker, sameValue, saveBlocker, saveOutcome, type LibraryUse, type NodeFormValue } from "./library-view";

export type { NodeFormValue } from "./library-view";

export const EMPTY_NODE: NodeFormValue = { id: null, name: "", kind: "agent", instructions: "", command: null, inputs: [], outputs: [] };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Create or edit a library Node (FLW-1, FLW-9), samples included. */
export function NodeForm({
  initial,
  readOnly = false,
  usedBy = [],
  onClose,
}: {
  initial: NodeFormValue;
  readOnly?: boolean;
  usedBy?: readonly LibraryUse[];
  /** Closes the editor (Cancel for a new Node, Close for an existing one). */
  onClose?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const instructions = useRef<HTMLTextAreaElement>(null);
  const isNew = !value.id;
  const dirty = !sameValue(value, baseline);
  const blocker = readOnly ? null : saveBlocker(value);
  const cantDelete = deleteBlocker(usedBy);

  // The Instructions box grows with its text, so a long prompt is readable without an inner scrollbar.
  useEffect(() => {
    const el = instructions.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(160, el.scrollHeight + 2)}px`;
  }, [value.instructions, value.kind]);

  const set = (patch: Partial<NodeFormValue>) => {
    setValue((v) => ({ ...v, ...patch }));
    setMessage(null);
  };

  const save = async () => {
    setPending(true);
    const result = await saveNodeAction(value.id, { ...value, command: value.kind === "command" ? (value.command ?? "") : null });
    setPending(false);
    const outcome = saveOutcome(result, isNew);
    if (outcome.close && onClose) return onClose();
    if (outcome.close) {
      // No dialog to close (used outside one): reset the form for the next Node.
      setValue(EMPTY_NODE);
      setBaseline(EMPTY_NODE);
    } else if (outcome.message.kind === "ok") setBaseline(value);
    setMessage(outcome.message);
  };

  const remove = async () => {
    if (!value.id) return;
    setPending(true);
    const result = await deleteNodeAction(value.id);
    setPending(false);
    setConfirmDelete(false);
    if (!result.ok) setMessage({ kind: "error", text: result.error });
  };

  const updateInput = (i: number, patch: Partial<NodeInput>) => set({ inputs: value.inputs.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const updateOutput = (i: number, patch: Partial<NodeOutput>) => set({ outputs: value.outputs.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const status = message ?? (blocker && !readOnly ? { kind: "hint" as const, text: blocker } : null);

  const ports = (
    which: "inputs" | "outputs",
    rows: readonly (NodeInput | NodeOutput)[],
    flagLabel: string,
    flagOf: (p: NodeInput | NodeOutput) => boolean,
    update: (i: number, patch: Partial<NodeInput> & Partial<NodeOutput>) => void,
    add: () => void,
    empty: string,
  ) => {
    const title = which === "inputs" ? "Inputs" : "Outputs";
    const one = which === "inputs" ? "Input" : "Output";
    return (
      <section className="nf-ports" aria-label={title}>
        <div className="nf-ports-h">
          <span className="nf-label">
            {title} <span className="faint">{rows.length}</span>
          </span>
          {!readOnly && (
            <button type="button" className="btn ghost sm" onClick={add}>
              {Icon.plus} Add {one}
            </button>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="faint small nf-ports-empty">{empty}</p>
        ) : (
          <div className="nf-ptable" role="table" aria-label={title}>
            <div className="nf-prow nf-phead" role="row">
              <span role="columnheader">Name</span>
              <span role="columnheader">Type</span>
              <span role="columnheader">{flagLabel}</span>
              <span aria-hidden="true" />
            </div>
            {rows.map((p, i) => (
              <div key={i} className="nf-prow" role="row">
                <input className="input" aria-label={`${one} ${i + 1} name`} placeholder="name" value={p.name} readOnly={readOnly} onChange={(e) => update(i, { name: e.target.value })} />
                <select className="input" aria-label={`${one} ${i + 1} type`} title={TYPE_HELP[p.type]} value={p.type} disabled={readOnly} onChange={(e) => update(i, { type: e.target.value as NodeInput["type"] })}>
                  {OUTPUT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <span className="nf-flag">
                  <input
                    type="checkbox"
                    aria-label={`${one} ${i + 1} ${flagLabel.toLowerCase()}`}
                    checked={flagOf(p)}
                    disabled={readOnly}
                    onChange={(e) => update(i, which === "inputs" ? { required: e.target.checked } : { optional: e.target.checked })}
                  />
                </span>
                {!readOnly ? (
                  <button
                    type="button"
                    className="btn ghost sm icon danger"
                    aria-label={`Remove ${one} ${i + 1}`}
                    data-tip="Remove"
                    onClick={() => set(which === "inputs" ? { inputs: value.inputs.filter((_, j) => j !== i) } : { outputs: value.outputs.filter((_, j) => j !== i) })}
                  >
                    {Icon.trash}
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="nf" data-testid={value.id ? "node-edit" : "node-new"}>
      {readOnly && <div className="banner info">This Node is read-only.</div>}
      {!isNew && usedBy.length > 0 && (
        <div className="nf-used">
          <span className="nf-used-label">Used in</span>
          <span className="nf-used-list">
            {usedBy.map((u) => (
              <Link key={u.flowId} className="nf-chip" href={`/flows/${u.flowId}`}>
                {u.name}
                {u.locked && <span className="tag dry">locked</span>}
              </Link>
            ))}
          </span>
          {!readOnly && <span className="nf-used-note">Saving changes {usedBy.length === 1 ? "this Flow" : `all ${plural(usedBy.length, "Flow")}`}.</span>}
        </div>
      )}

      <div className="nf-grid">
        <div className="nf-col">
          <div className="nf-namekind">
            <div className="field">
              <label htmlFor={`name-${value.id ?? "new"}`}>Name</label>
              <input
                id={`name-${value.id ?? "new"}`}
                className="input"
                aria-label="Node name"
                placeholder="e.g. Write release notes"
                value={value.name}
                readOnly={readOnly}
                maxLength={120}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`kind-${value.id ?? "new"}`}>Kind</label>
              <select
                id={`kind-${value.id ?? "new"}`}
                className="input"
                aria-label="Kind"
                value={value.kind}
                disabled={readOnly || value.kind === "ticket"}
                onChange={(e) => set({ kind: e.target.value as NodeFormValue["kind"] })}
              >
                {(readOnly ? NODE_KINDS : CREATABLE_KINDS).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="hint nf-kindhelp">
            <span className={`tag k-${value.kind}`}>{value.kind}</span> {KIND_HELP[value.kind]}
          </p>

          {value.kind === "command" ? (
            <div className="field">
              <label htmlFor={`cmd-${value.id ?? "new"}`}>Shell command</label>
              {/* A textarea, so a multi-line script keeps its newlines. */}
              <textarea
                id={`cmd-${value.id ?? "new"}`}
                className="textarea mono nf-command"
                rows={Math.min(Math.max((value.command ?? "").split("\n").length, 2), 20)}
                aria-label="Command"
                placeholder="e.g. npm test"
                spellCheck={false}
                value={value.command ?? ""}
                readOnly={readOnly}
                onChange={(e) => set({ command: e.target.value })}
              />
              <span className="hint">Runs in bash on the Starter&apos;s Machine, in the Run&apos;s worktree of the repository.</span>
            </div>
          ) : (
            <div className="field">
              <label htmlFor={`ins-${value.id ?? "new"}`}>Instructions</label>
              <textarea
                id={`ins-${value.id ?? "new"}`}
                ref={instructions}
                className="textarea nf-instructions"
                aria-label="Instructions"
                placeholder="What should this Node do? It is added to the prompt every time it runs."
                value={value.instructions}
                readOnly={readOnly}
                maxLength={INSTRUCTIONS_MAX}
                onChange={(e) => set({ instructions: e.target.value })}
              />
              <span className="hint nf-count">
                {value.instructions.length.toLocaleString("en-US")} / {INSTRUCTIONS_MAX.toLocaleString("en-US")} characters
              </span>
            </div>
          )}
        </div>

        <div className="nf-col">
          {ports(
            "inputs",
            value.inputs,
            "Required",
            (p) => (p as NodeInput).required,
            updateInput,
            () => set({ inputs: [...value.inputs, { name: "", type: "issue", required: true }] }),
            readOnly || value.kind === "ticket" ? "No Inputs. This Node starts a Flow." : "No Inputs yet.",
          )}
          {ports(
            "outputs",
            value.outputs,
            "Optional",
            (p) => (p as NodeOutput).optional,
            updateOutput,
            () => set({ outputs: [...value.outputs, { name: "", type: "summary", optional: false }] }),
            "No Outputs yet.",
          )}

          <details className="nf-help">
            <summary className="small">What do Kinds and Output Types mean?</summary>
            <h4 className="nf-dl-h">Kinds</h4>
            <dl>
              {NODE_KINDS.map((k) => (
                <div key={k} className="nf-dl-row">
                  <dt className="mono">{k}</dt>
                  <dd>{KIND_HELP[k]}</dd>
                </div>
              ))}
            </dl>
            <h4 className="nf-dl-h">Output Types</h4>
            <dl>
              {OUTPUT_TYPES.map((t) => (
                <div key={t} className="nf-dl-row">
                  <dt className="mono">{t}</dt>
                  <dd>{TYPE_HELP[t]}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </div>

      {confirmDelete && (
        <div className="nf-confirm" role="alertdialog" aria-label="Confirm delete">
          <span className="grow">
            <b>Delete &quot;{value.name}&quot;?</b> No Flow uses it. This cannot be undone.
          </span>
          <button type="button" className="btn sm" disabled={pending} autoFocus onClick={() => setConfirmDelete(false)}>
            Keep it
          </button>
          <button type="button" className="btn sm danger solid" disabled={pending} onClick={() => void remove()}>
            Delete Node
          </button>
        </div>
      )}

      <div className="nf-actions">
        {!readOnly && !isNew && (
          <span className={cantDelete ? "tip-start tip-wide" : undefined} data-tip={cantDelete ?? undefined}>
            <button type="button" className="btn ghost danger" disabled={pending || !!cantDelete || confirmDelete} aria-describedby={cantDelete ? `del-why-${value.id}` : undefined} onClick={() => setConfirmDelete(true)}>
              {Icon.trash} Delete
            </button>
            {cantDelete && (
              <span id={`del-why-${value.id}`} className="sr-only">
                {cantDelete}
              </span>
            )}
          </span>
        )}
        <span className={`nf-status ${status?.kind ?? ""}`} role={message?.kind === "error" ? "alert" : "status"}>
          {status?.text}
        </span>
        {dirty && !readOnly && <span className="nf-dirty">Unsaved changes</span>}
        {onClose && (
          <button type="button" className="btn" disabled={pending} onClick={onClose}>
            {isNew && !readOnly ? "Cancel" : "Close"}
          </button>
        )}
        {!readOnly && (
          <button type="button" className="btn primary" disabled={pending || !!blocker || (!isNew && !dirty)} onClick={() => void save()}>
            {pending ? "Saving…" : isNew ? "Create Node" : "Save Node"}
          </button>
        )}
      </div>
    </div>
  );
}
