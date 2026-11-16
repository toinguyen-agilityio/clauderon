# M4 — Refinement and release

> **Roadmap:** Day 6 (refinement, staging) and Day 7 (release, buffer) · **Check:** the full journey on staging (Day 6); **A1–A7** on production and a recorded demo (Day 7).
> **Depends on:** [M3](m3-people-in-the-loop.md).
> **Cut order if time is short:** POD-8 → TRK-4 → TRK-6 → POD-7 → the Grill kind of FLW-2 (in M3) → TIC-2 (in M1) → the Recreate digest check. Every cut is listed in the release notes with its reason.

## 1. Scope

| In | Requirement ids |
| --- | --- |
| Diff and pull request link | TRK-3 |
| Usage per Node and Run | TRK-4 |
| Artifact on the Run page and in the pull request body | TRK-5 |
| Batch page | TRK-6 |
| Ticket detail | TIC-4 |
| Pod Recreate with image digest check, Delete Pod, measured use | POD-6 (Recreate), POD-7, POD-8 |
| Worktree cleanup | RUN-14 |
| Staging and production deploys, retention and backups, guides | NFR-5, R10 |

## 2. Tracking

### 2.1 Diff (TRK-3)

The Run page's **Diff** tab: after any Node that moves HEAD, the Host Agent sends the diff of the branch against the merge base with the Project's base branch (as part of `node.result`, capped at 1 MB, with a "truncated" flag), stored on the Attempt. The tab shows the latest one per file with additions and deletions, plus the pull request link and state.

### 2.2 Usage (TRK-4)

From `node.usage` (M1): input and output tokens and duration per Attempt, a column on the timeline, and totals per Run in the header. No money (requirements: Q11).

### 2.3 Artifact (TRK-5)

When a Run ends `succeeded`, the Gateway assembles `artifact.content` from the Run's latest Outputs: the `summary` (what changed, how to test it), every `screenshot`, diff statistics (files, additions, deletions) and the `pull-request` link. It shows as the Run page's **Artifact** tab. If the Run has a pull request, the Gateway sends `pr.writeBody`; the Host Agent runs `gh pr edit --body-file` in the Pod with the Starter's login, keeping the `Refs #<n>` line. A failure there is logged on the Run and does not change its state. The app itself still never writes to GitHub.

`screenshot` Outputs are image files a Node wrote in the worktree's `.clauderon/screenshots/`; the Host Agent uploads them with the result and the Gateway stores them (Postgres `bytea`, 2 MB cap each).

### 2.4 Batch page (TRK-6)

`/batches/<id>`, linked from every Run of the Batch and from the Start confirmation: each Run with Ticket, state, current Node, pull request link, and counts per state at the top.

### 2.5 Ticket detail (TIC-4)

`/tickets/<id>`: issue body rendered from GitHub markdown (sanitised), labels, author with the outside-author warning of TIC-9, every Run of the Ticket with state, mode, pull request and Artifact links, and **Start**.

## 3. Pods

### 3.1 Recreate and the newer image (POD-6)

- `image.check` with `POD_IMAGE` on Host Agent connect, then every hour; the Host Agent pulls the tag and returns its digest. A Pod whose `image_digest` differs shows "Newer image available".
- **Recreate**, owner only, refused while the Pod has Running or Waiting Runs: the Host Agent removes the container and creates a new one from `POD_IMAGE` with the saved CPU and RAM and the same Workspace volume, then starts it; a login check follows. Audit: `pod.recreate`.

### 3.2 Delete Pod (POD-7)

Owner only, refused while the Pod has any Active Run. Confirm by typing the Pod owner's email. Removes the container and the Workspace volume, logins included, and the `pod` row; Runs keep their history. Audit: `pod.delete`.

### 3.3 Measured use (POD-8)

`heartbeat.pods[].metrics` (from `docker stats` and the volume size, at most every 30 s) shown as CPU %, RAM used out of limit, and Workspace disk use on each Pod row, with Pod Host totals on the card.

