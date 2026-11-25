import {
  RUN_STATES,
  contextSize,
  findWaste,
  historyEntry,
  rereads,
  resultBytesOf,
  renderRetryContext,
  suggest,
  summarizeTurns,
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
  listMachines,
  listProjects,
  listPullRequests,
  listRuns,
  nodeAttemptHistory,
  RUNS_PAGE_SIZE,
  listMembers,
  nodesFrom,
  openHumanRequests,
  respondToHuman,
  retryRun,
  retryableNodes,
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
export function parseRunFilters(params: { state?: string; flow?: string; machine?: string }): RunFilters {
  return {
    state: (RUN_STATES as readonly string[]).includes(params.state ?? "") ? (params.state as RunState) : undefined,
    flowId: isUuid(params.flow) ? params.flow : undefined,
    machineId: isUuid(params.machine) ? params.machine : undefined,
  };
}

/** The Runs list (TRK-7): filters combine; newest first; paginated. */
export async function viewRuns(deps: AppDeps, filters: RunFilters, page: number) {
  const [result, projects, flows, machines, counts] = await Promise.all([
    listRuns(deps.db, filters, page),
    listProjects(deps.db),
    listFlows(deps.db),
    listMachines(deps.db),
    runStateCounts(deps.db),
  ]);
  const keyOf = ticketKeys(projects);
  const machineLabel = new Map(machines.map((p) => [p.id, p.name ?? `${p.owner.name ?? p.owner.email}'s Machine`]));
  return {
    ...result,
    rows: result.rows.map((r) => ({ ...r, key: keyOf(r.projectId, r.ticketNumber), machine: (r.machineId && machineLabel.get(r.machineId)) ?? "Machine removed" })),
    counts,
    flows: flows.map((f) => ({ id: f.id, name: f.name })),
    machines: machines.map((p) => ({ id: p.id, label: p.name ?? `${p.owner.name ?? p.owner.email}'s Machine` })),
  };
}

export type PullRequestTab = "needs-you";

/** The tab from a URL: "needs-you", or anything else for every open pull request. */
export function parsePullRequestTab(tab: string | undefined): PullRequestTab | undefined {
  return tab === "needs-you" ? tab : undefined;
}

export type PullRequestRow = {
  /** Unique per row: the Project and the pull request number. */
  id: string;
  projectId: string;
  repo: string;
  number: number;
  url: string | null;
  title: string | null;
  branch: string | null;
  at: Date;
  /** Who opened it on GitHub, for one a Run did not open. */
  authorLogin: string | null;
  /** The viewer's GitHub login is asked to review it. */
  needsYou: boolean;
  /** The Member who opened it: their Run did, or its author is their Machine's gh login. */
  openedBy: string | null;
  /** The Run that opened it, if one did. */
  run: { id: string; key: string; ticketTitle: string; flowName: string; starterName: string | null; starterEmail: string; starterPicture: string | null } | null;
};

/** `memberId` is a Member's id, or "me" for the viewer. */
export type PullRequestQuery = { tab?: PullRequestTab; projectId?: string; memberId?: string; page: number };

/**
 * The Pull requests page: every open pull request of every Project, read from
 * GitHub (cached briefly by the reader), with the Run that opened it when one did.
 * "Needs you" are the ones asking the gh login of the viewer's Machine for a
 * review. For a Project GitHub cannot read, the page
 * falls back to the pull requests its Runs recorded as open, and says so.
 */
export async function viewPullRequests(deps: AppDeps, viewer: Viewer, query: PullRequestQuery) {
  const [projects, fromRuns, machines, members] = await Promise.all([listProjects(deps.db), listPullRequests(deps.db), listMachines(deps.db), listMembers(deps.db)]);
  const fromGitHub = await Promise.all(
    projects.map(async (p) => {
      try {
        return { project: p, pulls: await deps.github.listOpenPullRequests(p.owner, p.repo), error: null };
      } catch (error) {
        return { project: p, pulls: null, error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );

  const keyOf = ticketKeys(projects);
  const machine = machines.find((m) => m.memberId === viewer.id);
  const me = machine?.ghAccount?.toLowerCase() ?? null;
  const memberOfLogin = new Map(machines.filter((m) => m.ghAccount).map((m) => [m.ghAccount!.toLowerCase(), m.memberId]));
  const runOf = new Map(fromRuns.map((r) => [`${r.projectId}#${r.pullRequestNumber}`, r]));
  const runPart = (r: (typeof fromRuns)[number]): PullRequestRow["run"] => ({
    id: r.id,
    key: keyOf(r.projectId, r.ticketNumber),
    ticketTitle: r.ticketTitle,
    flowName: r.flowName,
    starterName: r.starterName,
    starterEmail: r.starterEmail,
    starterPicture: r.starterPicture,
  });

  const all: PullRequestRow[] = [];
  for (const { project, pulls } of fromGitHub) {
    if (pulls) {
      for (const pr of pulls) {
        const r = runOf.get(`${project.id}#${pr.number}`);
        all.push({
          id: `${project.id}#${pr.number}`,
          projectId: project.id,
          repo: project.repo,
          number: pr.number,
          url: pr.url,
          title: pr.title,
          branch: pr.branch,
          at: pr.createdAt,
          authorLogin: pr.authorLogin,
          needsYou: !!me && pr.reviewers.some((login) => login.toLowerCase() === me),
          openedBy: r?.starterMemberId ?? memberOfLogin.get(pr.authorLogin.toLowerCase()) ?? null,
          run: r ? runPart(r) : null,
        });
      }
    } else {
      for (const r of fromRuns.filter((r) => r.projectId === project.id && r.pullRequestState === "open")) {
        all.push({
          id: `${project.id}#${r.pullRequestNumber}`,
          projectId: project.id,
          repo: project.repo,
          number: r.pullRequestNumber!,
          url: r.pullRequestUrl,
          title: null,
          branch: r.branch,
          at: r.queuedAt,
          authorLogin: null,
          needsYou: false,
          openedBy: r.starterMemberId,
          run: runPart(r),
        });
      }
    }
  }

  all.sort((a, b) => b.at.getTime() - a.at.getTime() || b.number - a.number);
  const memberId = query.memberId === "me" ? viewer.id : query.memberId;
  const ofMember = all.filter((r) => !memberId || r.openedBy === memberId);
  const ofProject = ofMember.filter((r) => !query.projectId || r.projectId === query.projectId);
  const perProject: Record<string, number> = {};
  for (const r of ofMember) perProject[r.projectId] = (perProject[r.projectId] ?? 0) + 1;

  const listed = ofProject.filter((r) => query.tab !== "needs-you" || r.needsYou);
  const page = Math.max(1, query.page);
  const start = (page - 1) * RUNS_PAGE_SIZE;
  return {
    projects: projects.map((p) => ({ id: p.id, repo: p.repo })),
    /** Counts below follow the Member filter. */
    total: ofMember.length,
    perProject,
    members: members.filter((m) => m.id !== viewer.id).map((m) => ({ id: m.id, label: m.name ?? m.email })),
    /** The tab counts, of the chosen Project (or all). */
    counts: { open: ofProject.length, needsYou: ofProject.filter((r) => r.needsYou).length },
    /** The viewer's gh login, from their Machine; without one nothing "needs you". */
    ghAccount: machine?.ghAccount ?? null,
    rows: listed.slice(start, start + RUNS_PAGE_SIZE),
    hasMore: listed.length > start + RUNS_PAGE_SIZE,
    errors: fromGitHub.filter((g) => g.error).map((g) => ({ repo: g.project.repo, error: g.error! })),
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
  if (result.machineId) await deps.command({ type: "run.cancel", machineId: result.machineId, runId, attemptIds: result.cancelledAttemptIds });
  if (result.from === "waiting_for_human") await deps.command({ type: "needs.changed" });
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
  if (result.machineId) {
    await deps.command(
      result.decision === "reject" ? { type: "schedule", machineId: result.machineId } : { type: "run.resume", machineId: result.machineId, runId: result.runId },
    );
  }
  // The request left every open Needs you page, whatever the decision and even without a Machine.
  await deps.command({ type: "needs.changed" });
  return { ok: true };
}

export type RetryOutcome = { ok: true } | { ok: false; error: string } | "not-found";

/**
 * Retry from a Node (RUN-7, MEM-2): any Member, a Failed or Interrupted Run.
 * The Run joins the end of its Machine's queue; the Gateway schedules it.
 */
export async function retryAs(deps: AppDeps, viewer: Viewer, runId: string, flowNodeId: string, note: string): Promise<RetryOutcome> {
  const result = await retryRun(deps.db, runId, flowNodeId, note.slice(0, 4000), viewer.email, deps.clock.now());
  if (!result.ok) {
    if (result.reason === "not-found") return "not-found";
    const errors = {
      "not-retryable": "Only a Failed or Interrupted Run can be retried.",
      "unknown-node": "That Node is not part of this Run.",
      "after-failure": "Retry from the Node that failed or an earlier one: a Retry cannot skip a Node that did not succeed.",
      "no-machine": "This Run's Machine was removed.",
    } as const;
    return { ok: false, error: errors[result.reason] };
  }
  await deps.command({ type: "schedule", machineId: result.machineId });
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

/** The Run page (TRK-1, TRK-2, spec M3 §8): Ticket, Flow, Starter, Machine, state, a Node timeline, rounds, history. */
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
  // The same Node in earlier Runs of this Flow (#105), for the Inspector's history.
  const claudeNodes = order.filter((id) => ["agent", "grill"].includes(run.snapshot.nodes.find((n) => n.id === id)?.kind ?? ""));
  const histories = new Map(
    await Promise.all(
      claudeNodes.map(async (id) => {
        // A deleted Flow leaves its Runs without one: no earlier Runs to compare.
        const earlier = run.run.flowId ? await nodeAttemptHistory(deps.db, run.run.flowId, id, runId) : [];
        return [id, earlier.map((h) => historyEntry({ runId: h.runId, at: h.at, turns: (h.turns ?? []).map(withCalls) }))] as const;
      }),
    ),
  );
  const canRetryFrom = new Set(retryable ? retryableNodes(run.snapshot, current) : []);
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
      canRetry: canRetryFrom.has(id),
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
        inspector: inspectorOf(a, histories.get(id) ?? []),
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
    key: keyOf(run.project.id, run.ticket?.number ?? null),
    timeline,
    tokens,
    durationMs,
    retryable,
    retryContext: retryContext && (retryContext.feedback || retryContext.failure) ? retryContext : null,
    history: history.map((h) => ({ id: h.id, at: h.at, actorEmail: h.actorEmail, action: h.action, detail: h.detail as Record<string, unknown> })),
  };
}

/**
 * Turns stored before each turn kept its tool calls (4054bbe) have one `tool`, `target` and
 * `resultBytes` on the turn and no `calls`; read them as a turn with that one call.
 */
type StoredTurn = Omit<import("@clauderon/core").Turn, "calls"> & { calls?: import("@clauderon/core").Call[]; tool?: string | null; target?: string | null; resultBytes?: number | null };

function withCalls(stored: import("@clauderon/core").Turn): import("@clauderon/core").Turn {
  const { tool, target, resultBytes, calls, ...turn } = stored as StoredTurn;
  if (calls) return { ...turn, calls };
  return { ...turn, calls: tool ? [{ tool, target: target ?? null, resultBytes: resultBytes ?? null }] : [] };
}

type InspectedAttempt = { inputTokens: number | null; outputTokens: number | null; cacheCreationTokens: number | null; cacheReadTokens: number | null; turns: import("@clauderon/core").Turn[] | null };

/**
 * What the Node inspector shows for one Attempt (#105). An Attempt without turns (an older Agent,
 * or a Node that is not a Claude session) has totals only; the turn list, findings and
 * suggestions come from the per-turn summary.
 */
export function inspectorOf(a: InspectedAttempt, history: ReturnType<typeof historyEntry>[]) {
  const turns = (a.turns ?? []).map(withCalls);
  const findings = findWaste(turns);
  const totalsOnly = a.inputTokens !== null || a.outputTokens !== null ? { input: a.inputTokens ?? 0, output: a.outputTokens ?? 0, cacheCreated: a.cacheCreationTokens, cacheRead: a.cacheReadTokens } : null;
  return {
    hasTurns: turns.length > 0,
    totalsOnly,
    summary: summarizeTurns(turns),
    turns: turns.map((t) => ({ ...t, context: contextSize(t), resultBytes: resultBytesOf(t), rereads: rereads(turns, t) })),
    findings,
    suggestions: suggest(findings),
    history,
  };
}
