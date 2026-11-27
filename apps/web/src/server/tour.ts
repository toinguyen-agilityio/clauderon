import { isActive, ticketKeys } from "@clauderon/core";
import { getMachineOfMember, isOperator, listProjects, listPullRequests, listRuns, listTicketsWithRuns } from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";
import { startableFlows } from "./start";

/** What the guided tour needs to know about the Member's setup: counts and ids only. */
export type TourFacts = {
  isOperator: boolean;
  machines: number;
  tickets: { id: string; key: string; title: string }[];
  flows: { id: string; name: string }[];
  runs: number;
  firstRunId: string | null;
  pullRequests: number;
};

const MAX_TICKETS = 20;

export async function tourFacts(deps: AppDeps, viewer: Viewer): Promise<TourFacts> {
  const [machine, projects, tickets, flows, runs, pulls] = await Promise.all([
    getMachineOfMember(deps.db, viewer.id),
    listProjects(deps.db),
    listTicketsWithRuns(deps.db),
    startableFlows(deps),
    listRuns(deps.db, {}, 1, 1),
    listPullRequests(deps.db),
  ]);
  const keyOf = ticketKeys(projects);
  const free = tickets.filter((t) => t.issueState !== "closed" && !t.runs.some((r) => isActive(r.state)));
  return {
    isOperator: isOperator(viewer.email, deps.operators),
    machines: machine?.tokenHash ? 1 : 0,
    tickets: free.slice(0, MAX_TICKETS).map((t) => ({ id: t.id, key: keyOf(t.projectId, t.number), title: t.title })),
    flows: flows.filter((f) => f.inputType === "issue").map((f) => ({ id: f.id, name: f.name })),
    runs: runs.total,
    firstRunId: runs.rows[0]?.id ?? null,
    pullRequests: pulls.length,
  };
}
