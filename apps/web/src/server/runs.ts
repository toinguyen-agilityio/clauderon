import {
  RUN_STATES,
  renderRetryContext,
  snapshotFlow,
  ticketKeys,
  topologicalOrder,
  type ApproveSubject,
  type GrillQuestion,
  type HumanResponse,
  type RetryContext,
  type RunState,
} from "@clauderon/core";
import {
  auditOfSubject,
  buildRetryContext,
  cancelRun,
  countOpenHumanRequests,
  getRunView,
  humanRequestsOfRun,
  listAudit,
  listFlows,
  listPods,
  listProjects,
  listRuns,
  nodesFrom,
  openHumanRequests,
  respondToHuman,
  retryRun,
  runStateCounts,
  type AuditFilters,
  type HumanAction,
  type RunFilters,
} from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";
import { refreshPullRequest } from "./projects";

// The Run page and the Runs list (spec M1 §5).

export type NodeState = "queued" | "running" | "waiting_for_human" | "succeeded" | "failed" | "interrupted" | "cancelled" | "not reached";

const isUuid = (v: string | undefined) => !!v && /^[0-9a-f-]{36}$/i.test(v);

/** Filters from a URL, keeping only valid values. */
export function parseRunFilters(params: { state?: string; flow?: string; pod?: string }): RunFilters {
  return {
    state: (RUN_STATES as readonly string[]).includes(params.state ?? "") ? (params.state as RunState) : undefined,
    flowId: isUuid(params.flow) ? params.flow : undefined,
    podId: isUuid(params.pod) ? params.pod : undefined,
  };
}

/** The Runs list (TRK-7): filters combine; newest first; paginated. */
export async function viewRuns(deps: AppDeps, filters: RunFilters, page: number) {
  const [result, projects, flows, pods, counts] = await Promise.all([
    listRuns(deps.db, filters, page),
    listProjects(deps.db),
    listFlows(deps.db),
    listPods(deps.db),
    runStateCounts(deps.db),
  ]);
  const keyOf = ticketKeys(projects);
  const podLabel = new Map(pods.map((p) => [p.id, p.name ?? `${p.owner.name ?? p.owner.email}'s Pod`]));
  return {
    ...result,
    rows: result.rows.map((r) => ({ ...r, key: keyOf(r.projectId, r.ticketNumber), pod: (r.podId && podLabel.get(r.podId)) ?? "Pod removed" })),
    counts,
    flows: flows.map((f) => ({ id: f.id, name: f.name })),
    pods: pods.map((p) => ({ id: p.id, label: p.name ?? `${p.owner.name ?? p.owner.email}'s Pod` })),
  };
}

export type CancelOutcome = { ok: true } | { ok: false; reason: "ended" } | "not-found";

/**
 * Cancel (RUN-8, MEM-2): any Member ends any Active Run as `cancelled` at
 * once; the Gateway then kills the running Attempt and frees the Slot.
 */
export async function cancelRunAs(deps: AppDeps, viewer: Viewer, runId: string): Promise<CancelOutcome> {
  const result = await cancelRun(deps.db, runId, viewer.email, deps.clock.now());
  if (!result.ok) return result.reason === "not-found" ? "not-found" : { ok: false, reason: "ended" };
  if (result.podId) await deps.command({ type: "run.cancel", podId: result.podId, runId, attemptIds: result.cancelledAttemptIds });
  return { ok: true };
}

export type RespondOutcome = { ok: true } | { ok: false; error: string } | "not-found";

/**
 * Approve, Reject or Answer (spec M3 §2, §3, MEM-2): any Member, any open
 * request. The first response wins; a later one is told who answered. Then
 * the Gateway continues the Run, resumes the Grill session or frees the Slot.
 */
