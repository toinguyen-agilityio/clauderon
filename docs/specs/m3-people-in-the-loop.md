# M3 — People in the loop

> **Pods to Machines (2026-11-20):** written for Pods (one Docker container per Member on a Pod Host). Pods and the Host Agent are replaced by each Member's own Machine and the Agent ([ADR 0006](../adr/0006-each-member-runs-on-their-own-machine.md), [ADR 0007](../adr/0007-the-agent-ships-as-one-bundle-with-its-own-node.md)). Read Pod as Machine, Pod Host as the Member's computer, Host Agent as Agent. Where this disagrees with the ADRs or the code, they win. M4 is already updated.

> **Roadmap:** Day 5 · **Check:** **A4**, **A5**.
> **Depends on:** [M2](m2-flows-and-scheduling.md). The M0 spike must have confirmed session resume for Grill; if it did not, Grill falls back to one round (roadmap risk table).

## 1. Scope

| In | Requirement ids |
| --- | --- |
| Approve and Grill Nodes | FLW-2, RUN-4, RUN-6, RUN-10 (Grill result) |
| Needs you page and answer forms | RUN-5, MEM-2 |
| Retry from any Node with context and a note | RUN-7, RUN-9 |
| Cancel | RUN-8 |
| Attempts on the Run page | TRK-2 (per Attempt, now with several) |
| Heartbeat timeout, Interrupted, orphan cleanup, Gateway restart | RUN-12, NFR-3 |
| Audit log coverage and an audit view | RUN-15, NFR-2 |

Start stops refusing Flows with Human Nodes.

## 2. Human Nodes

### 2.1 Approve (FLW-2, RUN-4, RUN-6)

- Reaching an Approve Node: the Attempt and the Run go `waiting_for_human`, a `human_request` (`approve`, round 1) is created holding the input Output. The Run keeps its Slot; there is no timeout.
- **Approve:** the Attempt succeeds and produces its input unchanged as its Output; the Run returns to `running`.
- **Reject** (feedback required): the Attempt fails, the Run becomes `failed` with the feedback kept on the `human_request`. Audit: `run.approve`, `run.reject`.

### 2.2 Grill (FLW-2, RUN-10)

- A Grill Node runs like an Agent Node (M1 §4.3) whose prompt also says it may answer with `questions` instead of `outputs` (M0 §6).
- Result with `questions`: store them on a new `human_request` (`grill`, round n) with the Claude session id; Attempt and Run go `waiting_for_human`.
- **Answer:** one Member answers every question in one form (each answer required, free text). The Gateway sends `node.run` again on the **same Attempt** with `resumeSessionId` and a prompt holding the answers; the Attempt and Run return to `running`.
- Rounds repeat until the result has `outputs`; there is no round limit. Every round, its questions, answers and who answered stay visible on the Run page. Audit: `run.answer`.
- If the session cannot be resumed (Claude reports it unknown), the Attempt fails with that reason.

## 3. Needs you (RUN-5, MEM-2)

`/needs-you`, with a count in the navigation: every open `human_request` across all Runs, oldest first, with Ticket, Flow, Node, Starter and how long it has waited. Each row opens an inline form: for Approve, the plan or pull request and Approve / Reject with feedback; for Grill, the questions and an answer field each. Any Member can respond. Two Members responding at once: the first wins, the second gets "already answered by <name>".

## 4. Retry (RUN-7, RUN-9)

- On a `failed` or `interrupted` Run, every Node in the Run's snapshot has **Retry from here**. The dialog shows what the Node will receive and a note field.
- Retry creates a new Attempt for the chosen Node and resets every later Node to not run in this pass (their old Attempts stay visible), sets the Run to `queued` with a new `queued_at`, so it joins the end of its Pod's queue. The worktree is kept as it is.
- The new Attempt's `retry_context` holds, and the prompt (Agent, Grill) or the environment file (Command, `CLAUDERON_RETRY_CONTEXT_FILE`) receives:
  1. the Run's latest Reject feedback, under the heading "Feedback from the last review";
  2. why the failed Node failed: its exit code and its last log lines (last 200 for a Command Node);
  3. the note, if any.
- A Real Retry runs the login check again (M1 §2.4). `Open a pull request` reuses an existing pull request (M1 §4.5).
- Until it succeeds or is cancelled, a `failed` or `interrupted` Run stays Active: it keeps the Ticket's Active Run and the Flow's lock, but not a Slot. Audit: `run.retry` with the Node and note.

## 5. Cancel (RUN-8)

**Cancel** on any Active Run, by any Member, with a confirm. `queued` → `cancelled` at once. `running` → send `node.kill` for the running Attempt, mark it and the Run `cancelled` without waiting for the kill to finish. `waiting_for_human` → close the open `human_request` and mark `cancelled`. `failed` and `interrupted` → `cancelled`. The Slot is freed and the scheduler runs. Audit: `run.cancel`.

