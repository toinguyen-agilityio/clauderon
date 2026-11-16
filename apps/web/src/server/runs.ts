import { RUN_STATES, snapshotFlow, ticketKeys, topologicalOrder, type RunState } from "@clauderon/core";
import { getRunView, listFlows, listPods, listProjects, listRuns, type RunFilters } from "@clauderon/db";
import type { AppDeps } from "./deps";
import { refreshPullRequest } from "./projects";

// The Run page and the Runs list (spec M1 §5).

export type NodeState = "queued" | "running" | "succeeded" | "failed" | "not reached";

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
  const [result, projects, flows, pods] = await Promise.all([listRuns(deps.db, filters, page), listProjects(deps.db), listFlows(deps.db), listPods(deps.db)]);
  const keyOf = ticketKeys(projects);
  const podOwner = new Map(pods.map((p) => [p.id, p.owner.name ?? p.owner.email]));
  return {
    ...result,
    rows: result.rows.map((r) => ({ ...r, key: keyOf(r.projectId, r.ticketNumber), podOwner: podOwner.get(r.podId) ?? "—" })),
    flows: flows.map((f) => ({ id: f.id, name: f.name })),
    pods: pods.map((p) => ({ id: p.id, owner: p.owner.name ?? p.owner.email })),
  };
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
      ? last.state === "succeeded" || last.state === "failed" || last.state === "running"
        ? last.state
        : "failed"
      : ended
        ? "not reached"
        : "queued";
    return {
      id,
      name: node.name,
      kind: node.kind,
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

  return { ...run, key: keyOf(run.project.id, run.ticket.number), timeline };
}
