# M1 — Walking skeleton

> **Pods to Machines (2026-11-20):** written for Pods (one Docker container per Member on a Pod Host). Pods and the Host Agent are replaced by each Member's own Machine and the Agent ([ADR 0006](../adr/0006-each-member-runs-on-their-own-machine.md), [ADR 0007](../adr/0007-the-agent-ships-as-one-bundle-with-its-own-node.md)). Read Pod as Machine, Pod Host as the Member's computer, Host Agent as Agent. Where this disagrees with the ADRs or the code, they win. M4 is already updated.

> **Roadmap:** Day 2 (Pods and Tickets) and Day 3 (first real pull request) · **Check:** **A7**, a Pod reaches Pod Ready, Sync pulls real issues (Day 2); **A1** (Day 3).
> **Depends on:** [M0](m0-foundations.md); prerequisites P1, P3 and P6 (company repo approval or a sandbox repository, the read-only GitHub token, a sandbox repository with a test command).

## 1. Scope

| In | Requirement ids |
| --- | --- |
| Create my Pod, Start, Stop, Pods page | POD-2, POD-4, POD-6 (Start and Stop only), NFR-6 |
| Web terminal and login checks | POD-5, POD-9, MEM-2 (terminal for the owner only) |
| Workspace: clone per Project, worktree and branch per Run | POD-10, RUN-3 |
| Pushes and pull requests with the Starter's gh login | POD-11, POD-12, POD-13, TIC-8 |
| Projects, Sync, Tickets list with search and filter | PRJ-1, PRJ-2, TIC-1, TIC-2, TIC-3, TIC-5, TIC-6, TIC-7, TIC-9 |
| Run engine, Agent and Command Nodes, `Open a pull request` | RUN-2, RUN-10, RUN-11, RUN-16 |
| Start dialog (Real mode), Batch | RUN-1, MEM-2 (Start tied to own Pod) |
| Run page with timeline, Outputs and live logs; Runs list | TRK-1, TRK-2, TRK-7, NFR-4 |
| Masking and stored logs | NFR-1, NFR-5 (logs per Attempt) |
| Ending terminals and live connections when an email is removed | A7 |

**Not in M1:** the canvas editor (M1 runs the seeded *Basic ticket delivery* Flow as is), Slot and limit editing, Human Nodes, Retry, Cancel, Interrupted, Recreate and Delete. The Slot scheduler from M0 already caps running Runs at the Pod's 2 default Slots; the queue view and editing come in M2.

## 2. Pods

### 2.1 Create my Pod (POD-2)

- Shown on the Pods page to a Member with no Pod. Creates a `pod` row (`creating`, 2 Slots, 2 CPU, 4096 MB, `image_tag = POD_IMAGE`) and sends `pod.create`.
- The Host Agent creates the container `clauderon-pod-<podId>` with a named volume `clauderon-ws-<podId>` mounted at `/workspace`, `--cpus` and `--memory` from the row, user `pod`, `sleep infinity` as the main process, then starts it and replies `pod.status` with the digest of the image it used.
- A second Create by the same Member is refused (unique `member_id`).
- When the Pods' limits add up to more than the Pod Host's CPU or RAM, the Pods page shows a warning; creation still goes ahead.

### 2.2 Start and Stop (POD-6, part)

- Owner only. `pod.start` / `pod.stop` → `pod.status`. Stop is refused while the Pod has Running or Waiting Runs. Start triggers a login check (§2.4).
- After every `pod.status`, the Gateway runs the scheduler for that Pod.

### 2.3 Pods page (POD-4)

A Pod Host card: Host Agent connected or not with the last heartbeat time, Docker running, architecture, total CPU, RAM and disk, and the sum of the Pods' limits. Inside it, one row per Pod: owner (name, picture), status, image tag, Claude Code and gh login state with the time of the last check, gh account and the repositories its token reaches, Slots in use out of Slots, queue length. The owner's own row has Start, Stop, Refresh and **Open terminal**.

### 2.4 Login checks (POD-5)

