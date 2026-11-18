"use client";

import { useActionState, useState } from "react";
import { respondAction, type RespondFormState } from "../app/(app)/needs-you/actions";
import { Icon } from "./icons";

export type OpenRequest = {
  id: string;
  kind: "approve" | "grill";
  round: number;
  questions: { id: string; text: string }[];
};

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

  if (request.kind === "grill") {
    return (
      <form action={action} className="stack" style={{ gap: 12 }} data-testid="grill-form">
        <input type="hidden" name="requestId" value={request.id} />
        <input type="hidden" name="runId" value={runId} />
        <input type="hidden" name="decision" value="answer" />
        {request.questions.map((q, i) => (
          <div key={q.id} className="field">
            <label htmlFor={`a-${request.id}-${q.id}`}>
              {i + 1}. {q.text}
            </label>
            <textarea className="textarea" id={`a-${request.id}-${q.id}`} name={`answer:${q.id}`} required style={{ minHeight: 56 }} />
          </div>
        ))}
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