export async function respondAs(deps: AppDeps, viewer: Viewer, requestId: string, action: HumanAction): Promise<RespondOutcome> {
  const result = await respondToHuman(deps.db, requestId, viewer.email, action, deps.clock.now());
  if (!result.ok) {
    if (result.reason === "not-found") return "not-found";
    if (result.reason === "invalid") return { ok: false, error: result.error };
    return { ok: false, error: result.cancelled ? "The Run was cancelled meanwhile." : `Already answered by ${result.by}.` };
  }
  if (result.podId) {
    await deps.command(
      result.decision === "reject" ? { type: "schedule", podId: result.podId } : { type: "run.resume", podId: result.podId, runId: result.runId },
    );
  }
  return { ok: true };
}

export type RetryOutcome = { ok: true } | { ok: false; error: string } | "not-found";

/**
 * Retry from a Node (RUN-7, MEM-2): any Member, a Failed or Interrupted Run.
 * The Run joins the end of its Pod's queue; the Gateway schedules it.
 */
export async function retryAs(deps: AppDeps, viewer: Viewer, runId: string, flowNodeId: string, note: string): Promise<RetryOutcome> {
  const result = await retryRun(deps.db, runId, flowNodeId, note.slice(0, 4000), viewer.email, deps.clock.now());
  if (!result.ok) {
    if (result.reason === "not-found") return "not-found";
    const errors = {
      "not-retryable": "Only a Failed or Interrupted Run can be retried.",
      "unknown-node": "That Node is not part of this Run.",
      "no-pod": "This Run's Pod was removed.",
    } as const;
    return { ok: false, error: errors[result.reason] };
  }
  await deps.command({ type: "schedule", podId: result.podId });
  return { ok: true };
}

/** Needs you (RUN-5, spec M3 §3): every open request, oldest first, with how long it waited. */
export async function viewNeedsYou(deps: AppDeps) {
  const [rows, projects] = await Promise.all([openHumanRequests(deps.db), listProjects(deps.db)]);
  const keyOf = ticketKeys(projects);
  const now = deps.clock.now();
  return rows.map((r) => ({
    id: r.request.id,
    kind: r.request.kind,
    round: r.request.round,
    runId: r.runId,
    mode: r.mode,
    key: keyOf(r.projectId, r.ticketNumber),
    ticketTitle: r.ticketTitle,
    ticketUrl: r.ticketUrl,
    flowName: r.flowName,
    nodeName: r.nodeName,
    nodeInstructions: r.nodeInstructions,
    starter: { email: r.starterEmail, name: r.starterName, pictureUrl: r.starterPicture },
    since: r.request.createdAt,
    waitedMs: now.getTime() - r.request.createdAt.getTime(),
    questions: r.request.kind === "grill" ? ((r.request.questions ?? []) as GrillQuestion[]) : [],
    subject: r.request.kind === "approve" ? ((r.request.questions as ApproveSubject | null)?.input ?? null) : null,
  }));
}

export type NeedsYouItem = Awaited<ReturnType<typeof viewNeedsYou>>[number];

/** The count beside Needs you in the navigation. */
export function needsYouCount(deps: AppDeps): Promise<number> {
  return countOpenHumanRequests(deps.db);
}

/** The audit page (RUN-15, NFR-2): newest first, filtered by Member and action. */
export async function viewAudit(deps: AppDeps, params: { member?: string; action?: string; page?: string }) {
  const filters: AuditFilters = { actorEmail: params.member || undefined, action: params.action || undefined };
  const page = Math.max(1, Number(params.page) || 1);
  return { ...(await listAudit(deps.db, filters, page)), page, filters };
}