`pod.checkLogins` runs inside the container as `pod`: `gh auth status`, `gh api user` for the account, `gh repo list` filtered to the Projects for the reachable repositories, and a Claude Code status check (the command confirmed in the M0 spike). Sent when the Pod starts, when a terminal session closes, right before each Real Run starts its first Node, and on **Refresh**. Never periodic.

**Pod Ready** = `running` and both logins true. The Start dialog refuses Real mode when the Starter has no Pod, or Claude Code or gh is not logged in, and links to the terminal. A stopped Pod with both logins accepts the Batch; its Runs stay Queued until it starts.

When the check right before a Run fails, the Run fails with `failure_reason = "Claude Code not logged in"` (or gh) and does not start its Node.

### 2.5 Web terminal (POD-9)

- `/pods/<id>/terminal`, owner only (others get 404). xterm.js in the browser, a WebSocket to the Gateway (`/terminal`, session cookie checked), `terminal.*` messages to the Host Agent, which runs `docker exec -it -u pod <container> bash -l` under a PTY.
- Resize follows the browser window. Closing the tab sends `terminal.close`; the Host Agent ends the exec and replies `terminal.closed`, which triggers a login check.
- Audit: `terminal.open` and `terminal.close` with start and end time. Keystrokes and output are never stored or logged.
- `member.revoked` (M0 §7.1) closes the browser socket and sends `terminal.close` for every session of that Member.

## 3. Projects and Tickets

### 3.1 Enable a Project (PRJ-1, PRJ-2)

Projects page: **Enable a repository** lists the repositories the app's GitHub token can read (an Operator saves it on the same page, ADR 0010) (`GET /user/repos`), minus enabled ones. Pick one, then its base branch from its branches (default branch preselected). All Projects must share one owner: once one is enabled, the list shows only that owner's repositories. Audit: `project.enable`.

