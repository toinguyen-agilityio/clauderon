import { INPUT_TYPES, attachmentNames, checkAttachments, checkLinks, checkRunInput, composeInputText, isEntryKind, isMachineReady, queuePositions, runInputTitle, ticketKeys, validateFlow, type InputType, type RunInput } from "@clauderon/core";
import {
  buildFlowSnapshot,
  getMachineOfMember,
  getRun,
  getTickets,
  listFlows,
  listProjects,
  loadFlow,
  loadLibrary,
  machineRunCounts,
  sealAttachment,
  startBatch,
} from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";

// The Start dialog and Batch creation (spec M1 §4.1).

const FLOW_DELETED = "That Flow was deleted just now. Pick another.";

const TRUSTED = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

/** Flows without problems (RUN-1): only those can start Runs. */
export async function startableFlows(deps: AppDeps) {
  const [flows, library] = await Promise.all([listFlows(deps.db), loadLibrary(deps.db)]);
  const kinds = new Map(library.map((n) => [n.id, n.kind]));
  const byId = new Map(library.map((n) => [n.id, n]));
  const ok = [];
  for (const flow of flows) {
    const graph = await loadFlow(deps.db, flow.id);
    if (validateFlow(graph, library).length > 0) continue;
    const entry = graph.nodes.map((n) => byId.get(n.nodeId)).find((n) => n && isEntryKind(n.kind));
    const inputType = entry?.outputs[0]?.type;
    if (!inputType || !(INPUT_TYPES as readonly string[]).includes(inputType)) continue;
    const runnable = graph.nodes.filter((n) => !isEntryKind(kinds.get(n.nodeId)!));
    // A Flow with Human Nodes waits for people at them (spec M3 §2).
    const needsHuman = runnable.some((n) => kinds.get(n.nodeId) === "approve" || kinds.get(n.nodeId) === "grill");
    ok.push({ id: flow.id, name: flow.name, nodes: runnable.length, needsHuman, inputType: inputType as InputType });
  }
  return ok;
}

async function keysFor(deps: AppDeps) {
  return ticketKeys(await listProjects(deps.db));
}

/** The Starter's Machine with Slots and Machine Ready, and where `count` new Runs would land. */
async function startingMachineView(deps: AppDeps, viewer: Viewer, count: number) {
  const machine = await getMachineOfMember(deps.db, viewer.id);
  const counts = machine ? (await machineRunCounts(deps.db, [machine.id])).get(machine.id)! : null;
  return {
    machine:
      machine && counts
        ? { id: machine.id, connected: machine.connected, paired: machine.tokenHash !== null, slots: machine.slots, ...counts, ready: isMachineReady(machine) }
        : null,
    // Where each new Run would land: 0 starts at once, n is the n-th waiting (spec M2 §6).
    positions: machine && counts ? queuePositions({ slots: machine.slots, ...counts }, count) : [],
  };
}

/** What the dialog shows: Flows, the Starter's Machine with Slots and Machine Ready, author warnings. */
export async function startDialog(deps: AppDeps, viewer: Viewer, ticketIds: readonly string[]) {
  const [flows, mine, tickets, keyOf] = await Promise.all([
    startableFlows(deps).then((all) => all.filter((f) => f.inputType === "issue")),
    startingMachineView(deps, viewer, ticketIds.length),
    getTickets(deps.db, ticketIds),
    keysFor(deps),
  ]);
  return {
    flows,
    ...mine,
    tickets: tickets.map((t) => ({ id: t.id, key: keyOf(t.projectId, t.number), title: t.title })),
    // Not blocking (TIC-9): the Starter decides.
    warnings: tickets
      .filter((t) => !TRUSTED.has(t.authorAssociation ?? ""))
      .map((t) => ({ ticketId: t.id, key: keyOf(t.projectId, t.number), authorAssociation: t.authorAssociation ?? "NONE" })),
  };
}

export type StartInput = { flowId: string; ticketIds: readonly string[]; extraInstructions: string };
export type StartResult = { ok: true; batchId: string; runIds: string[] } | { ok: false; error: string; machinePage?: string };

