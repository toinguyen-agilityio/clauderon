import { randomUUID } from "node:crypto";
import {
  FLOW_DRAFT_TIMEOUT_MS,
  agentSupportsFlowDrafts,
  flowDraftPrompt,
  flowDraftRepairPrompt,
  flowDraftRevisePrompt,
  mask,
  readFlowDraft,
  type Clock,
  type DraftLibraryNode,
  type TimerHandle,
} from "@clauderon/core";
import { getMachineOfMember, listLibraryRows, type Db, type Member } from "@clauderon/db";
import { browserRequest, parseBrowserMessage, type BrowserEvent, type LinkSocket, type Payload } from "@clauderon/protocol";
import type { MachineLinks } from "./machine-link";

export type FlowDraftsOptions = {
  db: Db;
  links: MachineLinks;
  clock: Clock;
  secrets: readonly string[];
  timeoutMs?: number;
  log?: (message: string) => void;
};

/** What the next call is for: a first answer, the Member's change, or fixing an invalid answer. */
type Purpose = "start" | "revise" | "repair";

/** One Claude Code call of a draft, on its Machine. */
type Job = { id: string; purpose: Purpose; timer: TimerHandle; resumed: boolean };

/**
 * One Flow Draft (ADR 0008). Held in memory only: the browser that asked keeps the draft it
 * shows, so after a Gateway restart a change simply starts a fresh Claude session from it.
 */
type Draft = {
  id: string;
  socket: LinkSocket;
  machineId: string;
  description: string;
  /** The last Flow file sent to the browser, and the note being applied. */
  flow: string | null;
  note: string | null;
  sessionId: string | null;
  /** Each answer may be repaired once; reset when a new request comes in. */
  repaired: boolean;
  job: Job | null;
};

/**
 * Flow Drafts (ADR 0008): a browser asks, the Gateway sends Claude Code's work to the Member's
 * own Machine (no Slot, no Run), checks the answer as an import would, asks the same session to
 * fix an invalid one once, and gives the browser a Flow file to preview. Nothing is stored.
 */
export class FlowDrafts {
  private drafts = new Map<string, Draft>();
  private jobs = new Map<string, string>();

  constructor(private readonly opts: FlowDraftsOptions) {}

  /** Handles one message from an authenticated browser socket; other messages are not ours. */
  async handle(socket: LinkSocket, member: Member, text: string): Promise<void> {
    const request = parseBrowserMessage(browserRequest, text);
    if (!request) return;
    switch (request.type) {
      case "draft.start":
        return this.start(socket, member, request.draftId, request.description);
      case "draft.revise":
        return this.revise(socket, member, request);
      case "draft.cancel": {
        const draft = this.drafts.get(request.draftId);
        if (draft?.socket === socket) this.forget(draft);
        return;
      }
    }
  }

  /** The browser went away: its drafts end and their calls are killed. */
  drop(socket: LinkSocket): void {
    for (const draft of [...this.drafts.values()]) if (draft.socket === socket) this.forget(draft);
  }

  /** A `flow.drafted` from an Agent. */
  async drafted(payload: Payload<"flow.drafted">, machineId: string): Promise<void> {
    const draftId = this.jobs.get(payload.jobId);
    const draft = draftId ? this.drafts.get(draftId) : undefined;
    if (!draft || draft.job?.id !== payload.jobId || draft.machineId !== machineId) return;
    const job = draft.job;
    this.endJob(draft);
    if (payload.sessionId) draft.sessionId = payload.sessionId;

    if (payload.unknownSession && job.resumed) {
      // Claude Code lost the session: carry the draft into a fresh one.
      draft.sessionId = null;
      return this.send(draft, job.purpose === "repair" ? "revise" : job.purpose, await this.freshPrompt(draft));
    }
    if (payload.exitCode !== 0 || payload.finalText === undefined) {
      return this.fail(draft, payload.error ?? `Claude Code exited ${payload.exitCode}`);
    }

    const read = readFlowDraft(payload.finalText, await this.library());
    if (read.ok) {
      draft.flow = JSON.stringify(read.file, null, 2);
      draft.note = null;
      return this.emit(draft, { type: "draft.ready", draftId: draft.id, flow: draft.flow, newNodes: read.newNodes });
    }
    if (draft.repaired) return this.fail(draft, `Claude's Flow is not valid: ${read.error}`);
    draft.repaired = true;
    if (draft.sessionId) return this.send(draft, "repair", flowDraftRepairPrompt(read.error), draft.sessionId);
    return this.send(draft, "repair", `${await this.freshPrompt(draft)}\n\n${flowDraftRepairPrompt(read.error)}`);
  }

