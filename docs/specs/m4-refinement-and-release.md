# M4 — Refinement and release

> **Roadmap:** Day 6 (refinement, staging) and Day 7 (release, buffer) · **Check:** the full journey on staging (Day 6); **A1–A7** on production and a recorded demo (Day 7).
> **Depends on:** [M3](m3-people-in-the-loop.md).
> **Updated 2026-11-20:** Pods are gone ([ADR 0006](../adr/0006-each-member-runs-on-their-own-machine.md)): each Member runs on their own Machine, and the Agent updates itself ([ADR 0007](../adr/0007-the-agent-ships-as-one-bundle-with-its-own-node.md)). POD-6, POD-7 and POD-8 are dropped.
> **Updated 2026-11-23:** M4 shipped in a smaller form (see the table in #13). Diff, Artifact, Batch page and Ticket detail were not built (#39, #40 closed `wontfix`), and there is no separate staging (#43 closed `wontfix`); the first release is the Render demo. Each section below says what was built and what was not; the plan is kept for the record.
> **Cuts made:** TRK-3, TRK-5, TRK-6 and TIC-4 (the Run page's Runs and Pull requests tabs and the pull request on GitHub cover them), POD-6 to POD-8, and the separate staging. TRK-4 stayed in (already in the app). Every cut is listed in the release notes with its reason.

## 1. Scope

| In | Requirement ids |
| --- | --- |
| _Not built:_ Diff and pull request link (#39, `wontfix`) | ~~TRK-3~~ |
| Usage per Node and Run (already in the app) | TRK-4 |
| _Not built:_ Artifact on the Run page and in the pull request body (#39, `wontfix`) | ~~TRK-5~~ |
| _Not built:_ Batch page (#40, `wontfix`) | ~~TRK-6~~ |
| _Not built:_ Ticket detail (#40, `wontfix`) | ~~TIC-4~~ |
| Worktree cleanup (#42) | RUN-14 |
| _Dropped:_ Pod Recreate, Delete Pod, measured use (no Pods any more; see section 3; #41, `wontfix`) | ~~POD-6, POD-7, POD-8~~ |
| Retention, backups and guides; production on Render. _Not built:_ a separate staging (#43, `wontfix`) | NFR-5, R10 |

## 2. Tracking

### 2.1 Diff (TRK-3)

> **Not in v1** (#39, `wontfix`). Read the diff on the pull request on GitHub; the Run page's **Runs** and **Pull requests** tabs link to it. What follows is the original plan.

The Run page's **Diff** tab: after any Node that moves HEAD, the Agent sends the diff of the branch against the merge base with the Project's base branch (as part of `node.result`, capped at 1 MB, with a "truncated" flag), stored on the Attempt. The tab shows the latest one per file with additions and deletions, plus the pull request link and state.

### 2.2 Usage (TRK-4)

From `node.usage` (M1): input and output tokens and duration per Attempt, a column on the timeline, and totals per Run in the header. No money (requirements: Q11).

### 2.3 Artifact (TRK-5)

> **Not in v1** (#39, `wontfix`). The pull request on GitHub (its own description and screenshots) takes its place, reached from the **Runs** and **Pull requests** tabs; the app does not write the pull request body. What follows is the original plan.

When a Run ends `succeeded`, the Gateway assembles `artifact.content` from the Run's latest Outputs: the `summary` (what changed, how to test it), every `screenshot`, diff statistics (files, additions, deletions) and the `pull-request` link. It shows as the Run page's **Artifact** tab. If the Run has a pull request, the Gateway sends `pr.writeBody`; the Agent runs `gh pr edit --body-file` on the Starter's Machine under their own `gh` login, keeping the `Refs #<n>` line. A failure there is logged on the Run and does not change its state. The app itself still never writes to GitHub.

`screenshot` Outputs are image files a Node wrote in the worktree's `.clauderon/screenshots/`; the Agent uploads them with the result and the Gateway stores them (Postgres `bytea`, 2 MB cap each).

### 2.4 Batch page (TRK-6)

> **Not in v1** (#40, `wontfix`). Use the **Runs** tab, filtered by state, and the **Pull requests** tab. What follows is the original plan.

`/batches/<id>`, linked from every Run of the Batch and from the Start confirmation: each Run with Ticket, state, current Node, pull request link, and counts per state at the top.

### 2.5 Ticket detail (TIC-4)

> **Not in v1** (#40, `wontfix`). Read the issue on GitHub; the **Runs** tab lists the Runs of a Ticket and **Pull requests** their pull requests. What follows is the original plan.

`/tickets/<id>`: issue body rendered from GitHub markdown (sanitised), labels, author with the outside-author warning of TIC-9, every Run of the Ticket with state, mode, pull request and Artifact links, and **Start**.

## 3. Machines (replaces Pods)

POD-6 (Recreate and the newer image), POD-7 (Delete Pod) and POD-8 (measured use) are dropped: there are no Pods or images to recreate. A Machine is the Member's own computer; the Agent updates itself from the web app after each deploy (ADR 0007), and the Machine page already shows what the Agent reports (CPUs, memory, disk, logins, Doctor). Live CPU and RAM use of a Machine is not in v1 (issue #41 closed as `wontfix`; open a v1.1 issue if wanted).

## 4. Worktree cleanup (RUN-14)

Built in #42 as below, except that there is no Artifact step to wait for (section 2.3).

When a Run ends `succeeded` or `cancelled`, after the Artifact step, the Gateway sends `workspace.cleanup`: `git worktree remove --force` and delete the local branch (the pushed branch stays on GitHub). `failed` and `interrupted` Runs keep their worktree. A cleanup failure is logged and retried on the next Agent connect.

## 5. Release

### 5.1 Environments and deploys (R10)

The web app, the Gateway and Postgres run as one Docker Compose stack on one host ([ADR 0005](../adr/0005-self-host-the-app-on-the-pod-host.md), [ADR 0006](../adr/0006-each-member-runs-on-their-own-machine.md)); how to set it up is in [deploy/README.md](../../deploy/README.md). There is **no separate staging** (#43, `wontfix`). The first release is the free demo on Render (`render.yaml`, "Production on Render" in [deploy/README.md](../../deploy/README.md)), deployed from `main`; moving it to production use (a Gateway that stays on, a paid database with 14-day backups, custom domains) is #118. The Compose stack in `deploy/` remains the self-hosted option. Members pair their Machines with the one app. The staging column of the original plan (a second Compose project `clauderon-staging`, its own database and port) is not built.

Order for every deploy: run migrations, deploy the Gateway, deploy the web app (the Compose stack enforces it). Migrations only add (no drops or renames in v1), so the old Gateway keeps working while the new web app ships, and the reverse.

### 5.2 Retention and backups (NFR-5)

- A daily job in the Gateway deletes `log_chunk` rows older than 90 days. Runs, Outputs and Artifacts are kept.
- `deploy/backup.sh` (Compose stack) takes a daily Postgres backup kept 14 days, synced off the host; `deploy/README.md` says how to restore, and a restore is tried once before the release.

### 5.3 Guides

The repository README gains: how to install the Agent (the one-line installer from the Machines page, pairing, checking it is connected), how to deploy both parts and run migrations, the configuration table of M0 §2, and how to rotate each secret.

### 5.4 Release day

1. Deploy (the Render demo); allowlist the team.
2. Bug bash on production: everyone runs the full journey on the sandbox repository.
3. A1–A7 on production, ticked off in the release issue.
4. Recorded demo of the full journey: Pair my Machine → log in → enable a Project → Sync → clone a Flow → Start a Batch → answer, approve → pull request and Artifact.
5. Everything left becomes a v1.1 issue.

## 6. Acceptance tests

| # | Given / when / then | Covers |
| --- | --- | --- |
| T4-1 | _Dropped_ with TRK-5 (#39). A succeeded Run with a summary, two screenshots and a pull request gets an Artifact with all four parts and sends `pr.writeBody` with `Refs #<n>` kept | TRK-5 |
| T4-2 | _Dropped_ with TRK-5 (#39). A `pr.writeBody` failure leaves the Run `succeeded` and logs the error | TRK-5 |
| T4-3 | _Dropped_ (#39; usage is already in the app). Usage totals on the Run equal the sum of its Attempts | TRK-4 |
| T4-4 to T4-6 | _Dropped_ with POD-6, POD-7 and POD-8 (no Pods) | |
| T4-7 | _Kept (#42)._ Succeeded and Cancelled Runs send `workspace.cleanup`; Failed and Interrupted do not | RUN-14 |
| T4-8 | _Kept._ The retention job deletes 91-day-old log chunks and keeps 89-day-old ones | NFR-5 |
| T4-9 | _Dropped_ with TRK-6 (#40). Batch page counts match the Runs' states | TRK-6 |
| T4-10 | _Dropped_ with TIC-4 (#40). Ticket detail lists every Run of the Ticket | TIC-4 |

**Manual checks:** the full journey and A1–A7 on the deployed app (no staging).

## 7. Slices

| Id | Slice | Status |
| --- | --- | --- |
| M4-01 | Diff capture and Diff tab | Not built (#39, `wontfix`) |
| M4-02 | Usage column and totals | Already in the app |
| M4-03 | Artifact assembly, Artifact tab, screenshots, `pr.writeBody` | Not built (#39, `wontfix`) |
| M4-04 | Batch page and Ticket detail | Not built (#40, `wontfix`) |
| M4-05, M4-06 | _Dropped_ (Pod Recreate, Delete Pod and measured use; ADR 0006; #41, `wontfix`) | Not built |
| M4-07 | Worktree cleanup | Built (#42) |
| M4-08 | Deploy order, retention job, backups; no separate staging | Built without staging (#43, `wontfix`); the Render demo is the first release, production hardening in #118 |
| M4-09 | README guides | Built (README and `deploy/README.md`); the Render production steps follow with #118 |
