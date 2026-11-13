# Clauderon

A shared web app for one team to run GitHub issues through Flows on each Member's Pod, and to track the resulting Runs and their outputs.

## Language

### People

**Member**:
A person who signs in with a Google account whose email is on the app's allowlist, identified by that email, with at most one Pod; any Member can respond to or cancel any Run, and their email is kept for audit.
_Avoid_: User, account, admin, username

**Starter**:
The Member who started a Run; the Run executes on the Starter's Pod under their Claude Code and GitHub logins.
_Avoid_: Owner, requester, author

### Work

**Project**:
One GitHub repository enabled in this app, with its base branch; its issues are the Tickets and its code is what Runs change.
_Avoid_: Board, space, repo, workspace

**Ticket**:
An open GitHub issue in a Project's repository, pulled into this app by Sync; GitHub stays the source of truth.
_Avoid_: Task, issue, job

**Ticket Status**:
The status shown for a Ticket, derived from its Runs, its pull request and the issue, never stored or set by hand.
_Avoid_: Ticket state, column

### Execution

**Pod Host**:
The one team machine running Docker where every Pod lives.
_Avoid_: Server, Docker host, workstation, VM

**Host Agent**:
The process on the Pod Host that connects out to this app and creates, runs and reports on Pods and their Runs.
_Avoid_: Pod Daemon, agent, runner, client

**Pod**:
One Member's Docker container on the Pod Host, holding that Member's Claude Code and gh logins, where every Run they start executes.
_Avoid_: VM, server, machine, runner, worker

**Workspace**:
A Pod's persistent storage, kept across Stop and Recreate: the owner's logins, a clone of each Project and a worktree per Run.
_Avoid_: Volume, home, disk

**Pod Ready**:
The state of a Pod that is running with both Claude Code and gh logged in.
_Avoid_: Online, healthy

**Slot**:
One unit of a Pod's capacity; each Run that is running or waiting for a human occupies one Slot, and Runs beyond a Pod's Slots wait in its queue.
_Avoid_: Worker, concurrency

### Flows

**Task**:
A reusable step definition in the library, of kind Agent, Command or Human, with instructions or a command, typed inputs and typed Outputs.
_Avoid_: Step, job, action

**Agent Task**:
A Task that gives instructions to Claude Code on a Pod.

**Command Task**:
A Task that runs a shell command on a Pod.
_Avoid_: Script step

**Human Task**:
A Task that pauses the Run until a Member responds: an Approve Task (approve or reject with feedback) or a Grill Task (Claude asks, a Member answers, Claude continues in the same session).
_Avoid_: Gate, manual step, approval step

**Flow**:
A directed acyclic graph of Nodes that a Ticket is taken through.
_Avoid_: Pipeline, workflow, template

**Node**:
One use of a Task inside a Flow, with its own extra instructions.
_Avoid_: Step, stage, job

**Output**:
A typed value a Node produces, consumed by later Nodes through the Flow's edges.
_Avoid_: Artifact, port value, result

**Output Type**:
The type of an Output, such as `issue`, `plan`, `branch` or `pull-request`; an edge is allowed only between matching Output Types.
_Avoid_: Artifact type, data type

### Runs

**Run**:
One execution of one Flow for exactly one Ticket on its Starter's Pod, in its own worktree and branch.
_Avoid_: Execution, job, build

**Batch**:
The set of Runs started together in one action, one per selected Ticket, on the Starter's Pod; a grouping for viewing only.
_Avoid_: Bulk run, group run

**Attempt**:
One execution of a Node within a Run; Retry creates new Attempts and earlier ones stay visible.
_Avoid_: RunStep, try, execution

**Active Run**:
A Run that has not ended as Succeeded or Cancelled, including a Failed or Interrupted one; a Ticket has at most one Active Run, and a Flow cannot be edited while an Active Run uses it.

**Interrupted**:
The state of a Run whose Pod stopped, or whose Host Agent lost its connection, mid-Node; only a Retry continues it.
_Avoid_: Crashed, lost, orphaned

**Retry**:
A Member re-running a Failed or Interrupted Run from a Node they choose, which with every later Node gets a new Attempt.
_Avoid_: Rerun, restart, Loop-back

**Cancel**:
A Member ending any Active Run for good, as Cancelled.
_Avoid_: Close, abort, stop

**Dry-run**:
A Run using the simulated runner, which never calls Claude or GitHub; it occupies a Slot but does not count toward the Ticket's Active Run.
_Avoid_: Mock run, test run, simulation

**Artifact**:
The summary of a Run's work, produced when it ends: what changed, how to test it, screenshots and the pull request link.
_Avoid_: Output, attachment, report
