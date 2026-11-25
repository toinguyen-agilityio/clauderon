"use client";

import type { InputType } from "@clauderon/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { closeOnBackdrop } from "../../../components/dialog";
import { Icon } from "../../../components/icons";
import type { StartResult } from "../../../server/start";
import { startPullRequestsAction } from "../pull-requests/actions";
import { loadFlowStartAction, loadFlowStartChoicesAction, startFromInputAction } from "./actions";

type Loaded = NonNullable<Awaited<ReturnType<typeof loadFlowStartAction>>>;
type Choice = { value: string; label: string };

const INPUT_LABEL: Record<InputType, string> = { issue: "Ticket", branch: "Branch", "pull-request": "Pull request", plan: "Plan", summary: "Summary" };

/**
 * Starts a Flow whose Input is not a Ticket: a form for that Input's type. `className`
 * styles the button for where it sits (the Flows list or the editor's bar).
 */
export function StartFlow({
  flowId,
  name,
  className = "btn sm",
  icon = Icon.play,
  iconOnly = false,
  disabled = false,
  title,
}: {
  flowId: string;
  name: string;
  className?: string;
  icon?: ReactNode;
  /** Just the icon, named on hover, as among the Flows list's row icons. */
  iconOnly?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        title={iconOnly ? undefined : title}
        aria-label={iconOnly ? `Start ${name}` : undefined}
        data-tip={iconOnly ? "Start Run" : undefined}
        onClick={() => setOpen(true)}
      >
        {icon}
        {!iconOnly && <span>Start Run…</span>}
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
  // Pull requests are picked several at a time: one Run each, in one Batch.
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
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
  const many = type === "pull-request";

  useEffect(() => {
    if (!picks || !type || !projectId) return;
    let current = true;
    setChoices(null);
    setValue("");
    setPicked(new Set());
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
    const result: StartResult = many
      ? await startPullRequestsAction({ flowId, pullRequests: [...picked].map((n) => ({ projectId, number: Number(n) })), extraInstructions: extra })
      : await startFromInputAction({ flowId, projectId, value, extraInstructions: extra });
    setPending(false);
    if (!result.ok) return setError({ text: result.error, machinePage: result.machinePage });
    ref.current?.close();
    router.push(result.runIds.length === 1 ? `/runs/${result.runIds[0]}` : "/runs");
  };

  const toggle = (pick: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(pick)) next.add(pick);
      return next;
    });
  const ready = many ? picked.size > 0 : value.trim() !== "";

  return (
    <dialog ref={ref} {...closeOnBackdrop} className="modal wide" aria-labelledby="sf-title" onClose={onClose}>
      <div className="modal-in">
        <div className="modal-h">
          <div>
            <h2 id="sf-title">Start {name}</h2>
            <p className="muted small" style={{ marginTop: 4 }}>
              {many ? "One Run per pull request, on your Machine." : "One Run on your Machine."}
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
              {many ? (
                <fieldset className="field choices">
                  <legend>Pull requests</legend>
                  {!choices && <span className="faint small">Loading…</span>}
                  {choices?.length === 0 && <span className="faint small">No open pull requests.</span>}
                  {choices && choices.length > 0 && (
                    <ul className="pick-list" role="list">
                      {choices.map((c) => (
                        <li key={c.value}>
                          <label>
                            <input type="checkbox" className="cb" checked={picked.has(c.value)} onChange={() => toggle(c.value)} />
                            <span>{c.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </fieldset>
              ) : (
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
              )}
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
          <button type="button" className="btn primary" disabled={!data || pending || !projectId || !ready} onClick={() => void start()}>
            {Icon.play}
            {pending ? "Starting…" : many && picked.size > 1 ? `Start ${picked.size} Runs` : "Start Run"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