/** The Run page (TRK-1, TRK-2, spec M3 §8): Ticket, Flow, Starter, Pod, state, a Node timeline, rounds, history. */
export async function viewRun(deps: AppDeps, runId: string) {
  await refreshPullRequest(deps, runId);
  const run = await getRunView(deps.db, runId);
  if (!run) return "not-found" as const;
  const [projects, requests, history] = await Promise.all([listProjects(deps.db), humanRequestsOfRun(deps.db, runId), auditOfSubject(deps.db, "run", runId)]);
  const keyOf = ticketKeys(projects);
  const ended = run.run.state !== "queued" && run.run.state !== "running" && run.run.state !== "waiting_for_human";
  const retryable = run.run.state === "failed" || run.run.state === "interrupted";
  // What a Retry from any Node would be told (RUN-7): the same for every Node.
  const retryContext: RetryContext | null = retryable ? await buildRetryContext(deps.db, runId, "", "you") : null;
  const current = run.attempts.filter((a) => !a.superseded);

  const order = topologicalOrder(snapshotFlow(run.snapshot).flow);
  const timeline = order.map((id) => {
    const node = run.snapshot.nodes.find((n) => n.id === id)!;
    const attempts = run.attempts.filter((a) => a.flowNodeId === id);
    const last = current.filter((a) => a.flowNodeId === id).at(-1);
    const state: NodeState = last ? last.state : ended ? "not reached" : "queued";
    // Each input with the Output on its edge, from the latest succeeded Attempt upstream of this pass.
    const inputsFrom = (pool: typeof run.attempts) =>
      node.inputs.flatMap((input) => {
        const edge = run.snapshot.edges.find((e) => e.toFlowNodeId === id && e.toInput === input.name);
        const source = edge && pool.filter((a) => a.flowNodeId === edge.fromFlowNodeId && a.state === "succeeded").at(-1);
        const output = edge && source?.outputs.find((o) => o.name === edge.fromOutput);
        return output ? [{ name: input.name, type: output.type, value: output.value }] : [];
      });
    const inputs = inputsFrom(current.length > 0 ? current : run.attempts);
    // A Retry from here reruns this Node and every later one, so only earlier Outputs reach it.
    const again = new Set(nodesFrom(run.snapshot, id));
    const retryInputs = retryable ? inputsFrom(current.filter((a) => !again.has(a.flowNodeId))) : [];
    const open = requests.find((r) => !r.respondedAt && attempts.some((a) => a.id === r.attemptId && a.state === "waiting_for_human"));
    return {
      id,
      name: node.name,
      kind: node.kind,
      description: node.kind === "command" ? `$ ${node.command ?? ""}` : node.instructions,
      inputs,
      retryInputs,
      state,
      durationMs: last ? (last.endedAt ?? deps.clock.now()).getTime() - last.startedAt.getTime() : null,
      openRequest: open
        ? {
            id: open.id,
            kind: open.kind,
            round: open.round,
            questions: open.kind === "grill" ? ((open.questions ?? []) as GrillQuestion[]) : [],
            subject: open.kind === "approve" ? ((open.questions as ApproveSubject | null)?.input ?? null) : null,
          }
        : null,
      // Newest first (spec M3 §8).
      attempts: [...attempts].reverse().map((a) => ({
        id: a.id,
        number: a.number,
        state: a.state,
        superseded: a.superseded,
        startedAt: a.startedAt,
        endedAt: a.endedAt,
        error: a.error,
        exitCode: a.exitCode,
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        retryContext: a.retryContext ? renderRetryContext(a.retryContext as RetryContext) : null,
        outputs: a.outputs.map((o) => ({ name: o.name, type: o.type, value: o.value })),
        rounds: requests
          .filter((r) => r.attemptId === a.id)
          .map((r) => ({
            id: r.id,
            kind: r.kind,
            round: r.round,
            askedAt: r.createdAt,
            questions: r.kind === "grill" ? ((r.questions ?? []) as GrillQuestion[]) : [],
            response: r.response as HumanResponse | null,
            respondedBy: r.respondedByEmail,
            respondedAt: r.respondedAt,
          })),
      })),
    };
  });

  const tokens = run.attempts.reduce((sum, a) => sum + (a.inputTokens ?? 0) + (a.outputTokens ?? 0), 0);
  const durationMs = run.run.startedAt ? (run.run.endedAt ?? deps.clock.now()).getTime() - run.run.startedAt.getTime() : null;
  return {
    ...run,
    key: keyOf(run.project.id, run.ticket.number),
    timeline,
    tokens,
    durationMs,
    retryable,
    retryContext: retryContext && (retryContext.feedback || retryContext.failure) ? retryContext : null,
    history: history.map((h) => ({ id: h.id, at: h.at, actorEmail: h.actorEmail, action: h.action, detail: h.detail as Record<string, unknown> })),
  };
}
