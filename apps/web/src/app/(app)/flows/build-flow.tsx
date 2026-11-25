"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BrowserEvent } from "@clauderon/protocol";
import { closeOnBackdrop } from "../../../components/dialog";
import { useGatewaySocket } from "../../../components/gateway-socket";
import { Icon } from "../../../components/icons";
import { outputColor } from "../../../components/state-pill";
import { FlowCanvas, type CanvasEdge, type CanvasNode } from "./[id]/flow-canvas";
import { NodeView } from "./[id]/flow-node";
import { importFlowAction } from "./actions";
import { draftView, layOutDraft } from "./draft-view";

/** Whether this Member's Machine can build a Flow now, worked out on the server. */
export type BuildAvailability = { ok: true; machine: string } | { ok: false; reason: string };

type Phase = "describe" | "building" | "preview" | "creating";
type Draft = { flow: string; newNodes: string[] };

const NOOP = () => {};
const MAX_LENGTH = 4000;

/** Starting points the Member can fill in and edit before building. */
const EXAMPLES = [
  { label: "Plan → code → PR", text: "Plan the ticket and let me approve the plan, then code it, run the tests and open a pull request." },
  { label: "Fix a bug", text: "Reproduce the bug from the ticket, write a failing test, fix it, run the tests and open a pull request." },
  { label: "Review a PR", text: "Check out the pull request linked in the ticket, review the diff for bugs and missing tests, and let me approve the review before it is posted." },
];

