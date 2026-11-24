# Clauderon

A shared web app for one team to run GitHub issues through Flows on each Member's own Machine, and to track the resulting Runs and their outputs.

## Language

### People

**Member**:
A person who signs in with a Google account whose email is on the app's allowlist, identified by that email, with at most one Machine; any Member can respond to or cancel any Run, and their email is kept for audit.
_Avoid_: User, account, admin, username

**Operator**:
Whoever runs the app: holds its configuration and secrets, and is the only one who manages the allowlist on the Members page, where they can also remove any Member's Machine; removing a Member's email removes their Machine too. Operator emails are set in the app's configuration and are always allowed.
_Avoid_: Admin, superuser, owner

**Starter**:
The Member who started a Run; the Run executes on the Starter's Machine under their Claude Code and GitHub logins.
_Avoid_: Owner, requester, author

### Work

**Project**:
One GitHub repository enabled in this app, with its base branch; its issues are the Tickets and its code is what Runs change.
_Avoid_: Board, space, repo, workspace

**Ticket**:
An open GitHub issue in a Project's repository, pulled into this app by Sync; GitHub stays the source of truth.
_Avoid_: Task, issue, job, card

**Ticket Status**:
The status shown for a Ticket, derived from its Runs, its pull request and the issue, never stored or set by hand.
_Avoid_: Ticket state, column

### Execution

**Gateway**:
The always-on part of the app that holds each Machine's connection, watches their heartbeats and runs the Runs; the web app hands it everything that needs a long-lived connection.
_Avoid_: Backend, server, worker, socket service

**Machine**:
One Member's own computer, paired to this app, where every Run they start executes directly on its operating system under that Member's Claude Code and gh logins; a Member has at most one.
_Avoid_: Pod, Pod Host, VM, server, runner, worker

**Agent**:
The process on a Machine that connects out to this app, runs its Member's Runs and reports on them.
_Avoid_: Host Agent, daemon, runner, client

**Pairing**:
Linking a Machine to its Member: the Agent shows a short-lived code that the Member approves in the web app, after which the Machine connects with its own token; a new Pairing replaces the Member's previous Machine.
_Avoid_: Registration, enrolment, login

**Doctor**:
The Agent's check of its Machine: tools, logins, Pairing, Gateway, service and disk, each failure with the step that fixes it on that operating system; a failed check makes the Machine Not ready, a warning does not.
_Avoid_: Health check, diagnostics, preflight

**Workspace**:
The Agent's own directory on a Machine: a clone of each Project and a worktree per Run.
_Avoid_: Volume, home, checkout

**Machine Ready**:
The state of a Machine that is connected with both Claude Code and gh logged in, and whose Doctor found no failure.
_Avoid_: Online, healthy

**Slot**:
One unit of a Machine's capacity, set by its Member; each Run that is running or waiting for a human occupies one Slot, and Runs beyond a Machine's Slots wait in its queue.
_Avoid_: Worker, concurrency

### Flows

**Node**:
A reusable step kept in the Node library, of kind Agent, Command, Human or Input, with instructions or a command, typed inputs and typed Outputs; a Flow places Nodes from the library, and each placement has its own name and extra instructions. Editing a library Node changes every Flow that uses it.
_Avoid_: Task, step, stage, job, action

**Node library**:
The set of Nodes, samples and Member-made, that Flows are built from.
_Avoid_: Task library, catalogue, palette

**Input Node**:
The one entry Node of every Flow; it emits what a Run starts from, typed `issue` (the **Ticket** Input), `branch`, `pull-request`, `plan` or `summary`. An `issue` Flow starts from Tickets, one Run each; any other starts as one Run with no Ticket, in a Project the Starter picks.
_Avoid_: Start node, trigger, source node

**Agent Node**:
A Node that gives instructions to Claude Code on a Machine and ends with a structured result naming its Outputs.

**Command Node**:
A Node that runs a bash command on a Machine; exit code 0 means success.
_Avoid_: Script step

**Human Node**:
A Node that pauses the Run until a Member responds: an Approve Node (approve, or reject with feedback; passes its input through) or a Grill Node (Claude asks a batch of questions per round, a Member answers them in one form, and Claude resumes the same session until it produces its Outputs).
_Avoid_: Gate, manual step, approval step

**Flow**:
A directed acyclic graph of Nodes that a Run takes its Input through.
_Avoid_: Pipeline, workflow, template

**Output**:
A typed value a Node produces, consumed by later Nodes through the Flow's edges.
_Avoid_: Artifact, port value, result

**Flow Draft**:
A Flow that Claude Code writes on a Member's own Machine from their description, outside any Run; it is only previewed until the Member creates it, which imports it as a new Flow.
_Avoid_: Generated flow, AI flow, suggestion

**Output Type**:
The type of an Output, such as `issue`, `plan`, `branch` or `pull-request`; an edge is allowed only between matching Output Types.
_Avoid_: Artifact type, data type

### Runs

**Run**:
One execution of one Flow for exactly one Ticket on its Starter's Machine, in its own worktree and branch.
_Avoid_: Execution, job, build

**Batch**:
The set of Runs started together in one action, one per selected Ticket, on the Starter's Machine; a grouping for viewing only.
_Avoid_: Bulk run, group run

**Attempt**:
One execution of a Node within a Run; Retry creates new Attempts and earlier ones stay visible.
_Avoid_: RunStep, try, execution

**Active Run**:
A Run that has not ended as Succeeded or Cancelled, including a Failed or Interrupted one; a Ticket has at most one Active Run, and a Flow cannot be edited while an Active Run uses it.

**Interrupted**:
The state of a Run whose Machine's Agent sent no heartbeat for 30 seconds or restarted, mid-Node; only a Retry continues it. A shorter drop, or a restart of the Gateway, does not interrupt a Run.
_Avoid_: Crashed, lost, orphaned

**Retry**:
A Member re-running a Failed or Interrupted Run from a Node they choose, which with every later Node gets a new Attempt; the chosen Node is told the latest Reject feedback, why the last Node failed and an optional note, and the worktree is kept.
_Avoid_: Rerun, restart, Loop-back

**Cancel**:
A Member ending any Active Run for good, as Cancelled.
_Avoid_: Close, abort, stop

**Test run**:
The editor's button that steps through a Flow in the browser with made-up Outputs. It stores nothing and never touches a Machine, Claude or GitHub. (The Run mode "Dry-run" was removed: ADR 0009.)
_Avoid_: Dry-run, mock run, simulation

**Artifact**:
The summary of a Run's work, produced when it ends: what changed, how to test it, screenshots and the pull request link.
_Avoid_: Output, attachment, report
