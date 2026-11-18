import { RUN_STATES, snapshotFlow, ticketKeys, topologicalOrder, type RunState } from "@clauderon/core";
import { cancelRun, getRunView, listFlows, listPods, listProjects, listRuns, runStateCounts, type RunFilters } from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";
import { refreshPullRequest } from "./projects";

// The Run page and the Runs list (spec M1 §5).

export type NodeState = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "not reached";

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

/** The Run page (TRK-1, TRK-2): Ticket, Flow, Starter, Pod, state, and a Node timeline in topological order. */
export async function viewRun(deps: AppDeps, runId: string) {
  await refreshPullRequest(deps, runId);
  const run = await getRunView(deps.db, runId);
  if (!run) return "not-found" as const;
  const keyOf = ticketKeys(await listProjects(deps.db));
  const ended = run.run.state !== "queued" && run.run.state !== "running" && run.run.state !== "waiting_for_human";

  const order = topologicalOrder(snapshotFlow(run.snapshot).flow);
  const timeline = order.map((id) => {
    const node = run.snapshot.nodes.find((n) => n.id === id)!;
    const attempts = run.attempts.filter((a) => a.flowNodeId === id);
    const last = attempts.at(-1);
    const state: NodeState = last
      ? last.state === "succeeded" || last.state === "failed" || last.state === "running" || last.state === "cancelled"
        ? last.state
        : "failed"
      : ended
        ? "not reached"
        : "queued";
    // Each input with the Output on its edge, from the latest succeeded Attempt upstream.
    const inputs = node.inputs.flatMap((input) => {
      const edge = run.snapshot.edges.find((e) => e.toFlowNodeId === id && e.toInput === input.name);
      const source = edge && run.attempts.filter((a) => a.flowNodeId === edge.fromFlowNodeId && a.state === "succeeded").at(-1);
      const output = edge && source?.outputs.find((o) => o.name === edge.fromOutput);
      return output ? [{ name: input.name, type: output.type, value: output.value }] : [];
    });
    return {
      id,
      name: node.name,
      kind: node.kind,
      description: node.kind === "command" ? `$ ${node.command ?? ""}` : node.instructions,
      inputs,
      state,
      durationMs: last ? (last.endedAt ?? deps.clock.now()).getTime() - last.startedAt.getTime() : null,
      attempts: attempts.map((a) => ({
        id: a.id,
        number: a.number,
        state: a.state,
        startedAt: a.startedAt,
        endedAt: a.endedAt,
        error: a.error,
        exitCode: a.exitCode,
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        outputs: a.outputs.map((o) => ({ name: o.name, type: o.type, value: o.value })),
      })),
    };
  });

  const tokens = run.attempts.reduce((sum, a) => sum + (a.inputTokens ?? 0) + (a.outputTokens ?? 0), 0);
  const durationMs = run.run.startedAt ? (run.run.endedAt ?? deps.clock.now()).getTime() - run.run.startedAt.getTime() : null;
  return { ...run, key: keyOf(run.project.id, run.ticket.number), timeline, tokens, durationMs };
}
