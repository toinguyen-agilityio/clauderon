# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Clauderon

A shared web app for one team: pick GitHub issues (Tickets), run them through a Flow (a typed DAG of agent / shell / human Nodes) on each Member's own paired computer (Machine), and track the resulting Runs. Domain terms (Machine, Agent, Pairing, Gateway, Flow, Node, Run, Starter…) are defined in `CONTEXT.md`; use them exactly. Decisions are in `docs/adr/`, scope in `docs/requirements/v1-requirements.md`, per-milestone specs (M0–M4) in `docs/specs/`.

## Commands

pnpm workspace + Turborepo, Node >= 22, pnpm 10. Run from the repo root:

```sh
pnpm install
pnpm db:up                 # local Postgres 16 on port 54329 (docker compose)
pnpm db:migrate            # apply Drizzle migrations; `pnpm db:seed` also seeds
pnpm dev                   # web (Next.js) and gateway in watch mode
pnpm --filter @clauderon/host-agent pair http://localhost:3000  # pair this computer as your Machine and run the Agent
pnpm lint | typecheck | test | build
```

Tests are Vitest and need `TEST_DATABASE_URL` (copy `.env.example` to `.env`; each test file creates and drops its own database, so the Postgres server from `db:up` is enough). CI runs lint, typecheck and test only.

```sh
pnpm --filter @clauderon/gateway test                       # one package
pnpm --filter @clauderon/core exec vitest run src/flow      # one file or name filter
pnpm --filter @clauderon/db generate                        # new migration after editing schema.ts
```

## Architecture

Three deployables and four internal packages, all TypeScript ESM. Packages export source (`./src/index.ts`), with no build step. Web, Gateway and Postgres are self-hosted as one Docker Compose stack behind Tailscale (ADR 0005, `deploy/README.md`); each Member runs the Agent on their own Machine (ADR 0006).

- `apps/web`: Next.js UI and ordinary API, Auth.js with Google sign-in. Everything needing a long-lived connection is delegated to the Gateway.
- `apps/gateway`: always-on Node service. Holds one WebSocket per paired Machine (token auth, `/agent`), serves Pairing (`/pair`) and the browser sockets, watches the heartbeats and runs the **Run engine** (`run-engine.ts`), which executes a Flow's Nodes one at a time. Web and Gateway share one Postgres and talk through DB command rows (`packages/db/src/gateway-commands.ts`).
- `apps/host-agent`: the Agent on a Member's Machine. `pair` gets a code the Member approves on the Machines page (installed in one line from `/agent/install.sh`, run as a user service by `install-service`); `run` connects **out** to the Gateway (no inbound ports) and runs Nodes as local processes in bash (Git Bash on Windows), each Run in a worktree under `~/.clauderon`, behind the `System` seam (`src/system.ts`). Runs `claude -p` under the Member's own login.
- `packages/protocol`: zod schemas for the Gateway ⇄ Agent, Pairing and Gateway ⇄ browser messages. This is the contract between the deploy targets, so change it carefully.
- `packages/core`: pure domain logic with no I/O (Flow typing and validation, Run state, Ticket Status, runner/simulation for Dry-run, limits, secret `mask`).
- `packages/db`: Drizzle schema, migrations and per-feature query modules; `@clauderon/db/testing` provides the per-test database helper.
- `packages/testing`: shared fixtures for the other packages' tests.

Rules that shape the code (details in the ADRs):
- A Flow is a DAG with typed edges, no cycles; a failed Node fails the Run and a person retries (ADR 0002).
- Everything that writes to GitHub happens on the Starter's Machine under their own `gh` login; the app holds only a read-only token (ADR 0001).
- Each Run executes on its Starter's Machine, under that Member's own Claude Code login. Never read, store or forward Claude/OAuth tokens; the Agent only checks login status (`apps/host-agent/src/logins.ts`). A Machine token is stored only as its SHA-256 hash.
- No secrets in the database; configuration comes from the environment (NFR-1). Mask known token patterns before any log line is stored or streamed.
- Web and Gateway restart separately, so protocol and schema changes must stay compatible with both.

## Next.js

`apps/web/AGENTS.md` warns that this Next.js version has breaking changes from older releases. Read the relevant guide in `node_modules/next/dist/docs/` before writing web code.

## Agent skills

### Issue tracker

GitHub Issues in `toinguyen-agilityio/clauderon`, via the `gh` CLI; milestone issues hold tickets as sub-issues with native blocked-by links. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
