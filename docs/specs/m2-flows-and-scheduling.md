# M2 — Flows and scheduling

> **Pods to Machines (2026-11-20):** written for Pods (one Docker container per Member on a Pod Host). Pods and the Host Agent are replaced by each Member's own Machine and the Agent ([ADR 0006](../adr/0006-each-member-runs-on-their-own-machine.md), [ADR 0007](../adr/0007-the-agent-ships-as-one-bundle-with-its-own-node.md)). Read Pod as Machine, Pod Host as the Member's computer, Host Agent as Agent. Where this disagrees with the ADRs or the code, they win. M4 is already updated.

> **Roadmap:** Day 4 · **Check:** **A2**, **A3**, **A6**.
> **Depends on:** [M1](m1-walking-skeleton.md). A second Member with a Google account on the allowlist, their own Claude subscription and gh login (A6).

## 1. Scope

| In | Requirement ids |
| --- | --- |
| Flows page: list, clone samples, delete | FLW-8 (clone), FLW-9 |
| Canvas editor with typed edges, problems badge, Node panel | FLW-3, FLW-4, FLW-5 (editor), FLW-6 |
| Node library editing | FLW-9, FLW-10 |
| Flow edit lock | FLW-7 |
| Slots and limits editing, queue view | POD-2 (owner edits), POD-3, POD-6 (Slots apply at once) |
| A second Member's Pod and pull request | A6 |

**Not in M2:** Human Nodes (a Flow may contain Approve or Grill Nodes and validate, but Start refuses Flows with Human Nodes until M3 with "Human Nodes arrive in M3"), the Batch page (M4).

## 2. Flows page

- `/flows`: a **New Flow** button and two lists, **Samples** and **Flows**, each row with Edit, Clone, Delete. Each row: name, number of Nodes, problems count, last change by whom and when, and a lock badge naming the Run that holds it.
- **Clone** copies the Flow, its placements and edges into a new non-sample Flow named `<name> (copy)`, with `cloned_from_id`. Library Nodes are shared, not copied. Locked Flows can be cloned.
- **Delete** is refused for samples and for locked Flows. Audit: `flow.create`, `flow.update`, `flow.delete`.

## 3. Canvas editor (FLW-3 … FLW-6)

- `/flows/<id>` with a canvas library (React Flow or similar; adding it needs the dependency approval of the repo's rules). The Node library sits in a side panel grouped by kind; drag a Node onto the canvas to place it.
- Each placed Node shows its inputs on the left and Outputs on the right, labelled with their Output Types; optional ones are marked.
- **Connecting:** while dragging from an Output, inputs that `canConnect` (M0 §5.1) highlights; dropping on a mismatched input draws the edge in an error state with the reason on hover, and it counts as a problem (FLW-4).
- **Problems badge:** "N problems" from `validateFlow`, live as the Flow changes; clicking it lists the problems and selects the Node or edge of each.
- **Save** stores the Flow even with problems (so work is not lost), but a Flow with problems cannot be picked in the Start dialog (FLW-5).
- **Node panel** (FLW-6), for the selected placement: label, extra instructions for this Flow, a switch per optional Output. Turning an Output off that has an edge is a problem.
- Samples open in the editor like any Flow; only a locked Flow opens read-only.

## 4. Node library (FLW-1, FLW-9, FLW-10)

- `/flows/library`: list of library Nodes with kind, inputs, Outputs and the Flows that use each.
- Any Member can create, edit or delete a non-sample Node: name, kind, instructions or command, inputs (name, Output Type, required) and Outputs (name, Output Type, optional).
- Editing changes every Flow that uses the Node; the page says how many. Saving re-validates those Flows, so a change can give them problems.
- Editing or deleting is refused while any Flow using the Node is locked, naming the Flow and the Run (FLW-10). Deleting is refused while any Flow uses the Node. Audit: `node.create`, `node.update`, `node.delete`.

## 5. Flow edit lock (FLW-7)

A Flow is locked while any Active Run uses it. Locked: the editor opens read-only with a banner "Locked by Run <link> (<state>)" (the oldest Active Run), and update and delete are refused on the server, not only in the UI. The lock is a query over `run`, never a stored flag, so it can never be left behind.

## 6. Slots, limits and the queue (POD-2, POD-3, POD-6)

- The owner edits Slots, CPU and RAM on their Pod's row, each capped by `POD_LIMIT_CEILING`. Slots apply at once: the scheduler runs, and lowering Slots stops nothing that is running. CPU and RAM are saved and shown as "applies at next Recreate" (Recreate is M4).
- The Pod row's **queue** expands to list Queued Runs in order with Ticket, Flow, mode and queued time.
- The Start dialog shows the queue position the new Runs will get.

## 7. Dry-run (removed)

The Dry-run Run mode, its simulated runner in the Gateway and its `DRY_RUN_FAILURE_RATE` setting were removed (ADR 0009). The editor's Test run stays (it uses core's `simulatedOutputs` and runs in the browser). The queue and Slots (A2) are checked by a Gateway test with a fake Agent.

## 8. Second Member (A6)

No new code beyond M1 if M1 holds; this milestone proves it: a second Member creates their Pod, logs in to their own Claude Code and gh, runs a Real Run, and the pull request carries their GitHub name. Their Workspace is a separate volume, unreadable from the first Pod (NFR-6).

## 9. Acceptance tests

| # | Given / when / then | Covers |
| --- | --- | --- |
| T2-1 | **A2:** start 10 Tickets as a Batch on a 2-Slot Pod with a fake Agent that holds every Node open; at most 2 Runs are ever running, the other 8 stay Queued and start in `queued_at` order | A2, POD-3 |
| T2-2 | _Dropped_ with the Dry-run Run mode (ADR 0009) | |
| T2-3 | _Dropped_ with the Dry-run Run mode (ADR 0009) | |
| T2-4 | **A3:** saving a Flow with a `plan` → `issue` edge or a cycle reports the problem, and the Start dialog does not offer the Flow | A3, FLW-4, FLW-5 |
| T2-5 | Updating or deleting a Flow with an Active Run is refused by the server, naming the Run; cloning it works | FLW-7 |
| T2-6 | Editing a library Node used by a locked Flow is refused; editing an unlocked one re-validates every Flow using it | FLW-10 |
| T2-7 | Samples cannot be updated or deleted; clone produces an editable copy with the same placements and edges | FLW-8 |
| T2-8 | Lowering Slots from 2 to 1 with 2 running stops neither; the next Run waits until both end | POD-6 |
| T2-9 | Setting Slots above the ceiling is refused | POD-2 |
| T2-10 | Turning off an optional Output that has an edge adds a problem | FLW-6 |
| T2-11 | Every Flow and Node change writes an audit entry with the Member's email | FLW-9 |

**Manual checks:** A3 by hand in the editor; A2 as a live demo on the real Pod Host; **A6** with two Members and two real pull requests under two GitHub names.

## 10. Slices

| Id | Slice | Depends on |
| --- | --- | --- |
| M2-01 | Flows page: list, clone, delete, lock badge, server-side lock | M1 |
| M2-02 | Canvas editor: place, connect with `canConnect`, problems badge, save | M2-01 |
| M2-03 | Node panel: label, extra instructions, optional Outputs | M2-02 |
| M2-04 | Node library page and editing with FLW-10 rules | M2-01 |
| M2-05 | Slots and limits editing, queue view, queue position in Start | M1 |
| M2-06 | _Removed_: the simulated runner and Dry-run mode (ADR 0009) | |
| M2-07 | A2 automated test with a fake Agent that holds Nodes open | M1 |