  private async start(socket: LinkSocket, member: Member, draftId: string, description: string): Promise<void> {
    const existing = this.drafts.get(draftId);
    if (existing) {
      if (existing.socket !== socket) return;
      this.forget(existing);
    }
    const machineId = await this.machineFor(socket, member, draftId);
    if (!machineId) return;
    const draft: Draft = { id: draftId, socket, machineId, description, flow: null, note: null, sessionId: null, repaired: false, job: null };
    this.drafts.set(draftId, draft);
    this.send(draft, "start", flowDraftPrompt({ description, library: await this.library() }));
  }

  private async revise(socket: LinkSocket, member: Member, request: { draftId: string; description: string; flow: string; note: string }): Promise<void> {
    let draft = this.drafts.get(request.draftId);
    if (draft && draft.socket !== socket) return;
    if (draft?.job) return this.fail(draft, "Claude is still working on this draft.");
    const machineId = await this.machineFor(socket, member, request.draftId);
    if (!machineId) return;
    if (!draft || draft.machineId !== machineId) {
      // A Gateway restart, or the draft started elsewhere: no session to resume.
      draft = { id: request.draftId, socket, machineId, description: request.description, flow: null, note: null, sessionId: null, repaired: false, job: null };
      this.drafts.set(draft.id, draft);
    }
    draft.flow = request.flow;
    draft.note = request.note;
    draft.repaired = false;
    if (draft.sessionId) return this.send(draft, "revise", flowDraftRevisePrompt(request.note), draft.sessionId);
    this.send(draft, "revise", await this.freshPrompt(draft));
  }

  /** The Member's Machine, when it can take a draft; otherwise the browser is told why. */
  private async machineFor(socket: LinkSocket, member: Member, draftId: string): Promise<string | null> {
    const machine = await getMachineOfMember(this.opts.db, member.id);
    const why = !machine?.tokenHash
      ? "Pair your Machine first: Claude runs on your own computer."
      : !this.opts.links.connected(machine.id)
        ? "Your Machine is not connected. Start its Agent and try again."
        : !agentSupportsFlowDrafts(machine.agentVersion)
          ? "Your Machine's Agent is too old to build Flows. Update the Agent and try again."
          : null;
    if (why || !machine) {
      sendEvent(socket, { type: "draft.failed", draftId, error: why ?? "No Machine." });
      return null;
    }
    return machine.id;
  }

  private async freshPrompt(draft: Draft): Promise<string> {
    return flowDraftPrompt({ description: draft.description, library: await this.library(), previous: draft.flow ?? undefined, note: draft.note ?? undefined });
  }

  private send(draft: Draft, purpose: Purpose, prompt: string, resumeSessionId?: string): void {
    const id = randomUUID();
    const timer = this.opts.clock.setTimeout(() => {
      if (draft.job?.id !== id) return;
      this.opts.links.send(draft.machineId, "flow.draftKill", { jobId: id });
      this.endJob(draft);
      this.fail(draft, `Claude took longer than ${Math.round((this.opts.timeoutMs ?? FLOW_DRAFT_TIMEOUT_MS) / 60_000)} minutes. Try a shorter description.`);
    }, this.opts.timeoutMs ?? FLOW_DRAFT_TIMEOUT_MS);
    draft.job = { id, purpose, timer, resumed: Boolean(resumeSessionId) };
    this.jobs.set(id, draft.id);
    this.opts.links.send(draft.machineId, "flow.draft", { draftId: draft.id, jobId: id, prompt, ...(resumeSessionId ? { resumeSessionId } : {}) });
  }

  private endJob(draft: Draft): void {
    if (!draft.job) return;
    this.opts.clock.clearTimeout(draft.job.timer);
    this.jobs.delete(draft.job.id);
    draft.job = null;
  }

  private forget(draft: Draft): void {
    if (draft.job) this.opts.links.send(draft.machineId, "flow.draftKill", { jobId: draft.job.id });
    this.endJob(draft);
    this.drafts.delete(draft.id);
  }

  /** The draft stays (its session too), so the Member can still change it or try again. */
  private fail(draft: Draft, error: string): void {
    this.emit(draft, { type: "draft.failed", draftId: draft.id, error: mask(error, this.opts.secrets) });
  }

  private emit(draft: Draft, event: BrowserEvent): void {
    sendEvent(draft.socket, event);
  }

  private async library(): Promise<DraftLibraryNode[]> {
    const rows = await listLibraryRows(this.opts.db);
    return rows.map((r) => ({ name: r.name, kind: r.kind, instructions: r.instructions, command: r.command, inputs: r.inputs, outputs: r.outputs }));
  }
}

function sendEvent(socket: LinkSocket, event: BrowserEvent): void {
  socket.send(JSON.stringify(event));
}
