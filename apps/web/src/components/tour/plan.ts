import { STEPS, type Need, type Step } from "./steps";

/** What the tour knows about the Member's setup (counts, and the Tickets and Flows to offer). */
export type PlanFacts = {
  machines: number;
  tickets: readonly { id: string; key: string; title: string }[];
  flows: readonly { id: string; name: string }[];
  runs: number;
  pullRequests: number;
};

export type PlannedStep = Step & {
  /** The first thing missing, and where to fix it; the step then says so instead of pointing at an empty area. */
  missing?: { need: Need; href: string };
};

const FIX: Record<Need, string> = { machine: "/machines", ticket: "/tickets", flow: "/flows", run: "/tickets" };

function has(need: Need, facts: PlanFacts): boolean {
  if (need === "machine") return facts.machines > 0;
  if (need === "ticket") return facts.tickets.length > 0;
  if (need === "flow") return facts.flows.length > 0;
  return facts.runs > 0;
}

/** The steps this Member sees: Operator-only steps only for an Operator; steps with a missing prerequisite say so. */
export function buildSteps(isOperator: boolean, facts: PlanFacts): PlannedStep[] {
  return STEPS.filter((s) => isOperator || !s.operatorOnly).map((s) => {
    const need = s.needs.find((n) => !has(n, facts));
    return need ? { ...s, missing: { need, href: FIX[need] } } : { ...s };
  });
}
