"use client";

import { useActionState, useRef, useState } from "react";
import { CONTINUE_TURNS } from "@clauderon/core";
import { respondAction, type RespondFormState } from "../app/(app)/needs-you/actions";
import { OTHER_CHOICE } from "../server/grill-answers";
import { Icon } from "./icons";

export type OpenRequest = {
  id: string;
  kind: "approve" | "grill" | "turns";
  round: number;
  questions: Question[];
  /** A turn-limit request: the turns the session reached (#218). */
  turns?: number | null;
};

type Question = { id: string; text: string; options?: { label: string; recommended?: boolean }[]; multiSelect?: boolean };

/**
 * The answer form of one waiting Human Node (spec M3 §2, §3): Approve, or
 * Reject with feedback; or one answer per Grill question, all required. Any
 * Member may send it; a second response is told who answered first.
 */
export function HumanForm({ request, runId }: { request: OpenRequest; runId: string }) {
  const [state, action, pending] = useActionState<RespondFormState, FormData>(respondAction, { error: null, done: false });
  const [feedback, setFeedback] = useState("");

  if (state.done) return <p className="small muted">Sent. The Run carries on.</p>;
  const error = state.error && (
    <span className="err-text small" role="alert">
      {state.error}
    </span>
  );

  if (request.kind === "turns") {
    return (
      <form action={action} className="stack" style={{ gap: 8 }} data-testid="turns-form">
        <input type="hidden" name="requestId" value={request.id} />
        <input type="hidden" name="runId" value={runId} />
        <p className="small muted">
          Claude reached this Node&apos;s turn limit{request.turns ? ` after ${request.turns} turns` : ""}. Its work so far is kept: Continue lets the same session go on for up to {CONTINUE_TURNS} more turns, Stop fails the Node.
        </p>
        {error}
        <div className="row">
          <button type="submit" name="decision" value="approve" className="btn ok" disabled={pending}>
            {Icon.check}
            Continue
          </button>
          <button type="submit" name="decision" value="reject" className="btn danger" disabled={pending}>
            {Icon.x}
            Stop
          </button>
        </div>
      </form>
    );
  }

  if (request.kind === "grill") {
    return (
      <form action={action} className="stack" style={{ gap: 12 }} data-testid="grill-form">
        <input type="hidden" name="requestId" value={request.id} />
        <input type="hidden" name="runId" value={runId} />
        <input type="hidden" name="decision" value="answer" />
        {request.questions.map((q, i) =>
          q.options?.length ? (
            <Choices key={q.id} requestId={request.id} index={i} question={q} />
          ) : (
            <div key={q.id} className="field">
              <label htmlFor={`a-${request.id}-${q.id}`}>
                {i + 1}. {q.text}
              </label>
              <textarea className="textarea" id={`a-${request.id}-${q.id}`} name={`answer:${q.id}`} required style={{ minHeight: 56 }} />
            </div>
          ),
        )}
        {error}
        <div className="row">
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? "Sending…" : `Send answers (round ${request.round})`}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="stack" style={{ gap: 8 }} data-testid="approve-form">
      <input type="hidden" name="requestId" value={request.id} />
      <input type="hidden" name="runId" value={runId} />
      <div className="field">
        <label htmlFor={`fb-${request.id}`}>Feedback (required to reject)</label>
        <textarea
          className="textarea"
          id={`fb-${request.id}`}
          name="feedback"
          placeholder="What should change?"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </div>
      {error}
      <div className="row">
        <button type="submit" name="decision" value="approve" className="btn ok" disabled={pending}>
          {Icon.check}
          Approve
        </button>
        <button type="submit" name="decision" value="reject" className="btn danger" disabled={pending || !feedback.trim()}>
          {Icon.x}
          Reject
        </button>
      </div>
    </form>
  );
}

/**
 * A question with Claude's suggested options: one choice (radio) or several
 * (checkbox), the recommended one picked already, and "Other" with a text of
 * the person's own. Typing in that text picks "Other".
 */
function Choices({ requestId, index, question }: { requestId: string; index: number; question: Question }) {
  const other = useRef<HTMLInputElement>(null);
  const type = question.multiSelect ? "checkbox" : "radio";
  const name = `answer:${question.id}`;
  const id = (suffix: string) => `c-${requestId}-${question.id}-${suffix}`;
  return (
    <fieldset className="field choices">
      <legend>
        {index + 1}. {question.text}
        {question.multiSelect && <span className="hint"> · pick any that apply</span>}
      </legend>
      {question.options!.map((o, n) => (
        <label key={o.label} className="choice" htmlFor={id(String(n))}>
          <input type={type} id={id(String(n))} name={name} value={o.label} defaultChecked={o.recommended} required={type === "radio"} />
          <span>
            {o.label}
            {o.recommended && <span className="faint"> (Recommended)</span>}
          </span>
        </label>
      ))}
      <div className="choice">
        <input ref={other} type={type} id={id("other")} name={name} value={OTHER_CHOICE} aria-label="Other" required={type === "radio"} />
        <input
          className="input"
          name={`other:${question.id}`}
          placeholder="Other: write your own answer"
          aria-label={`Other answer to: ${question.text}`}
          onFocus={() => {
            if (other.current) other.current.checked = true;
          }}
        />
      </div>
    </fieldset>
  );
}