/** The Starter's Machine, once it is paired with both logins as last checked (POD-5). */
async function startingMachine(deps: AppDeps, viewer: Viewer) {
  const machine = await getMachineOfMember(deps.db, viewer.id);
  if (!machine?.tokenHash) return { ok: false as const, error: "You have no paired Machine yet.", machinePage: "/machines" };
  const machinePage = `/machines/${machine.id}`;
  const fix = "Log in on your Machine in your own terminal, then check logins on its page.";
  if (!machine.claudeLoggedIn) return { ok: false as const, error: `Claude Code is not logged in on your Machine. ${fix}`, machinePage };
  if (!machine.ghLoggedIn) return { ok: false as const, error: `gh is not logged in on your Machine. ${fix}`, machinePage };
  return { ok: true as const, machine };
}

/**
 * Start (RUN-1, MEM-2): one Batch and one queued Run per Ticket on the
 * Starter's own Machine, then the Gateway schedules. It needs both
 * logins as last checked (POD-5); an offline Machine accepts the Batch and its
 * Runs wait.
 */
export async function startRuns(deps: AppDeps, viewer: Viewer, input: StartInput): Promise<StartResult> {
  const ticketIds = [...new Set(input.ticketIds)];
  if (ticketIds.length === 0) return { ok: false, error: "Select at least one Ticket." };

  const ready = await startingMachine(deps, viewer);
  if (!ready.ok) return ready;
  const { machine } = ready;

  const flow = (await startableFlows(deps)).find((f) => f.id === input.flowId && f.inputType === "issue");
  if (!flow) return { ok: false, error: "Pick a Flow without problems." };
  const tickets = await getTickets(deps.db, ticketIds);
  if (tickets.length !== ticketIds.length) return { ok: false, error: "A selected Ticket no longer exists." };
  const flowSnapshot = await buildFlowSnapshot(deps.db, input.flowId);
  if (!flowSnapshot) return { ok: false, error: "Pick a Flow without problems." };

  const result = await startBatch(
    deps.db,
    { flowId: input.flowId, flowSnapshot, starter: viewer, machineId: machine.id, extraInstructions: input.extraInstructions.trim(), ticketIds },
    deps.clock.now(),
  );
  if (!result.ok && result.reason === "flow-deleted") return { ok: false, error: FLOW_DELETED };
  if (!result.ok) {
    const keyOf = await keysFor(deps);
    const ticket = tickets.find((t) => t.id === result.ticketId);
    const active = result.runId ? await getRun(deps.db, result.runId) : null;
    const key = ticket ? keyOf(ticket.projectId, ticket.number) : "A Ticket";
    const where = active ? ` (${active.state}): /runs/${active.id}` : "";
    return { ok: false, error: `${key} already has an Active Run${where}` };
  }

  await deps.command({ type: "schedule", machineId: machine.id });
  return result;
}

/** The form for a Flow that starts from something other than a Ticket. */
export async function flowStartDialog(deps: AppDeps, flowId: string) {
  const [flow, projects] = await Promise.all([startableFlows(deps).then((all) => all.find((f) => f.id === flowId && f.inputType !== "issue")), listProjects(deps.db)]);
  if (!flow) return null;
  return { flow: { id: flow.id, name: flow.name, inputType: flow.inputType }, projects: projects.map((p) => ({ id: p.id, name: `${p.owner}/${p.repo}`, baseBranch: p.baseBranch })) };
}

export type FlowStartChoice = { value: string; label: string };

/** What a branch or pull-request Input can pick from in a Project. */
export async function flowStartChoices(deps: AppDeps, projectId: string, type: InputType): Promise<FlowStartChoice[]> {
  const project = (await listProjects(deps.db)).find((p) => p.id === projectId);
  if (!project) return [];
  if (type === "branch") return (await deps.github.listBranches(project.owner, project.repo)).map((b) => ({ value: b, label: b }));
  if (type === "pull-request") {
    const pulls = await deps.github.listOpenPullRequests(project.owner, project.repo);
    return pulls.map((p) => ({ value: String(p.number), label: `#${p.number} ${p.title}` }));
  }
  return [];
}

export type StartFromInput = {
  flowId: string;
  projectId: string;
  value: string;
  extraInstructions: string;
  /** A plan or summary only: links Claude opens on the Machine, listed under the text. */
  links?: readonly string[];
  /** A plan or summary only: files delivered into the Run's worktree (ADR 0011). */
  files?: readonly { name: string; data: Buffer }[];
};