## 6. Interrupted and resilience (RUN-12, NFR-3, A5)

The Gateway's heartbeat watcher uses the fake clock in tests.

| Event | Effect |
| --- | --- |
| Socket drops, Host Agent reconnects within 30 s with the same process | Resume from message ids (M0 §4.1); nothing killed; Runs stay `running`; buffered logs and results arrive |
| No heartbeat for 30 s | Every `running` Run on every Pod becomes `interrupted` with reason "Pod Host unreachable"; their running Attempts become `interrupted` |
| Host Agent restarts (`hello` with a new `processId`) | Same as above for Runs whose Attempts are not in `liveAttempts` |
| A Pod stops or crashes (`pod.status` not running) | That Pod's `running` Runs become `interrupted` |
| Gateway restarts or deploys | Run state is in the database; on boot the Gateway waits 30 s for the Host Agent's `hello`, then applies the rows above. Runs whose Attempts are in `liveAttempts` keep running |
| On reconnect after an interruption | The Gateway sends `node.kill` for every Attempt in `liveAttempts` that is not `running` in the database; the Host Agent also kills processes it holds no handle for (orphans) |

`waiting_for_human` Runs keep their state through all of this; Queued Runs wait until their Pod runs again. Nothing is retried automatically.

## 7. Audit (RUN-15, NFR-2)

Every action listed in RUN-15 writes an `audit_entry`: Run start, approve, reject, answer, cancel, retry; Pod create, start, stop, recreate, delete, terminal open and close; Flow and Node create, update, delete; allowlist add and remove. A plain `/audit` page lists entries newest first with a filter by Member and action. Run-related entries also show on the Run page's history.

## 8. Run page additions (TRK-2)

- Each Node shows all its Attempts, newest first, each with state, duration, Outputs, log and retry context.
- Human Nodes show their rounds and responses.
- Action buttons by state: Approve / Reject / Answer while waiting, Retry from here and Cancel while failed or interrupted, Cancel while queued or running.

## 9. Acceptance tests

| # | Given / when / then | Covers |
| --- | --- | --- |
| T3-1 | **A4:** run *Plan and deliver* with a scripted fake Host Agent and step through it; at each point every Node shows the right state (queued, running, waiting for human, succeeded, failed, not reached) | A4 |
| T3-2 | Approve passes the `plan` through unchanged; Reject fails the Run and keeps the feedback | FLW-2, RUN-6 |
| T3-3 | A waiting Run keeps its Slot: with 1 Slot, a second Run stays Queued while the first waits for a person, past any amount of fake time | RUN-4 |
| T3-4 | Grill: two rounds of questions, answered by two different Members, then Outputs; the second `node.run` carries `resumeSessionId` | FLW-2 |
| T3-5 | Two answers to the same request: the first wins, the second is refused | RUN-5 |
| T3-6 | Retry from `Code a change` after a Reject: new Attempts for it and later Nodes, earlier ones kept, the prompt holds the feedback heading, exit code, last lines and note; the Run is queued behind an existing Queued Run | RUN-7 |
| T3-7 | A Failed Run keeps the Ticket's Active Run and the Flow's lock but frees its Slot | RUN-9 |
| T3-8 | Cancel from each Active state ends `cancelled`; from `running` it sends `node.kill` | RUN-8 |
| T3-9 | Drop the socket for 20 s of fake time and reconnect: Runs stay `running`, no log line lost or duplicated | RUN-12, A5 |
| T3-10 | 31 s without a heartbeat: running Runs become `interrupted`; waiting Runs unchanged; on reconnect `node.kill` is sent for their Attempts | RUN-12 |
| T3-11 | Restart the Gateway mid-Run; the fake Host Agent reconnects within 30 s listing the Attempt as live; the Run finishes `succeeded` | A5, RUN-12 |
| T3-12 | Every action in RUN-15 writes an audit entry with the Member's email | RUN-15 |

**Manual check (A5):** reload pages and restart the Gateway during a Real Run on the Pod Host; nothing is lost and the Run carries on.

## 10. Slices

| Id | Slice | Depends on |
| --- | --- | --- |
| M3-01 | Approve Node: waiting state, human request, approve and reject | M2 |
| M3-02 | Grill Node: questions result, rounds, resume | M3-01 |
| M3-03 | Needs you page and answer forms, first-wins | M3-01 |
| M3-04 | Retry with retry context; Attempts on the Run page | M2 |
| M3-05 | Cancel with `node.kill` | M2 |
| M3-06 | Heartbeat watcher, Interrupted, orphan kill, Gateway boot wait | M2 |
| M3-07 | Audit coverage and `/audit` page | M2 |
