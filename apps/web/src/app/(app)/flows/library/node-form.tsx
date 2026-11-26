"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CREATABLE_KINDS, DEFAULT_MAX_TURNS, MAX_TURNS_LIMIT, OUTPUT_TYPES, isEntryKind, runsClaude, type NodeInput, type NodeOutput, type OutputType } from "@clauderon/core";
import { Icon } from "../../../../components/icons";
import { outputColor } from "../../../../components/state-pill";
import { kindIcon } from "../[id]/flow-icons";
import { KIND_LABEL, NodeView } from "../[id]/flow-node";
import { deleteNodeAction, saveNodeAction } from "./actions";
import { INSTRUCTIONS_MAX, KIND_HELP, MODEL_CHOICES, TYPE_HELP, deleteBlocker, nodeInput, retypePort, sameValue, saveBlocker, saveOutcome, type LibraryUse, type NodeFormValue } from "./library-view";

export type { NodeFormValue } from "./library-view";

export const EMPTY_NODE: NodeFormValue = { id: null, name: "", kind: "agent", instructions: "", command: null, inputs: [], outputs: [], model: "", maxTurns: "" };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Create or edit a library Node (FLW-1, FLW-9), samples included: its name, its Kind (four
 * choices, each saying what it does), its instructions or command, and its ports, each led
 * by its Output Type. A preview shows the Node as it will look on the canvas, and the footer
 * says how many Flows a save changes.
 */
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
    const result = await saveNodeAction(value.id, nodeInput(value));
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
          <div className="nf-plist">
            {rows.map((p, i) => (
              <div key={i} className="nf-prow" style={{ "--c": outputColor(p.type) } as CSSProperties}>
                <span className="nf-type">
                  <i aria-hidden="true" />
                  <select aria-label={`${one} ${i + 1} type`} value={p.type} disabled={readOnly} onChange={(e) => update(i, retypePort(p, e.target.value as OutputType))}>
                    {OUTPUT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </span>
                <input className="input mono" aria-label={`${one} ${i + 1} name`} placeholder={p.type} value={p.name} readOnly={readOnly} onChange={(e) => update(i, { name: e.target.value })} />
                <label className="nf-flag">
                  <span className="fe-switch">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label={`${one} ${i + 1} ${flagLabel.toLowerCase()}`}
                      checked={flagOf(p)}
                      disabled={readOnly}
                      onChange={(e) => update(i, which === "inputs" ? { required: e.target.checked } : { optional: e.target.checked })}
                    />
                    <span aria-hidden="true" />
                  </span>
                  {flagLabel}
                </label>
                {!readOnly ? (
                  <button
                    type="button"
                    className="btn ghost sm icon danger-hover"
                    aria-label={`Remove ${one} ${i + 1}`}
                    data-tip="Remove"
                    onClick={() => set(which === "inputs" ? { inputs: value.inputs.filter((_, j) => j !== i) } : { outputs: value.outputs.filter((_, j) => j !== i) })}
                  >
                    {Icon.trash}
                  </button>
                ) : (
                  <span />
                )}
                <span className="nf-what">{TYPE_HELP[p.type]}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  // The Node as the canvas will draw it: a port with no name yet shows under its type.
  const preview = {
    id: value.id ?? "new",
    name: value.name.trim() || "New Node",
    kind: value.kind,
    inputs: value.inputs.map((p) => ({ ...p, name: p.name.trim() || p.type })),
    outputs: value.outputs.map((p) => ({ ...p, name: p.name.trim() || p.type })),
  };

  return (
    <div className="nf" data-testid={value.id ? "node-edit" : "node-new"}>
      {readOnly && <div className="banner info">This Node is read-only.</div>}
      <div className="nf-grid">
        <div className="nf-col">
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
          <fieldset className="field nf-kinds-field">
            <legend>Kind</legend>
            {isEntryKind(value.kind) ? (
              <p className="nf-kind-fixed">
                <span className="nf-kind-ic k-input" aria-hidden="true">
                  {kindIcon("input")}
                </span>
                Input, built in: it cannot change Kind.
              </p>
            ) : (
              <div className="nf-kinds">
                {CREATABLE_KINDS.map((k) => (
                  <label key={k} className={`nf-kind k-${k}`}>
                    <input type="radio" name={`kind-${value.id ?? "new"}`} value={k} checked={value.kind === k} disabled={readOnly} onChange={() => set({ kind: k })} />
                    <span className="nf-kind-ic" aria-hidden="true">
                      {kindIcon(k)}
                    </span>
                    {KIND_LABEL[k] ?? k}
                  </label>
                ))}
              </div>
            )}
            <span className="hint">{KIND_HELP[value.kind]}</span>
          </fieldset>

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

          {runsClaude(value.kind) && (
            <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <div className="field" style={{ flex: 2 }}>
                <label htmlFor={`model-${value.id ?? "new"}`}>Model</label>
                <select id={`model-${value.id ?? "new"}`} className="input" aria-label="Model" value={value.model} disabled={readOnly} onChange={(e) => set({ model: e.target.value })}>
                  {MODEL_CHOICES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <span className="hint">A smaller model costs less for a simple step.</span>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor={`turns-${value.id ?? "new"}`}>Turn limit</label>
                <input
                  id={`turns-${value.id ?? "new"}`}
                  className="input"
                  aria-label="Turn limit"
                  inputMode="numeric"
                  placeholder={String(DEFAULT_MAX_TURNS)}
                  value={value.maxTurns}
                  readOnly={readOnly}
                  onChange={(e) => set({ maxTurns: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })}
                />
                <span className="hint">At the limit the Run waits for Continue or Stop (1 to {MAX_TURNS_LIMIT}).</span>
              </div>
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
            () => set({ inputs: [...value.inputs, { name: "issue", type: "issue", required: true }] }),
            readOnly || isEntryKind(value.kind) ? "No Inputs. This Node starts a Flow." : "No Inputs yet.",
          )}
          {ports(
            "outputs",
            value.outputs,
            "Optional",
            (p) => (p as NodeOutput).optional,
            updateOutput,
            () => set({ outputs: [...value.outputs, { name: "summary", type: "summary", optional: false }] }),
            "No Outputs yet.",
          )}

          <section className="nf-preview" aria-label="On the canvas">
            <span className="nf-preview-cap">On the canvas</span>
            <NodeView
              id="preview"
              lib={preview}
              placement={{ id: "preview", nodeId: preview.id, x: 0, y: 0, label: null, extraInstructions: "", enabledOptionalOutputs: preview.outputs.filter((o) => o.optional).map((o) => o.name) }}
              selected={false}
              focused={false}
              readOnly
              problems={[]}
              wire={null}
              renaming={false}
              onRename={() => {}}
              onAction={() => {}}
              onAdd={() => {}}
            />
          </section>
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
          <>
            <button type="button" className="btn ghost danger" disabled={pending || !!cantDelete || confirmDelete} aria-describedby={cantDelete ? `del-why-${value.id}` : undefined} onClick={() => setConfirmDelete(true)}>
              {Icon.trash} Delete
            </button>
            {cantDelete && (
              <span id={`del-why-${value.id}`} className="nf-why">
                {usedBy.length === 1 ? "Take it out of the Flow that uses it first." : `Take it out of the ${plural(usedBy.length, "Flow")} that use it first.`}
              </span>
            )}
          </>
        )}
        <span className={`nf-status ${status?.kind ?? ""}`} role={message?.kind === "error" ? "alert" : "status"}>
          {status?.text}
        </span>
        {dirty && !readOnly && <span className="nf-dirty">{!isNew && usedBy.length > 0 ? `Saving updates ${usedBy.length === 1 ? "1 Flow" : plural(usedBy.length, "Flow")}` : "Unsaved changes"}</span>}
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