export type StartFromInputOptions = { /** Seals attached files; needed when there are any. */ sessionSecret?: string };

/** The picked branch or pull request must exist on GitHub; its URL comes from there, not the browser. */
async function resolveInput(deps: AppDeps, project: { owner: string; repo: string }, type: InputType, value: string): Promise<{ ok: true; input: RunInput } | { ok: false; error: string }> {
  if (type === "branch") {
    const check = checkRunInput(type, { branch: value });
    if (!check.ok) return check;
    const branches = await deps.github.listBranches(project.owner, project.repo);
    return check.input.type === "branch" && branches.includes(check.input.value.branch) ? check : { ok: false, error: "That branch no longer exists." };
  }
  if (type === "pull-request") {
    const pull = (await deps.github.listOpenPullRequests(project.owner, project.repo)).find((p) => String(p.number) === value);
    return pull ? checkRunInput(type, { number: pull.number, url: pull.url }) : { ok: false, error: "That pull request is no longer open." };
  }
  return checkRunInput(type, value);
}

/**
 * What a plan or summary Input carries: the text, then the links and the attached files'
 * paths. Files are checked against the limits and get safe, unique names.
 */
function textInput(input: StartFromInput): { ok: true; value: string; files: { name: string; data: Buffer }[] } | { ok: false; error: string } {
  const links = checkLinks(input.links ?? []);
  if (!links.ok) return links;
  const raw = input.files ?? [];
  const names = attachmentNames(raw.map((f) => f.name));
  const files = raw.map((f, i) => ({ name: names[i]!, data: f.data }));
  const checked = checkAttachments(files.map((f) => ({ name: f.name, size: f.data.length })));
  if (!checked.ok) return checked;
  const value = composeInputText(input.value, links.links, names);
  return value ? { ok: true, value, files } : { ok: false, error: "Write something, add a link or attach a file." };
}

/** Start without a Ticket: one Run in its own Batch, in the Project the Starter picked. */
export async function startFromInput(deps: AppDeps, viewer: Viewer, input: StartFromInput, options: StartFromInputOptions = {}): Promise<StartResult> {
  const ready = await startingMachine(deps, viewer);
  if (!ready.ok) return ready;
  const flow = (await startableFlows(deps)).find((f) => f.id === input.flowId && f.inputType !== "issue");
  if (!flow) return { ok: false, error: "Pick a Flow without problems." };
  const project = (await listProjects(deps.db)).find((p) => p.id === input.projectId);
  if (!project) return { ok: false, error: "Pick a Project." };

  const text = flow.inputType === "plan" || flow.inputType === "summary";
  if (!text && ((input.links?.length ?? 0) > 0 || (input.files?.length ?? 0) > 0)) return { ok: false, error: "Only a plan or summary takes links and files." };
  const composed = text ? textInput(input) : null;
  if (composed && !composed.ok) return composed;
  const files = composed?.ok ? composed.files : [];
  if (files.length > 0 && !options.sessionSecret) return { ok: false, error: "Attached files cannot be stored now. Try again." };

  let resolved: Awaited<ReturnType<typeof resolveInput>>;
  try {
    resolved = await resolveInput(deps, project, flow.inputType, composed?.ok ? composed.value : input.value);
  } catch {
    return { ok: false, error: "Could not reach GitHub. Try again." };
  }
  if (!resolved.ok) return resolved;
  const flowSnapshot = await buildFlowSnapshot(deps.db, input.flowId);
  if (!flowSnapshot) return { ok: false, error: "Pick a Flow without problems." };

  const result = await startBatch(
    deps.db,
    {
      flowId: input.flowId,
      flowSnapshot,
      starter: viewer,
      machineId: ready.machine.id,
      extraInstructions: input.extraInstructions.trim(),
      ticketIds: [],
      direct: [
        {
          projectId: project.id,
          title: runInputTitle(flow.name, resolved.input),
          input: resolved.input,
          attachments: files.map((f) => sealAttachment(f, options.sessionSecret!)),
        },
      ],
    },
    deps.clock.now(),
  );
  if (!result.ok) return { ok: false, error: result.reason === "flow-deleted" ? FLOW_DELETED : "The Run could not start." };
  await deps.command({ type: "schedule", machineId: ready.machine.id });
  return result;
}