## 4. Worktree cleanup (RUN-14)

When a Run ends `succeeded` or `cancelled`, after the Artifact step, the Gateway sends `workspace.cleanup`: `git worktree remove --force` and delete the local branch (the pushed branch stays on GitHub). `failed` and `interrupted` Runs keep their worktree. A cleanup failure is logged and retried on the next Host Agent connect.

## 5. Release

### 5.1 Environments and deploys (R10)

| Part | Staging | Production |
| --- | --- | --- |
| Web app | Vercel preview branch `staging` | Vercel production |
| Gateway | Railway or Fly service `gateway-staging` | `gateway` |
| Database | Its own managed Postgres | Its own managed Postgres |
| Host Agent | The same Pod Host, a second Host Agent with its own secret and Pods prefixed `stg-` | The Pod Host's main Host Agent |

Order for every deploy: run migrations, deploy the Gateway, deploy the web app. Migrations only add (no drops or renames in v1), so the old Gateway keeps working while the new web app ships, and the reverse.

### 5.2 Retention and backups (NFR-5)

- A daily job in the Gateway deletes `log_chunk` rows older than 90 days. Runs, Outputs and Artifacts are kept.
- The managed Postgres takes a daily backup kept 14 days; the README says where to restore from and a restore is tried once on staging.

### 5.3 Guides

The repository README gains: how to install the Host Agent (install script, secret, checking it is connected), how to deploy both parts and run migrations, the configuration table of M0 §2, and how to rotate each secret.

### 5.4 Release day

1. Production deploy; allowlist the team.
2. Bug bash on production: everyone runs the full journey on the sandbox repository.
3. A1–A7 on production, ticked off in the release issue.
4. Recorded demo of the full journey: Create my Pod → log in → enable a Project → Sync → clone a Flow → Start a Batch → answer, approve → pull request and Artifact.
5. Everything left becomes a v1.1 issue.

## 6. Acceptance tests

| # | Given / when / then | Covers |
| --- | --- | --- |
| T4-1 | A succeeded Run with a summary, two screenshots and a pull request gets an Artifact with all four parts and sends `pr.writeBody` with `Refs #<n>` kept | TRK-5 |
| T4-2 | A `pr.writeBody` failure leaves the Run `succeeded` and logs the error | TRK-5 |
| T4-3 | Usage totals on the Run equal the sum of its Attempts | TRK-4 |
| T4-4 | Recreate is refused with a Waiting Run; when allowed it sends `pod.recreate` with the saved limits and keeps the volume | POD-6 |
| T4-5 | A different digest from `image.status` marks the Pod "Newer image available" | POD-6 |
| T4-6 | Delete is refused with a Failed Run (Active); allowed otherwise, and the Runs stay visible | POD-7 |
| T4-7 | Succeeded and Cancelled Runs send `workspace.cleanup`; Failed and Interrupted do not | RUN-14 |
| T4-8 | The retention job deletes 91-day-old log chunks and keeps 89-day-old ones | NFR-5 |
| T4-9 | Batch page counts match the Runs' states | TRK-6 |
| T4-10 | Ticket detail lists every Run of the Ticket, Dry-run marked | TIC-4 |

**Manual checks:** the full journey on staging (Day 6); A1–A7 on production (Day 7).

## 7. Slices

| Id | Slice | Depends on |
| --- | --- | --- |
| M4-01 | Diff capture and Diff tab | M3 |
| M4-02 | Usage column and totals | M3 |
| M4-03 | Artifact assembly, Artifact tab, screenshots, `pr.writeBody` | M4-01 |
| M4-04 | Batch page and Ticket detail | M3 |
| M4-05 | Image check, Recreate | M3 |
| M4-06 | Delete Pod and measured use | M4-05 |
| M4-07 | Worktree cleanup | M3 |
| M4-08 | Staging environment, deploy order, retention job, backups | M3 |
| M4-09 | README guides | M4-08 |
