# Clauderon

A self-hosted web app for one team to run GitHub issues through Flows on the team's own Pods, and to track the resulting Runs and their outputs.

## Language

### Work

**Ticket**:
A GitHub issue in a Project's repository, synced into this app; GitHub stays the source of truth.
_Avoid_: Task, issue, job

**Project**:
One GitHub repository enabled in this app, with its base branch; its issues are the Tickets and its code is what Runs change.
_Avoid_: Board, space, repo, workspace

### Execution

**Pod**:
A machine the team already owns that this app connects to and runs Steps on.
_Avoid_: VM, server, host, runner, worker

**Pod Daemon**:
The process installed on a Pod that connects out to this app and carries out Steps for it.
_Avoid_: Agent, runner, client

**Pod Environment**:
The environment variables and secrets configured on a Pod and given to every Run on it.
_Avoid_: Config, settings, vars

**Slot**:
One unit of a Pod's capacity; each running Run occupies one Slot, and Runs beyond a Pod's Slots wait in a queue.
_Avoid_: Worker, concurrency

**Flow**:
An ordered definition of Steps that a Ticket is taken through.
_Avoid_: Pipeline, workflow, template

**Flow Version**:
An immutable snapshot of a Flow taken each time it is saved; a Run always follows the Flow Version current when it started.
_Avoid_: Revision, draft

**Step**:
One stage of a Flow: an Agent Step, a Command Step, or an Approval Step.
_Avoid_: Stage, job, node

**Agent Step**:
A Step that gives a prompt to an AI coding agent on a Pod; the prompt may reference the Ticket, earlier Steps' output, and rejection feedback.

**Command Step**:
A Step that runs a shell command on a Pod.
_Avoid_: Script step

**Approval Step**:
A Step that pauses until the Run's Starter approves or rejects before the Flow continues.
_Avoid_: Gate, manual step, review step

**Loop-back**:
A Flow rule that sends a Run back to an earlier Step, carrying the rejection feedback or failure output, at most a set number of times.
_Avoid_: Retry, rewind, goto

**Skip Condition**:
A rule on a Step that skips it for Tickets matching given fields, such as a label.
_Avoid_: Filter, guard

**Run**:
One execution of one Flow Version for exactly one Ticket, on a Pod chosen by whoever starts it, producing its own branch and, if anything changed, a pull request.
_Avoid_: Execution, job, build

**Starter**:
The team member who started a Run; the Run acts under their GitHub identity, and only they can approve or cancel it.
_Avoid_: Owner, requester, author

**Retry**:
The Starter re-running a Run from its failed or Interrupted Step.
_Avoid_: Rerun, restart

**Active Run**:
A Run that has not yet finished; a Ticket has at most one Active Run.

**Interrupted**:
The state of a Run whose Pod lost its connection mid-Step; it resumes only when the Starter retries that Step.
_Avoid_: Crashed, lost, orphaned

**Artifact**:
A file a Step declares to keep, stored with the Run and downloadable after the Run ends.
_Avoid_: Attachment, output file

**Batch**:
The set of Runs started together in one action, one per selected Ticket; a grouping for viewing only.
_Avoid_: Bulk run, group run
