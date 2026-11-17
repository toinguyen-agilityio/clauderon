"use client";

import { useState } from "react";
import { CREATABLE_KINDS, OUTPUT_TYPES, type NodeInput, type NodeKind, type NodeOutput } from "@clauderon/core";
import { deleteNodeAction, saveNodeAction } from "./actions";

export type NodeFormValue = {
  id: string | null;
  name: string;
  kind: NodeKind;
  instructions: string;
  command: string | null;
  inputs: NodeInput[];
  outputs: NodeOutput[];
};

export const EMPTY_NODE: NodeFormValue = { id: null, name: "", kind: "agent", instructions: "", command: null, inputs: [], outputs: [] };

/** Create or edit a library Node (FLW-1, FLW-9); a sample opens read-only. */
export function NodeForm({ initial, readOnly = false, usedBy = 0 }: { initial: NodeFormValue; readOnly?: boolean; usedBy?: number }) {
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const set = (patch: Partial<NodeFormValue>) => {
    setValue((v) => ({ ...v, ...patch }));
    setMessage(null);
  };

  const save = async () => {
    setPending(true);
    const result = await saveNodeAction(value.id, { ...value, command: value.kind === "command" ? (value.command ?? "") : null });
    setPending(false);
    if (!result.ok) return setMessage({ kind: "error", text: result.error });
    if (!value.id) setValue(EMPTY_NODE);
    setMessage({
      kind: "ok",
      text: value.id
        ? `Saved. It changed ${result.flows} Flow${result.flows === 1 ? "" : "s"}${result.withProblems > 0 ? `; ${result.withProblems} now ${result.withProblems === 1 ? "has" : "have"} problems` : ""}.`
        : "Created.",
    });
  };

  const remove = async () => {
    if (!value.id) return;
    setPending(true);
    const result = await deleteNodeAction(value.id);
    setPending(false);
    if (!result.ok) setMessage({ kind: "error", text: result.error });
  };

  const updateInput = (i: number, patch: Partial<NodeInput>) => set({ inputs: value.inputs.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const updateOutput = (i: number, patch: Partial<NodeOutput>) => set({ outputs: value.outputs.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  return (
    <div className="stack" style={{ gap: 10 }} data-testid={value.id ? "node-edit" : "node-new"}>
      {value.id && usedBy > 0 && !readOnly && (
        <div className="banner wait">
          <div className="grow small">
            Editing this Node changes {usedBy} Flow{usedBy === 1 ? "" : "s"}.
          </div>
        </div>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <input className="input" aria-label="Node name" placeholder="Name" value={value.name} readOnly={readOnly} onChange={(e) => set({ name: e.target.value })} style={{ minWidth: 220 }} />
        <select className="input" aria-label="Kind" value={value.kind} disabled={readOnly || value.kind === "ticket"} onChange={(e) => set({ kind: e.target.value as NodeKind })}>
          {(readOnly ? [...CREATABLE_KINDS, "ticket" as const] : CREATABLE_KINDS).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      {value.kind === "command" ? (
        <input className="input mono" aria-label="Command" placeholder="Shell command, e.g. npm test" value={value.command ?? ""} readOnly={readOnly} onChange={(e) => set({ command: e.target.value })} />
      ) : (
        <textarea className="textarea" aria-label="Instructions" placeholder="Instructions" value={value.instructions} readOnly={readOnly} onChange={(e) => set({ instructions: e.target.value })} />
      )}

      <div className="stack" style={{ gap: 6 }}>
        <span className="small">Inputs</span>
        {value.inputs.map((p, i) => (
          <div key={i} className="row" style={{ gap: 6 }}>
            <input className="input" aria-label={`Input ${i + 1} name`} placeholder="name" value={p.name} readOnly={readOnly} onChange={(e) => updateInput(i, { name: e.target.value })} />
            <select className="input" aria-label={`Input ${i + 1} type`} value={p.type} disabled={readOnly} onChange={(e) => updateInput(i, { type: e.target.value as NodeInput["type"] })}>
              {OUTPUT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <label className="small row" style={{ gap: 4 }}>
              <input type="checkbox" checked={p.required} disabled={readOnly} onChange={(e) => updateInput(i, { required: e.target.checked })} /> required
            </label>
            {!readOnly && (
              <button type="button" className="btn ghost sm" onClick={() => set({ inputs: value.inputs.filter((_, j) => j !== i) })}>
                Remove
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button type="button" className="btn sm" style={{ width: "fit-content" }} onClick={() => set({ inputs: [...value.inputs, { name: "", type: "issue", required: true }] })}>
            Add input
          </button>
        )}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className="small">Outputs</span>
        {value.outputs.map((p, i) => (
          <div key={i} className="row" style={{ gap: 6 }}>
            <input className="input" aria-label={`Output ${i + 1} name`} placeholder="name" value={p.name} readOnly={readOnly} onChange={(e) => updateOutput(i, { name: e.target.value })} />
            <select className="input" aria-label={`Output ${i + 1} type`} value={p.type} disabled={readOnly} onChange={(e) => updateOutput(i, { type: e.target.value as NodeOutput["type"] })}>
              {OUTPUT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <label className="small row" style={{ gap: 4 }}>
              <input type="checkbox" checked={p.optional} disabled={readOnly} onChange={(e) => updateOutput(i, { optional: e.target.checked })} /> optional
            </label>
            {!readOnly && (
              <button type="button" className="btn ghost sm" onClick={() => set({ outputs: value.outputs.filter((_, j) => j !== i) })}>
                Remove
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button type="button" className="btn sm" style={{ width: "fit-content" }} onClick={() => set({ outputs: [...value.outputs, { name: "", type: "summary", optional: false }] })}>
            Add Output
          </button>
        )}
      </div>

      {message && (
        <span className={message.kind === "error" ? "err-text small" : "faint small"} role={message.kind === "error" ? "alert" : "status"}>
          {message.text}
        </span>
      )}
      {!readOnly && (
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn primary sm" disabled={pending || !value.name.trim()} onClick={() => void save()}>
            {value.id ? "Save Node" : "Create Node"}
          </button>
          {value.id && (
            <button type="button" className="btn sm" disabled={pending} onClick={() => void remove()}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
