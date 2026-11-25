"use client";

import { ATTACHMENT_LIMITS, attachmentNames, checkAttachments, composeInputText } from "@clauderon/core";
import { useRef, useState } from "react";
import { Icon } from "../../../components/icons";
import { MarkdownBody } from "../../../components/markdown-text";

// A plan or summary for the Start Run dialog (ADR 0011): text written or pasted, with a
// Preview of what the Run gets, links Claude opens on the Machine, and any files attached.

export type TextInputState = { value: string; links: string; files: File[] };

/** The links typed one per line. */
export const linkList = (links: string) =>
  links
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export const hasTextInput = (s: TextInputState) => s.value.trim() !== "" || linkList(s.links).length > 0 || s.files.length > 0;

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

export function TextInputFields({ label, state, onChange }: { label: string; state: TextInputState; onChange: (next: TextInputState) => void }) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const picker = useRef<HTMLInputElement>(null);
  const names = attachmentNames(state.files.map((f) => f.name));
  const checked = checkAttachments(state.files.map((f, i) => ({ name: names[i]!, size: f.size })));
  const preview = composeInputText(state.value, linkList(state.links), names);

  const add = (list: FileList | null) => {
    if (!list) return;
    onChange({ ...state, files: [...state.files, ...Array.from(list)] });
    if (picker.current) picker.current.value = "";
  };

  return (
    <>
      <div className="field">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <label htmlFor="sf-value">{label}</label>
          <div className="att-tabs" role="tablist" aria-label={`${label} view`}>
            <button type="button" role="tab" aria-selected={tab === "write"} className={tab === "write" ? "on" : ""} onClick={() => setTab("write")}>
              Write
            </button>
            <button type="button" role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")}>
              Preview
            </button>
          </div>
        </div>
        {tab === "write" ? (
          <textarea id="sf-value" className="textarea sf-text" maxLength={20_000} placeholder="Write or paste it. Markdown works." value={state.value} onChange={(e) => onChange({ ...state, value: e.target.value })} />
        ) : (
          <div className="sf-preview" data-testid="start-preview">
            {preview ? <MarkdownBody text={preview} /> : <span className="faint small">Nothing to preview yet.</span>}
          </div>
        )}
        <span className="hint">The Run gets this text, with the links and the files' paths listed below it.</span>
      </div>

      <div className="field">
        <label htmlFor="sf-links">
          Links <span className="faint">(optional, one per line)</span>
        </label>
        <textarea id="sf-links" className="textarea" rows={2} placeholder="https://…" value={state.links} onChange={(e) => onChange({ ...state, links: e.target.value })} />
        <span className="hint">Claude opens them on your Machine, with your own access.</span>
      </div>

      <div className="field">
        <span className="field-label">
          Files <span className="faint">(optional, any type)</span>
        </span>
        {state.files.length > 0 && (
          <ul className="pick-list" role="list" aria-label="Attached files">
            {state.files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="sf-file">
                <span className="grow">{names[i]}</span>
                <span className="faint small">{size(f.size)}</span>
                <button type="button" className="btn ghost sm icon" aria-label={`Remove ${names[i]}`} onClick={() => onChange({ ...state, files: state.files.filter((_, j) => j !== i) })}>
                  {Icon.x}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn sm" onClick={() => picker.current?.click()} disabled={state.files.length >= ATTACHMENT_LIMITS.files}>
            {Icon.plus}
            Attach files
          </button>
          <input ref={picker} type="file" multiple hidden onChange={(e) => add(e.target.files)} />
          <span className="hint">Up to 10 files, 10 MB each, 25 MB together. They go to your Machine and are deleted from the app once it has them.</span>
        </div>
        {!checked.ok && (
          <span className="err-text small" role="alert">
            {checked.error}
          </span>
        )}
      </div>
    </>
  );
}
