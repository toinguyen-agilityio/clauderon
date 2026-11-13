# Clauderon v1 — Questions before the spec

> **Date:** 2026-11-13 · **Status:** Waiting for team answers
> **Why:** the [v1 requirements](requirements/v1-requirements.md) are settled, but the spec needs these decisions first. Each question lists options with the suggested one first, marked **(Recommended)**. Write the team's choice on the **Decision** line, or a different answer if none fits. Unanswered questions take the recommended option.

Vocabulary follows [CONTEXT.md](../CONTEXT.md). The ADRs in [adr/](adr/) are taken as given.

**Contents**

- [A. How the spec is written and tested](#a-how-the-spec-is-written-and-tested) — Q1–Q4
- [B. Open questions from the requirements (section 8)](#b-open-questions-from-the-requirements-section-8) — Q5–Q14
- [C. Host Agent, Pods and terminal](#c-host-agent-pods-and-terminal) — Q15–Q23
- [D. Run engine and Human Nodes](#d-run-engine-and-human-nodes) — Q24–Q33
- [E. Tickets, GitHub and Artifact](#e-tickets-github-and-artifact) — Q34–Q39
- [F. Flows](#f-flows) — Q40–Q42
- [G. Sign-in, logs and audit](#g-sign-in-logs-and-audit) — Q43–Q47
- [Summary of recommendations](#summary-of-recommendations)

---

## A. How the spec is written and tested

### Q1. Main test seam

There is no code yet. The spec should name as few test seams as possible, as high as possible.

- **a. One seam: the app core, driven through its commands and queries (Recommended).** Tests call the core (start a Batch, approve, retry, cancel, save a Flow, Sync) with a fake Host Agent that speaks the real Host Agent protocol, a fake GitHub reader and a fake clock, then check Run states, Ticket Status, Needs you, Slots and audit. The Flow validator, scheduler, run engine and Ticket Status are all tested through it. The real Host Agent gets its own tests against a fake Docker, on the same protocol.
- b. Seam (a) plus end-to-end tests through the HTTP API and UI for sign-in, the Start dialog and Needs you.
- c. Separate unit seams for the validator, scheduler, Run state machine and Ticket Status.

**Decision:**

### Q2. Where the spec is published

- **a. A GitHub issue in this repository, with a new `ready-for-agent` label (Recommended).** The label does not exist yet and would be created.
- b. A GitHub issue without a label.
- c. A Markdown file in the repo (for example `docs/spec.md`), reviewed as a pull request.

**Decision:**

### Q3. One spec or several

- **a. One spec for all of v1, later split into issues per milestone M0–M4 (Recommended).**
- b. One spec per milestone, written just before each starts.
- c. One spec per module (Pods, Flows, Tickets, Runs).

**Decision:**

### Q4. Repository layout

The app, the Host Agent and the Pod image must live somewhere.

- **a. One repository (this one) with three parts: web app, Host Agent, Pod image, sharing the protocol types (Recommended).**
- b. Separate repositories for the app, the Host Agent and the image.

**Decision:**

---

## B. Open questions from the requirements (section 8)

### Q5. Hosting the web app and database (open question 1)

- **a. A managed cloud platform (for example Railway, Render or Fly) with a managed Postgres, reachable over the internet behind Google sign-in (Recommended).**
- b. A company server, reachable only inside the company network or VPN. The Pod Host and every Member must reach it.
- c. On the Pod Host itself (contradicts the 2026-11-13 decision "hosted elsewhere").

**Decision:**

### Q6. Installing and pairing the Host Agent (open question 2)

- **a. An install script that sets up the Host Agent as a service that starts with the Pod Host (launchd on macOS, systemd on Linux), paired with a long-lived Host Agent secret from the app's configuration (Recommended).**
- b. A one-time pairing code shown in the app, exchanged for a secret on first connect.
- c. The Host Agent runs as a Docker container itself, with the Docker socket mounted.

**Decision:**

### Q7. Default Pod limits and Pod Host capacity (open question 3)

- **a. 2 CPU, 4 GB RAM, 2 Slots per Pod by default; the owner may change Slots, CPU and RAM up to a cap set in the app's configuration (Recommended).**
- b. 4 CPU, 8 GB RAM, 2 Slots per Pod, fixed.
- c. No CPU/RAM limits in v1, Slots only (weakens NFR-6).

Capacity: the Pods page shows the sum of Pod limits against the Pod Host's total. **Should Create my Pod be refused when the Pod Host would be over-committed?** Suggested: no, warn only.

**Decision:**

### Q8. The standard image (open question 4)

- **a. Built from a Dockerfile in this repo by CI for arm64 and amd64, with git, gh, Node LTS, Python 3, build tools and the Claude Code CLI; maintained by whoever owns the Host Agent (Recommended).**
- b. Node only; other toolchains installed by each Member into their Workspace.
- c. A public base image (for example a devcontainer image) plus Claude Code.

**Decision:**

### Q9. How the Artifact is produced (open question 5)

- **a. The app assembles it when the Run ends from the Run's Outputs: the `summary` Output (what changed, how to test), every `screenshot` Output, the diff stats and the `pull-request` link. No built-in screenshot capture; a Node must produce `screenshot` Outputs (Recommended).**
- b. Every Flow must end with an Agent Node that writes the Artifact.
- c. Both: assemble from Outputs, plus an extra Agent call at the end to write the prose.

**Decision:**

### Q10. Output Types for the sample Flows (open question 6)

The sample Tasks need: Grill a plan (`issue` → `plan`), Approve a plan (`plan` → `plan`), Code a change (`plan` → `branch`, `summary`), Run tests (`branch` → `test-result`), Open a pull request (`branch`, `test-result` optional → `pull-request`).

- **a. The current list is enough. Approve passes its input through unchanged as the same Output Type (Recommended).**
- b. Add an `approval` type so the approval itself is an Output.
- c. Add a generic `text` type for free-form Outputs.

**Decision:**

### Q11. Showing cost (open question 7)

- **a. Tokens and duration only (Recommended).**
- b. Tokens plus the cost Claude Code reports, labelled "API-equivalent cost", since subscriptions are not billed per token.

**Decision:**

### Q12. Log retention and backups (open question 8)

- **a. Logs kept 90 days, then deleted (the Run, its Outputs and Artifact stay); daily database backups kept 14 days (Recommended).**
- b. Logs kept forever; daily backups kept 30 days.
- c. Logs kept 30 days; backups left to the hosting platform's defaults.

**Decision:**

### Q13. Tech stack (open question 9)

- **a. TypeScript everywhere: a Node backend with Postgres, React + Vite + React Flow for the UI, Vitest for tests, and the Host Agent in Node/TypeScript sharing the protocol types (Recommended).**
- b. Same web app, Host Agent in Go (a single binary, easier to install on the Pod Host).
- c. A full-stack framework (for example Next.js) for the app, Host Agent in Node.

**Decision:**

### Q14. Google OAuth client and session length (open question 10)

- **a. The OAuth client lives in a company Google Cloud project owned by the team lead; sessions last 7 days, renewed on use, with a hard limit of 30 days (Recommended).**
- b. A personal Google Cloud project; sessions last 24 hours.
- c. Sessions last until sign-out (weakens R7).

**Decision:**

---

## C. Host Agent, Pods and terminal

### Q15. Host Agent connection

- **a. One WebSocket over HTTPS opened by the Host Agent, carrying commands, events and log chunks; every message has an id so either side can resume after a reconnect (Recommended).**
- b. HTTPS long-polling for commands plus POST for events and logs.
- c. gRPC streaming.

**Decision:**

### Q16. Who orchestrates a Run

- **a. The app: it keeps all Run state in the database and asks the Host Agent to run one Node at a time; the Host Agent only executes and reports (Recommended).** Interrupted handling and Retry stay in one place.
- b. The Host Agent runs a whole Run locally and reports progress.

**Decision:**

### Q17. When a Run becomes Interrupted

- **a. Heartbeat every 10 seconds; after 30 seconds without one, the Pod's Running Runs become Interrupted. A Run Waiting for human is not Interrupted by a disconnect, since nothing is executing (Recommended).**
- b. Interrupted immediately on disconnect.
- c. A 5-minute grace period before Interrupted, in case the Host Agent reconnects and the Node is still running.

**Decision:**

### Q18. A Node still running when the Host Agent reconnects

After a short network drop, the Claude Code or shell process in the Pod may still be alive.

- **a. The Host Agent kills any orphaned Node process on reconnect; the Run stays Interrupted and the Starter retries (Recommended).** Simple and matches "nothing is retried automatically".
- b. The Host Agent reattaches and the Run continues if it was not yet marked Interrupted.

**Decision:**

### Q19. Checking Claude Code and gh login state

- **a. The Host Agent checks both (`gh auth status` and a Claude Code status check) when the Pod starts, after each terminal session closes, before each Real Run starts, and every 5 minutes; it reports the gh account and token scopes too (Recommended).**
- b. Check only on demand, with a "Refresh" button on the Pod page.

**Decision:**

### Q20. Web terminal path and what is recorded

- **a. Browser ↔ app over WebSocket ↔ Host Agent ↔ `docker exec` with a TTY (xterm.js in the browser). The audit log records who opened the session and when it started and ended, not the keystrokes, since logins type secrets (Recommended).**
- b. Same path, and the full output transcript is stored, with secrets masked.

**Decision:**

### Q21. "Newer image available" for Recreate

- **a. The app's configuration names the current image tag; the Host Agent pulls it and compares digests with each Pod's image (Recommended).**
- b. Images use version numbers; a higher number means newer.

**Decision:**

### Q22. Changing Slots, CPU or RAM on an existing Pod

- **a. Slots can change any time and apply at the next scheduling decision (running Runs are not stopped); CPU and RAM changes apply on the next Recreate (Recommended).**
- b. Any change requires the Pod to have no Running or Waiting Runs.

**Decision:**

### Q23. Project clones in the Workspace

- **a. The first Real Run of a Project on a Pod clones it with the Starter's gh login; later Runs fetch the base branch and add a worktree (Recommended).**
- b. The owner clones each Project by hand in the terminal.

**Decision:**

---

## D. Run engine and Human Nodes

### Q24. Retry and queue position

The lifecycle says Failed or Interrupted → Queued on Retry.

- **a. A retried Run joins the back of its Pod's queue, like a new Run (Recommended).**
- b. A retried Run jumps to the front of the queue.

**Decision:**

### Q25. Dry-run and Pod Ready

- **a. A Dry-run needs the Starter to have a Pod (it uses a Slot) but not the Claude Code or gh logins, and runs in the app without executing anything in the Pod (Recommended).**
- b. A Dry-run needs a Pod Ready, like a Real Run.
- c. A Dry-run needs no Pod and does not use Slots (contradicts RUN-13).

**Decision:**

### Q26. How an Agent Node returns its Outputs

- **a. The Node's prompt asks Claude Code to end with one structured result (JSON) naming each Output; the app validates it against the Node's Output Types and fails the Node if a required Output is missing (Recommended).**
- b. Claude Code writes Outputs to files in a known folder of the worktree.
- c. Free text only; the app stores the last message as the Output.

**Decision:**

### Q27. How a Command Node returns its Outputs

- **a. Exit code 0 succeeds, anything else fails. A `test-result` Output is the exit code plus the last 200 lines of output; a `branch` Output is the Run's branch at its current commit (Recommended).**
- b. The command prints a JSON line with its Outputs.

**Decision:**

### Q28. What the Run's branch is called

- **a. `clauderon/<issue-number>-<short-title-slug>-<short-run-id>` (Recommended).**
- b. `feat/<issue-number>-<slug>`, as in the Dry-run examples.
- c. The Agent Node chooses the name.

**Decision:**

### Q29. How Grill works

- **a. The Grill Node runs Claude Code with a structured result that is either `{ question }` or the Node's Outputs. On a question the Run goes to Waiting for human; the Member's answer resumes the same Claude Code session; this repeats until Outputs come back (Recommended).**
- b. Claude asks all its questions at once, a Member answers them in one form, and Claude produces its Output.

**Decision:**

### Q30. Limit on Grill rounds

- **a. No limit; any Member can Cancel (Recommended).**
- b. A limit per Node (for example 10 rounds), after which the Node fails.

**Decision:**

### Q31. Passing Reject feedback on Retry

- **a. The latest Reject feedback of the Run is added to the retried Node's instructions under a "Feedback from the last review" heading (Recommended).**
- b. Only passed when the retried Node is the one directly before the rejecting Approve Node.

**Decision:**

### Q32. Several end Nodes and Run success

FLW-5 allows several end Nodes.

- **a. A Run succeeds when every Node it can reach has succeeded; an optional Output left unproduced does not fail it (Recommended).**
- b. A Run succeeds when any end Node succeeds.

**Decision:**

### Q33. A Node that produces no changes

RUN-11 opens a pull request only when there are changes.

- **a. `Open a pull request` succeeds with no `pull-request` Output and logs "no changes"; the Run succeeds and Ticket Status stays `Open` (Recommended).**
- b. The Node fails, so a Member notices and decides.

**Decision:**

---

## E. Tickets, GitHub and Artifact

### Q34. What Sync fetches

- **a. All open issues of the Project, plus the current state of every Ticket already known (so issues closed on GitHub show `Closed`) and of every pull request opened by a Run (Recommended).**
- b. Open issues only; Tickets closed on GitHub disappear from the list.

**Decision:**

### Q35. Keeping `PR open` / `PR merged` current

Automatic sync is out of scope.

- **a. Pull request state is read on Sync and whenever a Ticket, Run or Batch page is opened (Recommended).**
- b. Only on Sync.

**Decision:**

### Q36. Writing the Artifact into the pull request body

The pull request is opened by a Node before the Run ends, but TRK-5 writes the Artifact into its body when the Run ends. The app never writes to GitHub (ADR 0001).

- **a. When the Run ends, the app asks the Host Agent to edit the pull request body with the Starter's gh login in the Pod, as a final system step outside the Flow (Recommended).** Still a write from the Pod, so ADR 0001 holds.
- b. `Open a pull request` writes what it knows at that moment; the Artifact is only shown in the app.
- c. Require `Open a pull request` to be the last Node, and assemble the Artifact just before it.

**Decision:**

### Q37. Ticket key across organisations

TIC-1 shows keys like `ledger-api#412`.

- **a. Use the repository name; if two Projects share a name, show `owner/repo#n` for both (Recommended).**
- b. Always `owner/repo#n`.

**Decision:**

### Q38. Read-only GitHub token type

- **a. A fine-grained personal access token with Issues: read and Pull requests: read on the Projects' repositories, set in the app's configuration (Recommended).**
- b. A GitHub App installed on the repositories, read-only.

**Decision:**

### Q39. Enabling a Project

- **a. Type `owner/repo`; the app checks with its token that the repository is readable and offers its branches for the base branch (Recommended).**
- b. Pick from a list of every repository the token can read.

**Decision:**

---

## F. Flows

### Q40. Actions on a locked Flow

FLW-7 locks a Flow while an Active Run uses it.

- **a. A locked Flow can still be viewed and cloned, not edited or deleted; the editor says which Runs hold the lock (Recommended).**
- b. A locked Flow cannot be cloned either.

**Decision:**

### Q41. Who can edit or delete a Flow or Task

There are no roles in v1.

- **a. Any Member can edit or delete any non-sample Flow or Task; each change is audited (Recommended).**
- b. Only the Member who created it.

**Decision:**

### Q42. Editing a Task used by Flows

- **a. A Task cannot be edited while any Flow using it is locked; edits change every Flow that uses it (Recommended).**
- b. Nodes copy the Task when added, so editing a Task never changes existing Flows.

**Decision:**

---

## G. Sign-in, logs and audit

### Q43. Allowlist format

- **a. A comma-separated list of emails in one environment variable, compared case-insensitively; changing it needs a restart or redeploy (Recommended).**
- b. A config file read on change, without restart.

**Decision:**

### Q44. Ending sessions of a removed email

- **a. Every request checks the session's email against the allowlist, so removal takes effect on the next request, including open WebSocket and terminal connections (Recommended).**
- b. Sessions end at their next renewal.

**Decision:**

### Q45. Allowing only a company domain

- **a. No; the allowlist is exact emails only, since personal Gmail is allowed (Recommended).**
- b. Also allow entries like `@company.com` for a whole domain.

**Decision:**

### Q46. Masking secrets in logs

NFR-1 masks tokens and secrets in every log.

- **a. The Host Agent and app mask known token patterns (GitHub, Anthropic, OAuth) and the values of known secrets before storing or streaming any log line (Recommended).**
- b. Mask only known secret values held by the app.

**Decision:**

### Q47. Where log lines are stored

- **a. In Postgres, as chunks per Attempt, deleted by the retention job in Q12 (Recommended).**
- b. In object storage, with only an index in Postgres.

**Decision:**

---

## Summary of recommendations

If the team accepts every recommendation, the spec will assume:

- One test seam: the app core with a fake Host Agent on the real protocol; one spec for all of v1, published as a GitHub issue labelled `ready-for-agent`; one repository holding app, Host Agent and image.
- Hosted on a managed cloud platform with Postgres; TypeScript everywhere; Host Agent installed as an OS service and paired with a secret from configuration.
- Pods default to 2 CPU, 4 GB RAM, 2 Slots; image built by CI with Node, Python and Claude Code.
- The app orchestrates Runs Node by Node over one resumable WebSocket; 30 seconds without a heartbeat makes Running Runs Interrupted; orphaned processes are killed.
- Agent and Grill Nodes return structured results; Grill resumes the same Claude Code session; Reject feedback is added to the retried Node.
- The Artifact is assembled from Outputs and written into the pull request body from the Pod at the end of the Run.
- Sync also refreshes known Tickets and pull requests; pull request state is also read when pages open.
- Sessions last 7 days (30 at most); the allowlist is checked on every request; logs live in Postgres for 90 days.
