# M3 execution plan — People in the loop

> **Pods to Machines (2026-11-20):** written for Pods (one Docker container per Member on a Pod Host). Pods and the Host Agent are replaced by each Member's own Machine and the Agent ([ADR 0006](../adr/0006-each-member-runs-on-their-own-machine.md), [ADR 0007](../adr/0007-the-agent-ships-as-one-bundle-with-its-own-node.md)). Read Pod as Machine, Pod Host as the Member's computer, Host Agent as Agent. Where this disagrees with the ADRs or the code, they win. M4 is already updated.

> Spec: [docs/specs/m3-people-in-the-loop.md](../specs/m3-people-in-the-loop.md) · Milestone issue #12 · Branch `feat/m3-people-in-the-loop`
> Status legend: ☐ to do · ☑ done and tested. **Status (2026-11-18): implemented and verified locally on the branch; not yet committed, pushed or merged.**

## 1. Starting point

What M0–M2 already give M3, so it is reused rather than rebuilt:

| Area | Already there | Gap for M3 |
| --- | --- | --- |
| Schema | `run_state` and `attempt_state` include `waiting_for_human` and `interrupted`; `human_request` (kind, round, questions, response, responded_by_email/at); `attempt.retry_context`, `attempt.claude_session_id`; `audit_entry` | Mark Attempts a Retry superseded; hold a pending Retry until its Node starts |
| Core | `transition`, `holdsSlot` (running + waiting), `isActive`, `nextNode` ("the caller leaves out those a Retry superseded"), `schedule`, `buildAgentPrompt`, `checkAgentResult` (rejects `questions` from non-Grill Nodes) | Grill question parsing, Grill and answer prompts, retry-context rendering |
| Protocol | `node.run.resumeSessionId`, `node.kill`, `hello.liveAttempts`, `heartbeat.pods` are frozen since M0 | None: M3 only starts using them |
| Gateway | Run engine (serial, DB is the truth), HostLink with resume buffer, `run.cancel` command, `node.kill` | Human Nodes, Grill rounds, `run.resume` command, heartbeat watcher, interruption, liveAttempts check, orphan kill, boot recovery |
| Host Agent | `node.run`/`node.kill` with `CLAUDERON_ATTEMPT_ID` process tagging, `--resume` flag | Report `liveAttempts`, keep log `seq` across Grill rounds, detect an unknown session, kill orphans, report Pod container status in heartbeats, retry-context file |
| Web | Cancel (#36, merged), Run page timeline with Attempt tabs, audit for Pods, terminals, Flows, Nodes, allowlist, Run start/cancel | Approve/Reject/Answer, Needs you page + nav count, Retry dialog, `/audit`, Run history, Start accepting Human Nodes |

Cancel (RUN-8, issue #36) is already merged; M3 only extends it (a retried Run in `queued` is cancelled like any other).

## 2. Architecture decisions

1. **The web app records a person's response; the Gateway acts on it.** Approve, Reject, Answer and Retry are DB transactions in `packages/db` (like `cancelRun`), then a Gateway command (`run.resume` or `schedule`) over the existing Postgres NOTIFY channel. The transaction locks the `human_request` row (`for update`), so of two simultaneous responses the first wins and the second learns who answered (T3-5). Unknown command types are ignored by an older Gateway, so web and Gateway stay deployable separately.
2. **Retry = supersede + pending retry.** Migration `0004` adds `attempt.superseded` (bool) and `run.pending_retry` (jsonb `{flowNodeId, context, loginsChecked}`). Retry marks the chosen Node's and every topologically later Node's Attempts superseded (they stay visible), computes the retry context once (latest Reject feedback, the failed/interrupted Attempt's exit code, error and last log lines — 200 for a Command Node, 50 otherwise — and the note), and moves the Run `failed|interrupted → queued` with a new `queued_at`. The engine passes only non-superseded Attempts to `nextNode`, so the chosen Node runs next; the Attempt it creates copies `pending_retry.context` into `retry_context`. A Real Retry runs the login check again (`loginsChecked`), then advances in the kept worktree (or prepares it if it never existed).
3. **Retry context reaches Nodes one way per kind.** Agent and Grill prompts get the rendered sections ("Feedback from the last review", "Why the last attempt failed", "Note"); Command Nodes get `CLAUDERON_RETRY_CONTEXT`, which the Host Agent writes to a file and exposes as `CLAUDERON_RETRY_CONTEXT_FILE` (same mechanism as `CLAUDERON_SUMMARY_FILE`).
4. **Human Nodes in the engine.** Approve: an Attempt in `waiting_for_human` and a `human_request` (`approve`, round 1) whose `questions` holds the input Output; the Run moves `running → waiting_for_human` and keeps its Slot (`holdsSlot`). Grill: runs as an Agent with a prompt that allows `{"questions": […]}`; a questions result stores a new round and the Claude session id, and the Attempt/Run wait. An answer moves both back to `running` and the Gateway sends `node.run` again on the same Attempt with `resumeSessionId`. Dry-runs wait for people at Approve Nodes too, and simulate Grill Nodes as Agent Nodes.
5. **Resilience lives in a `HostWatch` next to `HostLink`.** One 30 s timer, armed at boot and reset by every `hello` and heartbeat. When it fires, every Real `running` Run becomes `interrupted` ("Pod Host unreachable") and a half-open socket is closed so the Host Agent says hello again. On `hello`, when the Host Agent process changed or this is the first hello since the Gateway booted, `running` Attempts not in `liveAttempts` are interrupted (in-flight messages of a lost process, or a Gateway's lost outbox, cannot arrive any more); then `node.kill` goes out for every live Attempt that is not running in the database. A short drop with the same processes checks nothing: buffered messages are resent (T3-9). Dry-runs are simulated inside the Gateway, so only a Gateway restart (timers lost) interrupts them.
6. **liveAttempts means "not yet reported".** The Host Agent lists Attempts it is running **and** those whose `node.result` it has not had acknowledged, so a result buffered across a Gateway restart is never mistaken for a lost Attempt.
7. **Orphans and crashes on the Host Agent.** After every `welcome`, the Host Agent kills, in each `clauderon-pod-*` container, processes tagged with a `CLAUDERON_ATTEMPT_ID` it holds no handle for. Heartbeats carry each Pod container's status; the Gateway treats a Pod reported stopped while the database says running like a `pod.status` stop, which interrupts that Pod's Runs.
8. **Scheduling waits for the Pod Host.** The scheduler does not start Queued Runs while the Host Agent is disconnected; every `hello` schedules all Pods and re-drives Runs that lost a command (a `running` Run with no running or waiting Attempt advances).
9. **Audit.** Every RUN-15 action writes in the same transaction as the change where the change is a DB function. `/audit` lists entries newest first with Member and action filters; the Run page shows the Run's own entries.

## 3. Dependency graph and order

```
M3-01 Approve (#32) ──┬── M3-02 Grill (#33)
                      ├── M3-03 Needs you (#34)
                      └── M3-04 Retry + Attempts (#35) ──┐
M3-05 Cancel (#36, merged) ─────────────────────────────┼── M3-07 Audit (#38)
M3-06 Interrupted/resilience (#37)                       │
                                                         └── #12 integration (T3-1 A4, T3-11 A5)
```

Order of work: foundations (migration, core helpers, DB modules) → engine (Approve, Grill, Retry, resilience) → Host Agent → web server functions → pages → tests per slice → full verification.

## 4. Changes by layer

**Database (`packages/db`)**
- ☑ Migration `0004`: `attempt.superseded boolean not null default false`, `run.pending_retry jsonb`.
- ☑ `human.ts`: `openHumanRequests`, `countOpenHumanRequests`, `respondToHuman` (approve, reject, answer; row lock, first wins), `humanRequestsOfRun`, `askHuman`/`waitForHuman` for the engine.
- ☑ `runs.ts`: `retryRun` (supersede, context, queue), `interruptRuns`, attempt `superseded` in views, `createAttempt` with state and retry context.
- ☑ `audit.ts`: `listAudit` with filters, `auditOfSubject`.
- ☑ `gateway-commands.ts`: `run.resume`.

**Core (`packages/core`)**
- ☑ `parseGrillQuestions`, Grill result contract in `buildAgentPrompt`, `buildGrillAnswerPrompt`, `RetryContext` + `renderRetryContext`, bare-JSON fallback in `extractResultBlock` (spike finding).

**Gateway**
- ☑ Run engine: Approve/Grill/answer resume, retry-aware `advance`, retry login check, `interrupt`, `reconcile`.
- ☑ `HostWatch`: heartbeat timeout, boot wait, liveAttempts check, `node.kill` for orphans, heartbeat Pod status.
- ☑ HostLink: `onHello` and `onHeartbeat` listeners.

**Host Agent**
- ☑ `liveAttempts` in hello, per-Attempt log `seq`, unknown-session reason, orphan kill after welcome, Pod statuses in heartbeats, `CLAUDERON_RETRY_CONTEXT_FILE`.

**Web**
- ☑ Start accepts Human Nodes.
- ☑ Server functions: `respondAs`, `retryAs`, `viewNeedsYou`, `viewAudit`; Run view with rounds, retry context, superseded Attempts and history.
- ☑ Pages: `/needs-you` (inline forms), nav count, Run page actions (Approve / Reject / Answer, Retry from here dialog, Cancel), `/audit`.

## 5. Testing strategy

- **Core unit tests:** Grill parsing, prompts, retry-context rendering, `extractResultBlock` fallback.
- **Gateway integration tests** (real Postgres, fake Host Agent, fake clock): T3-1, T3-2, T3-3, T3-4, T3-6, T3-8 (`node.kill`), T3-9, T3-10, T3-11, orphan kill, Pod crash, unknown session.
- **Web server tests** (real Postgres): T3-2 (reject), T3-5 (concurrent responses), T3-6/T3-7 (retry, Active Run, lock, Slot), T3-8 (cancel from each state), T3-12 (one test per RUN-15 action), Needs you listing, audit filters.
- **Host Agent tests** (fake Docker): liveAttempts, seq continuity, unknown session, orphan kill, retry-context file, heartbeat Pod statuses.
- Then `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## 6. Risks and edge cases

| Risk | Handling |
| --- | --- |
| Two Members respond at once | `select … for update` on the request; the loser gets "already answered by <name>" (T3-5) |
| A response lands while the Run is being cancelled | Both lock the Run row; cancel closes the request, so a later response sees it closed |
| Command lost (Gateway down during NOTIFY) | Every `hello` reconciles: `running` Runs with no running/waiting Attempt advance; Attempts lost in flight are interrupted, retryable by a person |
| `advance` called twice | Guard: a Run with a running or waiting Attempt does not start another |
| Result buffered across a Gateway restart | Host Agent counts unacknowledged results as live (decision 6) |
| A resent `node.run` after an interruption | `node.kill` follows it for every interrupted Attempt |
| Grill session cannot resume | Host Agent reports "Claude session … could not be resumed"; the Attempt fails with it |
| Log `seq` restarting on a resumed Grill round | Host Agent keeps a per-Attempt counter |
| Dry-run long fake-time tests vs the 30 s watcher | Dry-runs are not interrupted by heartbeat loss (they run in the Gateway) |
| `pod.recreate` audit | Recreate is an M4 feature (no web action yet); the audit helper covers it once the action exists |

## 7. Traceability

| Issue | Acceptance criterion | Implementation | Test |
| --- | --- | --- | --- |
| #32 | Waiting for human, keeps the Slot, no timeout | engine `waitForHuman`, `holdsSlot` | T3-1, T3-3 |
| #32 | Approve passes input through unchanged; Run continues | `respondToHuman`, `run.resume` | T3-2 |
| #32 | Reject requires feedback and fails the Run | `respondToHuman` | T3-2 |
| #32 | Approve and reject are audited | same transactions | T3-12 |
| #33 | Each answer resumes the same session | `resumeSessionId` on the same Attempt | T3-4 |
| #33 | Unlimited rounds, every round visible with who answered | `human_request` per round, Run page rounds | T3-4 |
| #33 | Different Members answer different rounds | `respondToHuman`, any Member | T3-4 |
| #33 | Unknown session fails the Attempt with the reason | Host Agent detection | host-agent test, gateway test |
| #34 | Every open request with Ticket, Flow, Node, Starter, waiting time | `openHumanRequests`, `/needs-you` | needs-you test |
| #34 | Any Member responds inline | Needs you forms | web tests |
| #34 | First wins, second told who answered | row lock | T3-5 |
| #35 | Earlier Attempts, Outputs, logs stay visible | superseded flag | T3-6 |
| #35 | Retried Node receives feedback heading, exit code, last lines, note | `retry_context`, prompt/env | T3-6 |
| #35 | Queues behind existing Queued Runs | new `queued_at` | T3-6 |
| #35 | Failed Run keeps Active Run and Flow lock, not a Slot | `isActive`, `holdsSlot` | T3-7 |
| #35 | Retry audited | `retryRun` | T3-12 |
| #37 | 20 s drop: running, no line lost or duplicated | resume buffer, no check on same processes | T3-9 |
| #37 | 31 s without heartbeat interrupts running; waiting kept | `HostWatch` | T3-10 |
| #37 | Orphans killed on reconnect | `node.kill` + Host Agent orphan sweep | T3-10, host-agent test |
| #37 | Gateway restart mid-Run ends succeeded | first-hello liveAttempts check | T3-11 |
| #37 | Nothing retried automatically | interrupted Runs wait for a person | T3-10 |
| #38 | Every RUN-15 action writes an entry | audit calls | T3-12 |
| #38 | Filter by Member and action | `listAudit` | audit test |
| #38 | Run page shows its own history | `auditOfSubject` | audit test |

## 8. Deployment order

Protocol and schema changes are additive (migration `0004` adds two columns; `CloseCode.Silent` and the `run.resume` command are new), but behaviour depends on the order the three deployables roll out:

1. **Migration**, then **Host Agent** first: a new Gateway treats a running Attempt that is missing from `hello.liveAttempts` as lost on its first hello after boot. The old Host Agent always sends `liveAttempts: []`, so a new Gateway in front of an old Host Agent would interrupt every Running Run on its next restart.
2. **Gateway** second: it understands `run.resume`. An older Gateway ignores the command, and the Run would only continue at the next `hello` (reconcile).
3. **Web** last.

## 9. Progress log

| Slice | Issue | State | Verified by |
| --- | --- | --- | --- |
| M3-01 Approve | #32 | ☑ | `apps/gateway/test/m3.test.ts` T3-1, T3-2, T3-3; `apps/web/test/m3.test.ts` T3-2 |
| M3-02 Grill | #33 | ☑ | gateway T3-4, unknown session; host-agent `m3.test.ts` resume and seq; web Grill answers |
| M3-03 Needs you | #34 | ☑ | web Needs you listing, T3-5, cancel-closed request; checked in the browser |
| M3-04 Retry + Attempts | #35 | ☑ | gateway T3-6 (prompt, queue order, login check, kept worktree); web T3-7, Retry, Run page; checked in the browser |
| M3-05 Cancel | #36 (merged before M3) | ☑ | web T3-8 from all five Active states |
| M3-06 Interrupted | #37 | ☑ | gateway T3-9, T3-10, T3-11, Host Agent restart, Pod stopped, boot without hello; host-agent liveAttempts, orphan sweep, Pod statuses |
| M3-07 Audit | #38 | ☑ | web T3-12 (one test per action), audit filters and Run history; terminal open/close in `apps/gateway/test/terminals.test.ts` (T1-4); checked in the browser |

Checks run on 2026-11-18: `pnpm lint`, `pnpm typecheck`, `pnpm test` (core 72, protocol 11, testing 4, db 16, host-agent 40, gateway 55, web 83 + 1 todo), `pnpm build` — all passing. The new M3 test files were run three times in a row without a flaky result.

The UI was checked by hand against a throwaway database (Needs you with both forms, answering a Grill round, the Run page's rounds, the Retry dialog and its retry context, the queued Run after Retry, the audit page).

### Not covered here

- **`pod.recreate` audit:** Recreate is an M4 feature (POD-6) with no web action yet; the test is a `todo` until it lands.
- **Manual check A5** (restart the Gateway during a Real Run on the Pod Host, reload pages) needs the real Pod Host and a Member's Claude Code login; it is automated as T3-11 with the fake Host Agent, but has not been done by hand.
- **Real Claude unknown-session text:** detected by matching Claude Code's "No conversation found" message (and close variants); the exact wording should be confirmed on the Pod Host.
- **A workspace being prepared when the Host Agent restarts** is interrupted (decision 5); a Retry prepares it again only when the worktree never existed, and `git worktree add -b` fails if the branch was already created. Cancel and Start again is the way out in that rare case.