**Decision (issue #89): whose repositories the list shows.** Always the app token's, whoever is signed in and however many Members have Machines. The app cannot read a Member's `gh` access to a repository that is not yet a Project (ADR 0001; the Agent reports only `tokenRepos`, the Projects' repositories its `gh` login reaches, POD-4), so an intersection or union across Machines is not computable, and the signed-in Member's Machines say nothing about the Project every Member shares. The list is therefore not per Member and does not change with Machines. Whether a Member's Machine can push to an enabled Project is shown after enabling, per Machine, from `tokenRepos` on the Machines page.

### 3.2 Sync (TIC-5, TIC-9)

Sync runs in the background after the Tickets page renders, at most once a minute per Project (the manual **Sync** button was removed, ADR 0010):

1. Fetch every open issue (paginated, pull requests excluded) and upsert `ticket` rows: title, body, labels, author login, `author_association`, `issue_state`, URL.
2. Fetch the current state of every known Ticket that did not come back open (so it shows `Closed`).
3. Fetch the state of every pull request recorded on a Run of the Project.

Sync never starts a Run and never writes to GitHub. Errors from GitHub (rate limit, revoked or missing token) are kept on the Project and shown on the Tickets page, not swallowed.

Pull request state is also refreshed when a Ticket, Run or Batch page opens (TIC-6), throttled to once per minute per pull request.

### 3.3 Tickets page (TIC-1, TIC-2, TIC-3, TIC-6, TIC-7)

Table per Project or across Projects: key (`repo#n`, or `owner/repo#n` when two Projects share a repository name), title, labels, Ticket Status (M0 §5.4). Search by title or key; filter by Project and Ticket Status. Multi-select with a **Start** button; Tickets that already have an Active Run cannot be selected, with a tooltip naming the Run.

## 4. Starting Runs

### 4.1 Start dialog (RUN-1, TIC-9)

- Fields: Flow (only Flows without problems), extra instructions, the selected Tickets.
- Shows the Starter's Pod with its Slots in use and queue length, and the Pod Ready state.
- Warns, without blocking, for each Ticket whose `author_association` is not `OWNER`, `MEMBER` or `COLLABORATOR`.
- **Start** creates one `batch` and one `run` per Ticket (`queued`, `pod_id` = Starter's Pod, `flow_snapshot`), all in one transaction; a Ticket that gained an Active Run meanwhile fails the whole Start with a message naming it (the partial unique index of M0 enforces it). Audit: `run.start` per Run.
- Then the Gateway runs the scheduler for the Pod.

### 4.2 Run engine (RUN-2, RUN-3, RUN-16)

The Gateway owns every Run; the Host Agent only executes and reports. When the scheduler starts a Run:

1. `running`; login check (§2.4).
2. `workspace.prepare`: in the Pod, as `pod`, clone `owner/repo` into `/workspace/projects/<owner>/<repo>` with the Starter's gh login if missing, else `git fetch origin <base>`; then `git worktree add /workspace/runs/<runId> -b <branch> origin/<base>`. Branch: `clauderon/<issue-number>-<slug>-<first 6 chars of run id>`, slug from the title, lower-case, `[a-z0-9-]`, at most 40 characters (RUN-3).
3. Loop: `nextNode` (M0 §5.2) → create an `attempt` (`running`) → `node.run` → stream `node.log` into `log_chunk` and to subscribed browsers → on `node.result` store Outputs, mark the Attempt `succeeded` or `failed`.
4. The Ticket Node is not executed; its Attempt succeeds at once with the `issue` Output (number, title, body, labels, URL).
5. Any failed Attempt makes the Run `failed` with its reason. All reached Nodes succeeded makes it `succeeded` (RUN-16). Either way the Gateway runs the scheduler again.

### 4.3 Agent Nodes (RUN-10, POD-12)

The prompt is built from, in order: the Node's instructions, the placement's extra instructions, the Batch's extra instructions, every input Output rendered under a heading named after it, and the result contract of M0 §6 listing the Node's Outputs. It is written to a file in the worktree's `.git` directory (never committed) and run as `pod` in the worktree with the flags from the spike, permission prompts skipped. `stream-json` events become log lines; usage events become `node.usage`. The Host Agent returns the parsed result and the session id.

A `branch` Output requires the agent to have committed: when HEAD did not move, the Attempt fails with "no commit on the branch".

### 4.4 Command Nodes (RUN-10)

`bash -lc '<command>'` as `pod` in the worktree, stdout and stderr streamed. Exit 0 succeeds. `test-result` = `{ exitCode, tail }` with the last 200 lines; `branch` = the Run's branch at HEAD.

### 4.5 `Open a pull request` (RUN-11, POD-11, TIC-8)

`clauderon-open-pr`, shipped in the Pod image, reads the Run's inputs from environment variables the Host Agent sets (`CLAUDERON_ISSUE_NUMBER`, `CLAUDERON_BASE`, `CLAUDERON_BRANCH`, `CLAUDERON_TITLE`, `CLAUDERON_SUMMARY_FILE`, `CLAUDERON_TEST_RESULT_FILE`):

- No commits ahead of the base: print "no changes", exit 0, no `pull-request` Output.
- Push the branch with the Starter's gh login.
- If an open pull request exists for the branch, reuse it (pushing is enough); else `gh pr create` with title `<issue title> (#<n>)` and a body holding the summary, the test result and `Refs #<n>`.
- Print one JSON line `{"pullRequest": {"number": …, "url": …}}` that the Host Agent turns into the `pull-request` Output; the Gateway copies it onto the `run` row.

### 4.6 Masking and logs (NFR-1, NFR-5)

The Host Agent masks every log line with M0 §5.5 before sending, using its own known secrets plus any token it can read from the Pod's gh config. The Gateway masks again with the app's secrets before storing. Logs are stored in `log_chunk` per Attempt and kept after the Run ends.

## 5. Tracking

### 5.1 Run page (TRK-1, TRK-2, NFR-4)

`/runs/<id>`: Ticket, Flow, Starter, Pod, mode, state, branch, pull request link. A timeline of the Flow's Nodes in topological order, each with state (queued, running, succeeded, failed, not reached), duration, and its Attempts. Selecting a Node shows its live log (subscribed over the browser socket, backfilled from `log_chunk`, auto-scroll with a pause toggle) and its Outputs per Attempt. Log lines reach the page within a few seconds of being printed.

### 5.2 Runs list (TRK-7)

`/runs`: Ticket, Flow, mode, state, Starter, Pod, queued, started and ended times; filter by state, Flow and Pod; newest first, paginated.

## 6. Acceptance tests

| # | Given / when / then | Covers |
| --- | --- | --- |
| T1-1 | Create my Pod sends `pod.create` with 2/2/4096; a second Create is refused; over-commit shows a warning but creates | POD-2 |
| T1-2 | Stop is refused while the Pod has a Running Run | POD-6 |
| T1-3 | A Member who is not the owner gets 404 on the terminal page and the Gateway refuses their terminal socket | POD-9, MEM-2 |
| T1-4 | Closing a terminal sends `pod.checkLogins`; audit has open and close entries, no keystrokes | POD-5, POD-9 |
| T1-5 | Start in Real mode is refused when gh is not logged in, with a link to the terminal | POD-5 |
| T1-6 | Removing the Starter's email closes their terminal and live log sockets at once | A7 |
| T1-7 | Sync against the fake GitHub adds open issues, marks a vanished one `Closed`, records author association, and starts no Run | TIC-5, TIC-6, TIC-9 |
| T1-8 | Two Projects with the same repository name show `owner/repo#n` keys | TIC-1 |
| T1-9 | Start with a Ticket that already has an Active Real Run fails with a message naming it | TIC-7 |
| T1-10 | A Batch of 3 Tickets on a 2-Slot Pod starts 2 Runs; the third starts when one ends | POD-3 (scheduler wired) |
| T1-11 | *Basic ticket delivery* with a fake Host Agent that succeeds every Node ends `succeeded` with a `pull-request` Output copied to the Run | RUN-2, RUN-11, RUN-16 |
| T1-12 | An Agent result missing a required Output fails the Attempt and the Run with that reason | RUN-10 |
| T1-13 | `clauderon-open-pr` with no commits exits 0 without a pull request; the Run succeeds and the Ticket stays `Open` | RUN-11 |
| T1-14 | Branch name for issue 412 "Fix: Ledger totals!" is `clauderon/412-fix-ledger-totals-<6>` | RUN-3 |
| T1-15 | A log line holding `ghp_…` is stored and streamed masked | NFR-1 |
| T1-16 | Host Agent against fake Docker: `pod.create` creates the container with the volume, limits and user; `workspace.prepare` clones once then only fetches | POD-2, POD-10 |

**Manual checks:**

- **Day 2:** a Member creates their Pod, logs in to Claude Code and gh in the web terminal, sees Pod Ready; Sync pulls the sandbox repository's issues; A7 end to end.
- **Day 3, A1:** one real Ticket of the sandbox repository runs through *Basic ticket delivery* on that Pod and the Run page links to a real pull request opened under the Member's GitHub name.

## 7. Slices

| Id | Slice | Depends on |
| --- | --- | --- |
| M1-01 | Pods: create, start, stop in the app and the Host Agent; Pods page with the Pod Host card | M0 |
| M1-02 | Web terminal end to end; revocation closes it | M0 |
| M1-03 | Login checks and Pod Ready; Refresh | M1-01 |
| M1-04 | Projects: enable from the token's repositories, base branch | M0 |
| M1-05 | Sync and Tickets page with search, filter, multi-select, derived status | M1-04 |
| M1-06 | Workspace prepare: clone, fetch, worktree, branch name | M1-01 |
| M1-07 | Run engine in the Gateway: scheduler wiring, Node loop, Ticket Node, Outputs | M1-06 |
| M1-08 | Agent Node runner in the Host Agent: prompt file, headless Claude Code, result parse, usage | M1-07 |
| M1-09 | Command Node runner and `clauderon-open-pr` in the image | M1-07 |
| M1-10 | Log streaming, masking on both sides, `log_chunk` storage | M1-07 |
| M1-11 | Start dialog (Real) and Batch creation | M1-05, M1-03 |
| M1-12 | Run page (timeline, live log, Outputs) and Runs list | M1-10 |
