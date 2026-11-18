"use client";

import { useEffect, useRef, useState } from "react";
import { CREATABLE_KINDS, NODE_KINDS, OUTPUT_TYPES, type NodeInput, type NodeOutput } from "@clauderon/core";
import { deleteNodeAction, saveNodeAction } from "./actions";
import { INSTRUCTIONS_MAX, KIND_HELP, TYPE_HELP, deleteBlocker, sameValue, saveBlocker, type LibraryUse, type NodeFormValue } from "./library-view";

export type { NodeFormValue } from "./library-view";

export const EMPTY_NODE: NodeFormValue = { id: null, name: "", kind: "agent", instructions: "", command: null, inputs: [], outputs: [] };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Create or edit a library Node (FLW-1, FLW-9); a sample opens read-only. */
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
    el.style.height = `${Math.max(190, el.scrollHeight + 2)}px`;
  }, [value.instructions, value.kind]);

  const set = (patch: Partial<NodeFormValue>) => {
    setValue((v) => ({ ...v, ...patch }));
    setMessage(null);
  };

  const save = async () => {
    setPending(true);
    const result = await saveNodeAction(value.id, { ...value, command: value.kind === "command" ? (value.command ?? "") : null });
    setPending(false);
    if (!result.ok) return setMessage({ kind: "error", text: result.error });
    if (isNew) {
      setValue(EMPTY_NODE);
      setBaseline(EMPTY_NODE);
      setMessage({ kind: "ok", text: "Created." });
      return;
    }
    setBaseline(value);
    setMessage({
      kind: "ok",
      text: `Saved. It changed ${plural(result.flows, "Flow")}${result.withProblems > 0 ? `; ${result.withProblems} now ${result.withProblems === 1 ? "has" : "have"} problems` : ""}.`,
    });
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

  return (
    <div className="nf" data-testid={value.id ? "node-edit" : "node-new"}>
      {readOnly && <div className="banner info">Sample Nodes are read-only. Create your own Node to change how a step behaves.</div>}
      {!readOnly && !isNew && usedBy.length > 0 && (
        <div className="banner wait">
          <div className="grow small">
            Editing this Node changes {plural(usedBy.length, "Flow")}: {usedBy.map((u) => u.name).join(", ")}.
          </div>
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
              <input
                id={`cmd-${value.id ?? "new"}`}
                className="input mono"
                aria-label="Command"
                placeholder="e.g. npm test"
                spellCheck={false}
                value={value.command ?? ""}
                readOnly={readOnly}
                onChange={(e) => set({ command: e.target.value })}
              />
              <span className="hint">Runs in the Pod, in the Run&apos;s clone of the repository.</span>
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
          <section className="nf-ports" aria-label="Inputs">
            <div className="row between">
              <span className="nf-label">Inputs</span>
              {!readOnly && (
                <button type="button" className="btn sm" onClick={() => set({ inputs: [...value.inputs, { name: "", type: "issue", required: true }] })}>
                  Add input
                </button>
              )}
            </div>
            {value.inputs.length === 0 && <p className="faint small">{readOnly ? "No Inputs. This Node starts a Flow." : "No Inputs yet."}</p>}
            {value.inputs.map((p, i) => (
              <div key={i} className="nf-prow">
                <input className="input" aria-label={`Input ${i + 1} name`} placeholder="name" value={p.name} readOnly={readOnly} onChange={(e) => updateInput(i, { name: e.target.value })} />
                <select className="input" aria-label={`Input ${i + 1} type`} title={TYPE_HELP[p.type]} value={p.type} disabled={readOnly} onChange={(e) => updateInput(i, { type: e.target.value as NodeInput["type"] })}>
                  {OUTPUT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <label className="small row nf-flag">
                  <input type="checkbox" checked={p.required} disabled={readOnly} onChange={(e) => updateInput(i, { required: e.target.checked })} /> required
                </label>
                {!readOnly && (
                  <button type="button" className="btn ghost sm" onClick={() => set({ inputs: value.inputs.filter((_, j) => j !== i) })}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </section>

          <section className="nf-ports" aria-label="Outputs">
            <div className="row between">
              <span className="nf-label">Outputs</span>
              {!readOnly && (
                <button type="button" className="btn sm" onClick={() => set({ outputs: [...value.outputs, { name: "", type: "summary", optional: false }] })}>
                  Add Output
                </button>
              )}
            </div>
            {value.outputs.length === 0 && <p className="faint small">No Outputs yet.</p>}
            {value.outputs.map((p, i) => (
              <div key={i} className="nf-prow">
                <input className="input" aria-label={`Output ${i + 1} name`} placeholder="name" value={p.name} readOnly={readOnly} onChange={(e) => updateOutput(i, { name: e.target.value })} />
                <select className="input" aria-label={`Output ${i + 1} type`} title={TYPE_HELP[p.type]} value={p.type} disabled={readOnly} onChange={(e) => updateOutput(i, { type: e.target.value as NodeOutput["type"] })}>
                  {OUTPUT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <label className="small row nf-flag">
                  <input type="checkbox" checked={p.optional} disabled={readOnly} onChange={(e) => updateOutput(i, { optional: e.target.checked })} /> optional
                </label>
                {!readOnly && (
                  <button type="button" className="btn ghost sm" onClick={() => set({ outputs: value.outputs.filter((_, j) => j !== i) })}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </section>

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
          <button type="button" className="btn sm" disabled={pending} onClick={() => setConfirmDelete(false)}>
            Keep it
          </button>
          <button type="button" className="btn sm danger solid" disabled={pending} onClick={() => void remove()}>
            Delete Node
          </button>
        </div>
      )}

      <div className="nf-actions">
        {!readOnly && (
          <button type="button" className="btn primary" disabled={pending || !!blocker || (!isNew && !dirty)} onClick={() => void save()}>
            {isNew ? "Create Node" : "Save Node"}
          </button>
        )}
        {onClose && (
          <button type="button" className="btn ghost" disabled={pending} onClick={onClose}>
            {isNew && !readOnly ? "Cancel" : "Close"}
          </button>
        )}
        <span className={`nf-status ${status?.kind ?? ""}`} role={message?.kind === "error" ? "alert" : "status"}>
          {status?.text}
        </span>
        {dirty && !readOnly && <span className="nf-dirty">Unsaved changes</span>}
        {!readOnly && !isNew && (
          <span className="nf-delete">
            {cantDelete && <span className="faint small">{cantDelete}</span>}
            <button type="button" className="btn danger" disabled={pending || !!cantDelete || confirmDelete} onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
