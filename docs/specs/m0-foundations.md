# M0 — Foundations

> **Pods to Machines (2026-11-20):** written for Pods (one Docker container per Member on a Pod Host). Pods and the Host Agent are replaced by each Member's own Machine and the Agent ([ADR 0006](../adr/0006-each-member-runs-on-their-own-machine.md), [ADR 0007](../adr/0007-the-agent-ships-as-one-bundle-with-its-own-node.md)). Read Pod as Machine, Pod Host as the Member's computer, Host Agent as Agent. Where this disagrees with the ADRs or the code, they win. M4 is already updated.

> **Roadmap:** Day 1 · **Check:** core unit tests pass; an email not on the allowlist is refused; the Host Agent shows as connected.
> **Depends on:** prerequisites P2 (Google OAuth client), P4 (Pod Host on), P5 (hosting accounts) from the [roadmap](../roadmap/v1-seven-day-plan.md#2-before-day-1).
> **Freezes:** the database schema and the Host Agent protocol. Later milestones add columns and messages; changing or removing one after M0 needs a note in the pull request and a review by both reviewers.

## 1. Scope

| In | Requirement ids |
| --- | --- |
| Monorepo, CI, the Pod image | POD-14 |
| Database schema and migrations | all entities below; NFR-1 (no secrets in the database) |
| Domain core: Flow validator, Run state machine, Slot scheduler, Ticket Status | FLW-1, FLW-5 (validator only), RUN-2 (ordering), POD-3 (scheduler logic), TIC-6 (derivation) |
| Seeded sample Nodes and Flows | FLW-8 |
| Google sign-in, allowlist, Allowlist page, audit log table | MEM-1, MEM-3, MEM-4 |
| Gateway WebSocket, heartbeat, message ids; Host Agent that connects out and reconnects; install script | POD-1, RUN-12 (link only), NFR-3 |
| Spike: Claude Code headless in the Pod image | Assumption in requirements §5; risk table in the roadmap |

**Not in M0:** Pods, Projects, Tickets, Runs on a Pod, any UI beyond sign-in, access denied and Allowlist pages.

## 2. Configuration

All secrets live in environment variables, never in the database (NFR-1). `.env.example` lists every one.

| Variable | Used by | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | web, gateway | Managed Postgres |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | web | OAuth client in the company's Google Cloud project |
| `SESSION_SECRET` | web, gateway | Signs the session cookie |
| `OPERATOR_EMAILS` | web, gateway | Comma-separated; always allowed, see the Allowlist page |
| `HOST_AGENT_SECRET` | gateway, host-agent | Long-lived shared secret for the Host Agent link |
| `GATEWAY_URL` | web, host-agent | `wss://…` of the Gateway |
| `POD_IMAGE` | gateway | Current image tag, e.g. `ghcr.io/<owner>/clauderon-pod:2026-11-16` (used from M1) |
| `POD_LIMIT_CEILING` | web | Max Slots, CPU and RAM per Pod, e.g. `slots=4,cpus=4,memoryMb=8192` (used from M1) |

## 3. Database schema

Postgres, migrations in `packages/db`. Ids are UUIDs except where noted; times are `timestamptz`. Enums are Postgres enums or checked text, the implementer's choice.

| Table | Columns (beyond `id`, `created_at`) | Notes |
| --- | --- | --- |
| `member` | `email` (unique, lower-cased), `name`, `picture_url`, `last_sign_in_at` | Created at first allowed sign-in |
| `allowlist_entry` | `email` (primary key, lower-cased), `added_by_email`, `added_at` | Exact emails only, no domains (MEM-3) |
| `member_account` | `provider`, `provider_account_id` (together the primary key), `member_id` | Links the Google account for Auth.js; holds no OAuth tokens (NFR-1) |
| `session` | `token_hash` (unique, SHA-256 of the cookie value), `member_id`, `expires_at`, `ended_at` | Server-side so it can be ended at once; 24 h (MEM-1). The cookie value itself is never stored |
| `audit_entry` | `actor_email`, `action`, `subject_type`, `subject_id`, `detail` (jsonb), `at` | Append-only (RUN-15) |
| `pod_host` | single row: `connected`, `connected_at`, `last_heartbeat_at`, `agent_version`, `process_id`, `arch`, `cpus`, `memory_mb`, `disk_gb`, `docker_running`, `last_received_id`, `last_sent_id` | Message ids for resuming (RUN-12) |
| `pod` | `member_id` (unique), `container_id`, `status` (`creating`, `running`, `stopped`, `error`, `deleting`), `image_tag`, `image_digest`, `slots`, `cpus`, `memory_mb`, `claude_logged_in`, `gh_logged_in`, `gh_account`, `gh_token_scope` (jsonb), `logins_checked_at`, `metrics` (jsonb) | One per Member (POD-2) |
| `project` | `owner`, `repo`, `base_branch`, `enabled_by_email` | Unique (`owner`, `repo`) |
| `ticket` | `project_id`, `number`, `title`, `body`, `labels` (jsonb), `author_login`, `author_association`, `issue_state`, `url`, `synced_at` | Unique (`project_id`, `number`); no stored status (TIC-6) |
| `node` | `slug` (unique, samples only), `name`, `kind` (`ticket`, `agent`, `command`, `approve`, `grill`), `instructions`, `command`, `inputs` (jsonb `[{name, type, required}]`), `outputs` (jsonb `[{name, type, optional}]`), `is_sample`, `updated_by_email`, `updated_at` | Node library (FLW-1) |
| `flow` | `slug` (unique, samples only), `name`, `is_sample`, `cloned_from_id`, `updated_by_email`, `updated_at` | |
| `flow_node` | `flow_id`, `node_id`, `label`, `extra_instructions`, `enabled_optional_outputs` (jsonb), `x`, `y` | A placement of a library Node (FLW-6) |
| `flow_edge` | `flow_id`, `from_flow_node_id`, `from_output`, `to_flow_node_id`, `to_input` | |
| `batch` | `flow_id`, `starter_member_id`, `extra_instructions` | |
| `run` | `batch_id`, `ticket_id`, `flow_id`, `flow_snapshot` (jsonb), `pod_id`, `starter_member_id`, `mode`, `state`, `queued_at`, `started_at`, `ended_at`, `branch`, `worktree_path`, `pull_request_number`, `pull_request_url`, `pull_request_state`, `failure_reason` | `state` per §5.2. `flow_snapshot` keeps Node names, kinds and edges as they were at Start, so past Runs still render after the Flow is edited |
| `attempt` | `run_id`, `flow_node_id`, `number`, `state`, `started_at`, `ended_at`, `exit_code`, `error`, `input_tokens`, `output_tokens`, `claude_session_id`, `retry_context` (jsonb) | One per execution of a Node (Attempt) |
| `output` | `attempt_id`, `name`, `type`, `value` (jsonb) | Typed by Output Type |
| `human_request` | `attempt_id`, `kind` (`approve`, `grill`), `round`, `questions` (jsonb), `response` (jsonb), `responded_by_email`, `responded_at` | Used from M3 |
| `log_chunk` | `attempt_id`, `seq`, `stream` (`stdout`, `stderr`, `system`), `text`, `at` | Masked before insert; deleted after 90 days (NFR-5) |
| `artifact` | `run_id` (primary key), `content` (jsonb) | Used from M4 |

Indexes: `run (pod_id, state, queued_at)` for the queue; `run (ticket_id) where state not in ('succeeded','cancelled')` unique **for `mode = 'real'`** to enforce one Active Run per Ticket (TIC-7); `log_chunk (attempt_id, seq)`.

## 4. Host Agent protocol

`packages/protocol`. One WebSocket from the Host Agent to `GATEWAY_URL/host-agent`, authenticated with `Authorization: Bearer <HOST_AGENT_SECRET>`; a wrong secret closes the socket with code 4401.

### 4.1 Envelope and resuming

```ts
type Envelope<T> = {
  id: number;        // per sender, starts at 1, +1 per message, persisted
  re?: number;       // id of the message this replies to
  type: string;      // e.g. "node.run"
  payload: T;        // validated with the schema for `type`
};
```

- `hello`, `welcome`, `ack` and `heartbeat` are control messages: they carry `id: 0` and are never buffered or resent, so acks are not acknowledged and heartbeats do not pile up while the link is down. Every other message is numbered.
- Each side keeps its sent messages until the other side acknowledges them (`ack` with the highest id received in order), and stores the last id it received.
- Ids only jump ahead when a sender restarted and lost messages it can no longer resend (the Gateway's outbox is in memory). The receiver delivers past such a gap and logs it rather than waiting, so the link never stalls; Run state lives in the database, not in lost messages.
- On connect the Host Agent sends `hello` with `lastReceivedId`; the Gateway replies `welcome` with its own `lastReceivedId`. Each side then resends everything after the other's `lastReceivedId`. Receivers drop ids they have already seen.
- The Host Agent sends `heartbeat` every 10 s. The Gateway records `last_heartbeat_at`. What happens after 30 s without one is M3 (RUN-12); in M0 the Pod Host card only shows connected or not.
- The Host Agent reconnects with backoff 1 s, 2 s, 4 s … capped at 10 s, forever (NFR-3).

### 4.2 Messages

Defined in M0 even when a later milestone implements them, so the protocol is frozen.

| Direction | Type | Payload (main fields) | From |
| --- | --- | --- | --- |
| A → G | `hello` | `agentVersion`, `processId`, `arch`, `cpus`, `memoryMb`, `diskGb`, `dockerRunning`, `lastReceivedId`, `liveAttempts: string[]` | M0 |
| G → A | `welcome` | `lastReceivedId`, `podImage` | M0 |
| both | `ack` | `upTo` | M0 |
| A → G | `heartbeat` | `at`, `pods: {podId, status, metrics?}[]` | M0 |
| G → A | `pod.create` / `pod.start` / `pod.stop` / `pod.recreate` / `pod.delete` | `podId`, `image`, `cpus`, `memoryMb` | M1, M4 |
| A → G | `pod.status` | `podId`, `status`, `containerId`, `imageDigest`, `error?` | M1 |
| G → A | `pod.checkLogins` | `podId` | M1 |
| A → G | `pod.logins` | `podId`, `claude`, `gh`, `ghAccount`, `tokenRepos: string[]`, `checkedAt` | M1 |
| G → A | `workspace.prepare` | `runId`, `podId`, `owner`, `repo`, `baseBranch`, `branch` | M1 |
| A → G | `workspace.ready` / `workspace.failed` | `runId`, `worktreePath` / `error` | M1 |
| G → A | `node.run` | `attemptId`, `runId`, `podId`, `worktreePath`, `kind` (`agent`, `command`), `prompt?`, `command?`, `resumeSessionId?`, `env` | M1 |
| A → G | `node.log` | `attemptId`, `seq`, `stream`, `text` (already masked) | M1 |
| A → G | `node.usage` | `attemptId`, `inputTokens`, `outputTokens` | M1 |
| A → G | `node.result` | `attemptId`, `exitCode`, `result?` (parsed JSON, §6), `sessionId?`, `headCommit?`, `error?`; from M4 also `diff?` (`text`, `truncated`) and `files?` (screenshots) | M1 |
| G → A | `node.kill` | `attemptId` | M3 |
| G → A | `terminal.open` / `terminal.input` / `terminal.resize` / `terminal.close` | `sessionId`, `podId`, `data?`, `cols?`, `rows?` | M1 |
| A → G | `terminal.output` / `terminal.closed` | `sessionId`, `data?`, `exitCode?` | M1 |
| G → A | `workspace.cleanup` | `runId`, `podId`, `worktreePath` | M4 |
| G → A | `pr.writeBody` | `runId`, `podId`, `worktreePath`, `body` | M4 |
| G → A | `image.check` | `tag` | M4 |
| A → G | `image.status` | `tag`, `digest` | M4 |

Unknown `type` values are logged and acknowledged, never fatal, so a newer Gateway can talk to an older Host Agent during a deploy (R10).

## 5. Domain core (`packages/core`)

Pure functions, no I/O.

### 5.1 Flow validator (FLW-4, FLW-5, A3)

`validateFlow(flow, library) → Problem[]`, where a problem names the Node or edge it belongs to. Problems:

- not exactly one Ticket Node;
- no end Node (a Node with no outgoing edge, other than the Ticket Node);
- a cycle (report the edges that close it);
- an edge whose Output Type differs from the input's type;
- an edge to an input that already has an edge;
- a required input with no edge;
- an edge from an optional Output that is turned off in the Node panel.

`canConnect(fromOutput, toInput) → ok | reason` is the same rule, used by the editor while dragging.

`topologicalOrder(flow) → flowNodeId[]` with a stable tie-break (canvas `y`, then `x`, then id) so the order is the same every time (RUN-2).

### 5.2 Run state machine (RUN-2 … RUN-9, RUN-16)

`transition(run, event) → run | error`. States: `queued`, `running`, `waiting_for_human`, `succeeded`, `failed`, `interrupted`, `cancelled`. Events and allowed moves exactly as the lifecycle diagram in requirements §4.5. Also:

- `nextNode(run, attempts) → flowNodeId | done`: the first Node in topological order without a succeeded Attempt in the current pass, whose required inputs all exist. A Node whose required input is an optional Output that was not produced is **not reached**; it is skipped and does not fail the Run (RUN-16).
- `holdsSlot(state)`: `running` or `waiting_for_human`.
- `isActive(state)`: anything but `succeeded` and `cancelled`.

### 5.3 Slot scheduler (POD-3)

`schedule(pod, runs) → runIdsToStart`: while running plus waiting Runs on the Pod are fewer than `pod.slots`, take Queued Runs by `queued_at`, then id. A stopped Pod starts nothing (POD-5). The Gateway calls it after every state change on a Pod.

### 5.4 Ticket Status (TIC-6)

`ticketStatus(ticket, realRuns, pullRequest) → status`, first match wins:

1. `Closed` if the issue is closed on GitHub;
2. the Active Run's state, mapped: `queued` → `Queued`, `running` → `In run`, `waiting_for_human` → `Needs you`, `failed` → `Failed`, `interrupted` → `Interrupted`;
3. `PR merged` / `PR open` from the latest Run with a pull request;
4. `Open`.


### 5.5 Masking (NFR-1)

`mask(text, knownSecrets) → text`: replaces GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`), Anthropic keys (`sk-ant-`), OAuth bearer values and every known secret value with `•••`. Shared by the Host Agent (M1) and the app.

## 6. Agent result contract (RUN-10)

Fixed here so the M1 runner and the M3 Grill share it. The prompt ends by asking Claude Code to finish with one fenced JSON block, the last one in its final message:

```json
{ "outputs": { "plan": "…", "summary": "…" } }
```

or, for a Grill Node only:

```json
{ "questions": [{ "id": "q1", "text": "Which endpoint should change?" }] }
```

The Host Agent extracts the last such block and returns it as `node.result.result`. The app then checks it against the Node: a required Output missing, an unknown name, or `questions` from a non-Grill Node fails the Attempt with a clear reason. A `branch` Output carries the Run's branch and `headCommit`, filled in by the Host Agent, not by Claude.

The spike (§8, slice M0-02) confirms the exact CLI flags (expected: `claude -p --output-format stream-json --verbose --dangerously-skip-permissions`, `--resume <session>` for Grill) and how token usage is reported. Fallback if the final message cannot be trusted: read the last `result` event of `stream-json`.

## 7. Sign-in and the allowlist (MEM-1, MEM-3, MEM-4, A7 first part)

- **Sign in with Google** on the Sign in page (OAuth code flow). Accept only `email_verified = true`.
- **Allowed** when the lower-cased email is in `OPERATOR_EMAILS` or in `allowlist_entry`. Otherwise show the access denied page with the email and no session.
- First allowed sign-in creates the `member` row; every sign-in updates name, picture and `last_sign_in_at`.
- **Session:** a `session` row with `expires_at` = now + 24 h, referenced by a secure, HTTP-only, `SameSite=Lax` cookie. Sign out sets `ended_at`.
- **Every request** (web and Gateway) loads the session and re-checks the allowlist. A removed email gets 401 and the cookie is cleared. API routes answer 401; pages redirect through `/session-ended`, which clears the cookie and sends the browser to Sign in. Open WebSockets re-check through the hook in §7.1.
- **Allowlist page** at `/allowlist`, Operator only (others get 404): table of emails with who added each and when; Operator emails shown first, marked "from configuration", not removable; add (validate the email shape, lower-case, reject duplicates); remove. Both write an audit entry (`allowlist.add`, `allowlist.remove`).

### 7.1 Ending connections at once

Removing an email calls `endMemberAccess(email)`: ends that Member's sessions and publishes `member.revoked` to the Gateway, which closes every browser WebSocket and terminal of that Member with code 4403. M0 builds the hook; M1 attaches terminals and live logs to it.

## 8. Host Agent, install script and Pod image

- `apps/host-agent` runs as a service: `scripts/install-host-agent.sh` writes a launchd plist (macOS) or systemd unit (Linux) that starts it at boot with `GATEWAY_URL` and `HOST_AGENT_SECRET` from a root-readable env file (POD-1).
- It reports host facts in `hello` (Docker reachable or not; total CPU, RAM, disk; architecture) and stores its last received id on disk.
- **Pod image** (`images/pod/Dockerfile`, POD-14): Ubuntu LTS, git, gh, Node LTS, Python 3, build-essential, the Claude Code CLI, a non-root user `pod` (uid 1000) owning `/workspace`. CI builds it for `linux/arm64` and `linux/amd64` and pushes to GHCR with a date tag on every merge that touches `images/pod`.
- **Spike (M0-02):** in a container from that image, log in to Claude Code by hand, run one headless prompt that edits a file and ends with the §6 JSON, then resume its session with a follow-up. Record the exact flags, the result shape and the usage fields in `docs/specs/notes/claude-headless.md`.

## 9. Seeds (FLW-8)

A migration-safe, idempotent seed inserts the nine sample Nodes and two sample Flows from requirements §4.4 with `is_sample = true`, keyed by a stable slug so re-running updates instead of duplicating. Seeded instructions are short and concrete; `Run tests` runs `npm test --if-present || make test` and `Open a pull request` runs `clauderon-open-pr` (a script in the image, written in M1). Both sample Flows pass `validateFlow` with no problems.

## 10. Acceptance tests

| # | Given / when / then | Covers |
| --- | --- | --- |
| T0-1 | Given the sample library, `validateFlow` returns no problems for both sample Flows | FLW-5, FLW-8 |
| T0-2 | An edge from `plan` to an `issue` input is rejected by `canConnect` and reported by `validateFlow` | A3 |
| T0-3 | A Flow with a cycle reports the closing edge; a Flow with two Ticket Nodes, none, or an unconnected required input reports each | A3, FLW-5 |
| T0-4 | `topologicalOrder` of *Plan and deliver* is stable across 100 shuffles of the Node list | RUN-2 |
| T0-5 | The Run state machine allows every move in the lifecycle diagram and refuses every other one | RUN-2 … RUN-9 |
| T0-6 | `nextNode` skips a Node whose required input is an unproduced optional Output, and the Run can still succeed | RUN-16 |
| T0-7 | With 2 Slots, 1 running and 1 waiting, `schedule` starts nothing; after one ends it starts the oldest Queued Run | POD-3 |
| T0-8 | `ticketStatus` returns each of the nine statuses for a matching fixture | TIC-6, TIC-7 |
| T0-9 | `mask` hides every token pattern and known secret in a mixed log line | NFR-1 |
| T0-10 | An unverified or non-allowlisted Google email gets access denied and no session; an Operator email always gets in | MEM-1, MEM-3, A7 |
| T0-11 | Removing an email ends its sessions; its next request gets 401; its open Gateway socket closes with 4403 | MEM-3, A7 |
| T0-12 | A non-Operator gets 404 on `/allowlist`; add and remove write audit entries | MEM-4 |
| T0-13 | Fake Host Agent connects with the right secret and is marked connected; a wrong secret is closed with 4401 | POD-1 |
| T0-14 | Drop the socket after message 5 was sent but not acknowledged; on reconnect message 5 is delivered exactly once | RUN-12, NFR-3 |
| T0-15 | Host Agent against a fake Gateway reconnects with backoff capped at 10 s | NFR-3 |

**Manual check:** sign in on the preview deploy with an allowlisted account; a second account is refused; the real Host Agent on the Pod Host shows as connected on a temporary status line.

## 11. Slices

| Id | Slice | Depends on |
| --- | --- | --- |
| M0-01 | Turborepo, TypeScript, lint, Vitest, CI with a Postgres service; empty apps and packages | — |
| M0-02 | Spike: Claude Code headless in a container; notes file | — |
| M0-03 | `packages/db`: schema and migrations (§3), seed runner | M0-01 |
| M0-04 | `packages/protocol`: envelope, message schemas (§4), resume buffer | M0-01 |
| M0-05 | `packages/core`: validator, topological order, state machine, scheduler, Ticket Status, masking (§5) | M0-01 |
| M0-06 | Seeds of sample Nodes and Flows (§9) | M0-03, M0-05 |
| M0-07 | Google sign-in, sessions, allowlist check, access denied page | M0-03 |
| M0-08 | Allowlist page, audit entries, `endMemberAccess` | M0-07 |
| M0-09 | Gateway: Host Agent socket, auth, hello/welcome, ack, heartbeat, browser socket with session check | M0-04, M0-07 |
| M0-10 | Host Agent: connect, reconnect, resume, host facts; install script | M0-04 |
| M0-11 | `packages/testing`: fake Host Agent, fake GitHub reader, fake clock | M0-04 |
| M0-12 | Pod image Dockerfile and multi-arch CI build | M0-01 |
