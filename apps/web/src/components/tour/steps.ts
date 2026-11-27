/** What a step needs from the Member's setup before it can point at something real. */
export type Need = "machine" | "ticket" | "flow" | "run";

export type StepId = "machines" | "tickets" | "flows" | "start" | "runs" | "pullRequests" | "projects" | "members";

export type Step = {
  id: StepId;
  /** The page this step lives on. */
  route: string;
  /** The element it highlights; the tooltip is centred when it is not on screen (the closed mobile menu). */
  selector: string;
  operatorOnly: boolean;
  needs: readonly Need[];
};

const nav = (area: string) => `[data-tour-nav="${area}"]`;

/** The round, in order: pair, add a Project (Operator), pick a Ticket, the Flow, start, follow the Run, find the Pull request. */
export const STEPS: readonly Step[] = [
  { id: "machines", route: "/machines", selector: ".mach-pair .mach-cmds, .mach-hero", operatorOnly: false, needs: [] },
  { id: "projects", route: "/projects", selector: "#gh-token", operatorOnly: true, needs: [] },
  { id: "tickets", route: "/tickets", selector: nav("tickets"), operatorOnly: false, needs: ["ticket"] },
  { id: "flows", route: "/flows", selector: nav("flows"), operatorOnly: false, needs: ["flow"] },
  { id: "start", route: "/tickets", selector: ".tk-table tbody .cb:not(:disabled)", operatorOnly: false, needs: ["machine", "ticket", "flow"] },
  { id: "runs", route: "/runs", selector: nav("runs"), operatorOnly: false, needs: ["run"] },
  { id: "pullRequests", route: "/pull-requests", selector: nav("pullRequests"), operatorOnly: false, needs: [] },
  { id: "members", route: "/members", selector: nav("members"), operatorOnly: true, needs: [] },
];

/** The nine areas that have a help icon. */
export const AREAS = ["tickets", "runs", "pullRequests", "needsYou", "flows", "machines", "projects", "members", "audit"] as const;
export type Area = (typeof AREAS)[number];
