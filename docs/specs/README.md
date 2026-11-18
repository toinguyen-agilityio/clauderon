# Clauderon v1 — milestone specs

> **Status:** draft for review · **Date:** 2026-11-16 · **Source of truth for scope:** [v1 requirements](../requirements/v1-requirements.md). Where a spec and the requirements disagree, the requirements win and the spec is fixed.
> **Schedule:** [seven-day roadmap](../roadmap/v1-seven-day-plan.md). The milestones here follow its split.

One spec per milestone. Each one is written for a person or a coding agent to implement without asking: what is in scope (by requirement id), the contracts it relies on, the behaviour and edge cases, the acceptance tests, and the slices to build it in. Each spec also becomes one GitHub issue labelled `ready-for-agent` that links back here (spec questions Q2 and Q3).

| Spec | Milestone | Roadmap days | Check |
| --- | --- | --- | --- |
| [m0-foundations.md](m0-foundations.md) | **M0** Foundations | Day 1 | Core unit tests; sign-in refuses unknown emails; Host Agent connected |
| [m1-walking-skeleton.md](m1-walking-skeleton.md) | **M1** Walking skeleton | Days 2–3 | **A7**, **A1** |
| [m2-flows-and-scheduling.md](m2-flows-and-scheduling.md) | **M2** Flows and scheduling | Day 4 | **A2, A3, A6** |
| [m3-people-in-the-loop.md](m3-people-in-the-loop.md) | **M3** People in the loop | Day 5 | **A4, A5** |
| [m4-refinement-and-release.md](m4-refinement-and-release.md) | **M4** Refinement and release | Days 6–7 | Full journey on staging; **A1–A7** on production |

---

## Requirement coverage

Every requirement lands in exactly one milestone, or is split across two where the roadmap builds it in steps (marked →).

| Area | M0 | M1 | M2 | M3 | M4 |
| --- | --- | --- | --- | --- | --- |
| Members and Projects | MEM-1, MEM-3, MEM-4 | MEM-2 (terminal and Start tied to own Pod), PRJ-1, PRJ-2 | | MEM-2 (any Member responds, cancels, retries) | |
| Pods | POD-1, POD-14 | POD-2, POD-4, POD-5, POD-6 (Start, Stop), POD-9, POD-10, POD-11, POD-12, POD-13 | POD-3 | | POD-6 (Recreate, image digest), POD-7, POD-8 |
| Tickets | | TIC-1, TIC-2, TIC-3, TIC-5, TIC-6, TIC-7, TIC-8, TIC-9 | | | TIC-4 |
| Flows | FLW-1, FLW-5 (validator), FLW-8 | | FLW-3, FLW-4, FLW-5 (editor), FLW-6, FLW-7, FLW-9, FLW-10 | FLW-2 | |
| Runs | RUN-12 (heartbeat, message ids) | RUN-1 (Real), RUN-2, RUN-3, RUN-10, RUN-11, RUN-16 | RUN-1 (Dry-run, Batch queue), RUN-13 | RUN-4 … RUN-9, RUN-12 (Interrupted, orphans), RUN-15 | RUN-14 |
| Tracking | | TRK-1, TRK-2, TRK-7 | | | TRK-3, TRK-4, TRK-5, TRK-6 |
| Non-functional | NFR-1 (secrets, cookies), NFR-3 (reconnect) | NFR-1 (masking), NFR-4, NFR-5 (logs), NFR-6 | | NFR-2, NFR-3 (resume within 30 s) | NFR-5 (retention, backups) |

---

## Shared conventions

### Repository layout

Fixed in M0; later specs add files inside it, never new top-level parts.

| Path | What |
| --- | --- |
| `apps/web` | Next.js web app: UI and ordinary API (route handlers, server actions) |
| `apps/gateway` | Always-on Node service: Host Agent link, terminals, heartbeat, Run engine, live log fan-out |
| `apps/host-agent` | Node process on the Pod Host: Docker, Workspaces, Node execution, terminal PTYs |
| `packages/db` | Schema, migrations, typed queries; the only package that talks to Postgres |
| `packages/protocol` | Gateway ↔ Host Agent and browser ↔ Gateway message types with runtime validation |
| `packages/core` | Pure domain logic: Flow validator, Run state machine, Slot scheduler, Ticket Status, retry context, masking |
| `packages/testing` | Fake Host Agent, fake GitHub reader, fake clock, fixtures (spec Q1) |
| `images/pod` | Dockerfile of the standard Pod image and the helper scripts it ships |

### The test seam (spec Q1)

- **App tests** drive the app core through its commands and queries (the same functions the web app and the Gateway call) with three fakes from `packages/testing`:
  - a **fake Host Agent** that speaks the real `packages/protocol` messages over an in-memory socket and can be scripted (succeed, fail, stream logs, drop the connection, ask questions);
  - a **fake GitHub reader** with repositories, branches, issues and pull requests held in memory;
  - a **fake clock** that the heartbeat timers, Dry-run delays and session expiry read.
- **Host Agent tests** run the real Host Agent against a fake Docker client and a fake Gateway.
- Pure logic in `packages/core` has plain unit tests.
- Tests use a real Postgres (a container in CI), reset per test file. No mocks of the database.
- Each acceptance test in a spec names the check it covers (A1–A7) or the requirement ids.

### Slices

Each spec ends with a slice list. A slice is one pull request: one agent session in its own worktree, tests first, under about 400 changed lines, merged into `main` the same day. Slice ids (`M1-05`) are used in branch names (`feat/m1-05-start-dialog`) and pull request titles. Slices with no dependency between them run in parallel.

### Naming

Use the words in [CONTEXT.md](../../CONTEXT.md) in code, UI and tests: `Member` not `user`, `Node` not `task` or `step`, `Attempt` not `execution`, `Output` not `artifact`.

### Definition of done for every slice

- Tests for the behaviour it adds, passing in CI with lint and type check.
- No secret in code, logs or fixtures; new configuration documented in `.env.example`.
- Every Member action it adds writes an audit entry once the audit log exists (M0).
- UI text matches the screens table in the requirements (section 4.8).
