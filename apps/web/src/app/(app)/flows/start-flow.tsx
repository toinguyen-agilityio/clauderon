"use client";

import type { InputType } from "@clauderon/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { closeOnBackdrop } from "../../../components/dialog";
import { Icon } from "../../../components/icons";
import { loadFlowStartAction, loadFlowStartChoicesAction, startFromInputAction } from "./actions";

type Loaded = NonNullable<Awaited<ReturnType<typeof loadFlowStartAction>>>;
type Choice = { value: string; label: string };

const INPUT_LABEL: Record<InputType, string> = { issue: "Ticket", branch: "Branch", "pull-request": "Pull request", plan: "Plan", summary: "Summary" };

/** Starts a Flow whose Input is not a Ticket: a form for that Input's type. */
export function StartFlow({ flowId, name }: { flowId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn sm" onClick={() => setOpen(true)}>
        {Icon.play}
        Start Run…
      </button>
      {open && <StartFlowDialog flowId={flowId} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

function StartFlowDialog({ flowId, name, onClose }: { flowId: string; name: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [projectId, setProjectId] = useState("");
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [value, setValue] = useState("");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState<{ text: string; machinePage?: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
    void loadFlowStartAction(flowId).then((loaded) => {
      if (!loaded) return setError({ text: "This Flow cannot start now." });
      setData(loaded);
      setProjectId(loaded.projects[0]?.id ?? "");
    });
  }, [flowId]);

  const type = data?.flow.inputType;
  const picks = type === "branch" || type === "pull-request";

  useEffect(() => {
    if (!picks || !type || !projectId) return;
    let current = true;
    setChoices(null);
    setValue("");
    void loadFlowStartChoicesAction(projectId, type).then((result) => {
      if (!current) return;
      if (!result.ok) {
        setChoices([]);
        setError({ text: result.error });
        return;
      }
      setChoices(result.choices);
      const base = data?.projects.find((p) => p.id === projectId)?.baseBranch;
      const preferred = type === "branch" ? result.choices.find((c) => c.value === base) : undefined;
      setValue((preferred ?? result.choices[0])?.value ?? "");
    });
    return () => {
      current = false;
    };
  }, [picks, type, projectId, data]);

  const start = async () => {
    setPending(true);
    setError(null);
    const result = await startFromInputAction({ flowId, projectId, value, extraInstructions: extra });
    setPending(false);
    if (!result.ok) return setError({ text: result.error, machinePage: result.machinePage });
    ref.current?.close();
    router.push(`/runs/${result.runIds[0]}`);
  };

  return (
    <dialog ref={ref} {...closeOnBackdrop} className="modal wide" aria-labelledby="sf-title" onClose={onClose}>
      <div className="modal-in">
        <div className="modal-h">
          <div>
            <h2 id="sf-title">Start {name}</h2>
            <p className="muted small" style={{ marginTop: 4 }}>
              One Run on your Machine.
            </p>
          </div>
          <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
            {Icon.x}
          </button>
        </div>

        <div className="modal-b">
          {!data && !error && <span className="faint small">Loading…</span>}
          {data && type && (
            <>
              <div className="field">
                <label htmlFor="sf-project">Project</label>
                <select id="sf-project" className="select" style={{ width: "100%" }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sf-value">{INPUT_LABEL[type]}</label>
                {picks ? (
                  <select id="sf-value" className="select" style={{ width: "100%" }} value={value} disabled={!choices || choices.length === 0} onChange={(e) => setValue(e.target.value)}>
                    {!choices && <option>Loading…</option>}
                    {choices?.length === 0 && <option>None found</option>}
                    {choices?.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <textarea id="sf-value" className="textarea" maxLength={20_000} value={value} onChange={(e) => setValue(e.target.value)} />
                )}
                {type === "branch" && <span className="hint">The Run works on a new branch made from this one.</span>}
              </div>
              <div className="field">
                <label htmlFor="sf-extra">
                  Extra instructions <span className="faint">(optional)</span>
                </label>
                <textarea id="sf-extra" className="textarea" value={extra} onChange={(e) => setExtra(e.target.value)} />
              </div>
            </>
          )}
          {error && (
            <div className="banner fail" role="alert">
              <div className="grow small">{error.text}</div>
              {error.machinePage && (
                <Link className="btn sm" href={error.machinePage}>
                  Open Machines
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="modal-f">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="button" className="btn primary" disabled={!data || pending || !projectId || !value.trim()} onClick={() => void start()}>
            {Icon.play}
            {pending ? "Starting…" : "Start Run"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