/** A textarea with a footer showing the length and the shortcut; ⌘/Ctrl+Enter submits. */
function Composer({
  id,
  rows,
  value,
  disabled,
  describedBy,
  placeholder,
  onChange,
  onSubmit,
}: {
  id: string;
  rows: number;
  value: string;
  disabled: boolean;
  describedBy?: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const nearLimit = value.length > MAX_LENGTH * 0.9;
  return (
    <div className={`composer${disabled ? " disabled" : ""}`}>
      <textarea
        id={id}
        rows={rows}
        maxLength={MAX_LENGTH}
        value={value}
        disabled={disabled}
        aria-describedby={describedBy}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="composer-f small muted">
        <span className={nearLimit ? "err-text" : undefined}>
          {value.length}/{MAX_LENGTH}
        </span>
        <span className="composer-kbd">
          <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Enter</kbd>
        </span>
      </div>
    </div>
  );
}

/**
 * Build with Agent (ADR 0008): the Member describes a Flow, Claude Code on their own Machine
 * drafts it through the Gateway, and they preview it, ask for changes or create it with the
 * ordinary import. The draft lives only in this dialog.
 */
export function BuildFlow({ gatewayUrl, availability }: { gatewayUrl: string; availability: BuildAvailability }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const socket = useGatewaySocket(gatewayUrl, open);
  const [draftId, setDraftId] = useState("");
  const [phase, setPhase] = useState<Phase>("describe");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  // The request to send once the socket is open; the Gateway forgets a draft when its socket closes.
  const outbox = useRef<object | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (!socket) {
      if (phaseRef.current === "building" && !outbox.current) {
        setError("Lost the connection to the Gateway. Try again.");
        setPhase(draft ? "preview" : "describe");
      }
      return;
    }
    if (outbox.current) {
      socket.send(JSON.stringify(outbox.current));
      outbox.current = null;
    }
    const onMessage = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as BrowserEvent;
      if (!("draftId" in event) || event.draftId !== draftId) return;
      if (event.type === "draft.ready") {
        setDraft({ flow: layOutDraft(event.flow), newNodes: event.newNodes });
        setNote("");
        setError(null);
        setPhase("preview");
      } else if (event.type === "draft.failed") {
        setError(event.error);
        setPhase((p) => (p === "building" ? (draft ? "preview" : "describe") : p));
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
    // `draft` is read only to choose where a failure lands.
  }, [socket, draftId, draft]);

  useEffect(() => {
    if (phase !== "building") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const send = (request: object) => {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(request));
    else outbox.current = request;
  };

  const show = () => {
    setDraftId(crypto.randomUUID());
    setPhase("describe");
    setDraft(null);
    setNote("");
    setError(null);
    setOpen(true);
    ref.current?.showModal();
    // showModal focuses the Close button first; start in the description instead.
    requestAnimationFrame(() => document.getElementById("build-flow-description")?.focus());
  };

  const close = () => {
    if (phase === "building") send({ type: "draft.cancel", draftId });
    outbox.current = null;
    ref.current?.close();
  };

  const building = (request: object) => {
    setError(null);
    setStartedAt(Date.now());
    setNow(Date.now());
    setPhase("building");
    send(request);
  };

  const build = () => {
    if (!description.trim()) return;
    setDraft(null);
    building({ type: "draft.start", draftId, description: description.trim() });
  };

  const revise = () => {
    if (!draft || !note.trim()) return;
    building({ type: "draft.revise", draftId, description: description.trim(), flow: draft.flow, note: note.trim() });
  };

  const cancel = () => {
    send({ type: "draft.cancel", draftId });
    // A new id, so a late answer to the cancelled call is ignored.
    setDraftId(crypto.randomUUID());
    setPhase(draft ? "preview" : "describe");
  };

  const create = async () => {
    if (!draft) return;
    setPhase("creating");
    const result = await importFlowAction(draft.flow);
    if (!result.ok) {
      setError(result.error);
      setPhase("preview");
      return;
    }
    outbox.current = null;
    ref.current?.close();
    router.push(`/flows/${result.flowId}`);
  };

  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));

  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={show}
        disabled={!availability.ok}
        title={availability.ok ? `Claude Code drafts a Flow on ${availability.machine}` : availability.reason}
      >
        {Icon.sparkle}
        Build with Agent
      </button>
      <dialog ref={ref} {...closeOnBackdrop} onClose={() => setOpen(false)} className="modal wide" aria-labelledby="build-flow-title">
        <div className="modal-in">
          <div className="modal-h">
            <div>
              <h2 id="build-flow-title">Build a Flow with Agent</h2>
              {availability.ok && <p className="small muted">Claude Code drafts it on {availability.machine}, under your own login. Nothing is saved until you create it.</p>}
            </div>
            <button type="button" className="btn ghost sm" aria-label="Close" onClick={close}>
              {Icon.x}
            </button>
          </div>

          <div className="modal-b">
            {(phase === "describe" || (phase === "building" && !draft)) && (
              <div className="field">
                <label htmlFor="build-flow-description">What should the Flow do?</label>
                <span id="build-flow-description-hint" className="hint">
                  Describe the steps in order, where you want to approve or check something, and what the Flow should end with.
                </span>
                <Composer
                  id="build-flow-description"
                  rows={7}
                  value={description}
                  disabled={phase === "building"}
                  describedBy="build-flow-description-hint"
                  placeholder="e.g. Plan the ticket and let me approve the plan, then code it, run the tests and open a pull request."
                  onChange={setDescription}
                  onSubmit={build}
                />
                {phase === "describe" && (
                  <div className="chips build-examples" aria-label="Start from an example">
                    <span className="small muted">Start from:</span>
                    {EXAMPLES.map((ex) => (
                      <button key={ex.label} type="button" className="fchip" onClick={() => setDescription(ex.text)}>
                        {ex.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {draft && phase !== "describe" && <DraftPreview flow={draft.flow} newNodes={draft.newNodes} />}

            {draft && (phase === "preview" || phase === "building") && (
              <div className="field">
                <label htmlFor="build-flow-note">Suggest changes</label>
                <Composer id="build-flow-note" rows={3} value={note} disabled={phase === "building"} placeholder="e.g. Add a review step before the pull request." onChange={setNote} onSubmit={revise} />
              </div>
            )}

            {phase === "building" && (
              <p className="small muted" role="status" aria-live="polite">
                Claude is drafting on your Machine… {seconds}s
              </p>
            )}
            {error && (
              <span className="err-text small" role="alert">
                {error}
              </span>
            )}
          </div>

          <div className="modal-f">
            {phase === "building" ? (
              <button type="button" className="btn" onClick={cancel}>
                Stop
              </button>
            ) : phase === "describe" ? (
              <>
                <button type="button" className="btn" onClick={close}>
                  Cancel
                </button>
                <button type="button" className="btn primary" disabled={!description.trim()} onClick={build}>
                  Build
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn" disabled={phase === "creating"} onClick={() => { setDraft(null); setPhase("describe"); setError(null); }}>
                  Discard
                </button>
                <button type="button" className="btn" disabled={!note.trim() || phase === "creating"} onClick={revise}>
                  Suggest changes
                </button>
                <button type="button" className="btn primary" disabled={phase === "creating"} onClick={() => void create()}>
                  {phase === "creating" ? "Creating…" : "Create Flow"}
                </button>
              </>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

/** The draft drawn read-only on the editor's canvas, with the Nodes it would add to the library. */
function DraftPreview({ flow, newNodes }: { flow: string; newNodes: string[] }) {
  const view = useMemo(() => draftView(flow), [flow]);
  const nodes: CanvasNode[] = view.placements.flatMap((p) => {
    const lib = view.library.get(p.nodeId);
    if (!lib) return [];
    return [
      {
        id: p.id,
        x: p.x,
        y: p.y,
        selected: false,
        content: (
          <NodeView id={p.id} lib={lib} placement={p} selected={false} focused={false} readOnly problems={[]} wire={null} renaming={false} onRename={NOOP} onAction={NOOP} onAdd={NOOP} />
        ),
      },
    ];
  });
  const typeOf = (placementId: string, output: string) => {
    const placement = view.placements.find((p) => p.id === placementId);
    return view.library.get(placement?.nodeId ?? "")?.outputs.find((o) => o.name === output)?.type ?? "";
  };
  const edges: CanvasEdge[] = view.edges.map((e) => ({
    id: e.id,
    fromNodeId: e.fromFlowNodeId,
    fromOutput: e.fromOutput,
    toNodeId: e.toFlowNodeId,
    toInput: e.toInput,
    selected: false,
    reason: null,
    color: outputColor(typeOf(e.fromFlowNodeId, e.fromOutput)),
  }));

  return (
    <div className="draft-preview">
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <strong>{view.name}</strong>
        <span className="small muted">
          {view.placements.length} Nodes · {newNodes.length === 0 ? "uses library Nodes only" : `${newNodes.length} new in the library`}
        </span>
      </div>
      <div className="fe draft-canvas" data-testid="draft-canvas">
        <div className="flow-canvas">
          <FlowCanvas nodes={nodes} edges={edges} readOnly onSelect={NOOP} onMoveNodes={NOOP} onConnect={NOOP} onDelete={NOOP} canConnect={() => false} />
        </div>
      </div>
      {newNodes.length > 0 && (
        <p className="small muted">
          New library Nodes: {newNodes.join(", ")}. Review them in the editor after you create the Flow; editing a library Node changes every Flow that uses it.
        </p>
      )}
    </div>
  );
}