/** The Start dialog for picked pull requests: the Flows whose Input is a pull request. */
export async function pullRequestStartDialog(deps: AppDeps, viewer: Viewer, count: number) {
  const [flows, mine] = await Promise.all([startableFlows(deps).then((all) => all.filter((f) => f.inputType === "pull-request")), startingMachineView(deps, viewer, count)]);
  return { flows, ...mine };
}

export type PullRequestRef = { projectId: string; number: number };
export type StartPullRequestsInput = { flowId: string; pullRequests: readonly PullRequestRef[]; extraInstructions: string };

/**
 * Start from the Pull requests page: one Batch with one Run per picked pull request, no Ticket.
 * Each must still be open on GitHub; its URL comes from there, not the browser.
 */
export async function startFromPullRequests(deps: AppDeps, viewer: Viewer, input: StartPullRequestsInput): Promise<StartResult> {
  const picked = [...new Map(input.pullRequests.map((p) => [`${p.projectId}#${p.number}`, p])).values()];
  if (picked.length === 0) return { ok: false, error: "Select at least one pull request." };

  const ready = await startingMachine(deps, viewer);
  if (!ready.ok) return ready;
  const flow = (await startableFlows(deps)).find((f) => f.id === input.flowId && f.inputType === "pull-request");
  if (!flow) return { ok: false, error: "Pick a Flow without problems." };

  const projects = new Map((await listProjects(deps.db)).map((p) => [p.id, p]));
  const open = new Map<string, Awaited<ReturnType<AppDeps["github"]["listOpenPullRequests"]>>>();
  try {
    for (const projectId of new Set(picked.map((p) => p.projectId))) {
      const project = projects.get(projectId);
      if (!project) return { ok: false, error: "A selected pull request's Project was removed." };
      open.set(projectId, await deps.github.listOpenPullRequests(project.owner, project.repo));
    }
  } catch {
    return { ok: false, error: "Could not reach GitHub. Try again." };
  }

  const direct = [];
  for (const p of picked) {
    const pull = open.get(p.projectId)!.find((x) => x.number === p.number);
    if (!pull) return { ok: false, error: `${projects.get(p.projectId)!.repo}#${p.number} is no longer open.` };
    const checked = checkRunInput("pull-request", { number: pull.number, url: pull.url });
    if (!checked.ok) return checked;
    direct.push({ projectId: p.projectId, title: runInputTitle(flow.name, checked.input), input: checked.input });
  }
  const flowSnapshot = await buildFlowSnapshot(deps.db, input.flowId);
  if (!flowSnapshot) return { ok: false, error: "Pick a Flow without problems." };

  const result = await startBatch(
    deps.db,
    { flowId: input.flowId, flowSnapshot, starter: viewer, machineId: ready.machine.id, extraInstructions: input.extraInstructions.trim(), ticketIds: [], direct },
    deps.clock.now(),
  );
  if (!result.ok) return { ok: false, error: "The Runs could not start." };
  await deps.command({ type: "schedule", machineId: ready.machine.id });
  return result;
}

/**
 * The Start Run dialog's form for a plan or summary Flow (ADR 0011): `projectId`, `value`,
 * `extraInstructions`, one `link` per link and one `file` per attached file. The limits are
 * checked on the files' sizes before any is read.
 */
export async function startFromForm(deps: AppDeps, viewer: Viewer, flowId: string, form: FormData, sessionSecret: string): Promise<StartResult> {
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const uploads = form.getAll("file").filter((f): f is File => typeof f !== "string");
  const checked = checkAttachments(uploads.map((f) => ({ name: f.name, size: f.size })));
  if (!checked.ok) return checked;
  const files = await Promise.all(uploads.map(async (f) => ({ name: f.name, data: Buffer.from(await f.arrayBuffer()) })));
  const links = form.getAll("link").filter((l): l is string => typeof l === "string");
  return startFromInput(deps, viewer, { flowId, projectId: field("projectId"), value: field("value"), extraInstructions: field("extraInstructions"), links, files }, { sessionSecret });
}
