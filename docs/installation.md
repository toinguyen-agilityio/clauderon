# Installation guide

How to run Clauderon on your own computer for development: the web app, the Gateway, a local Postgres, and your computer paired as a Machine. For production, see the [deployment guide](deployment.md). Terms in capitals (Member, Machine, Agent, Flow, Run…) are defined in [CONTEXT.md](../CONTEXT.md).

## Prerequisites

To develop the app:

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22 or later | `engines.node` in `package.json` |
| pnpm | 10 (`pnpm@10.18.3`) | `corepack enable` picks the pinned version from `packageManager` |
| Docker | any recent | Runs the local Postgres 16 (`docker-compose.yml`) |
| Google OAuth client | type *Web application* | For sign-in; redirect URI `http://localhost:3000/api/auth/callback/google` |
| GitHub token (optional) | fine-grained, read-only | Saved by an Operator on the Projects page to read issues; not an environment variable |

To pair a Machine and run real Runs (on the computer that runs the Agent):

- git and the GitHub CLI (`gh`), logged in (`gh auth login`)
- Claude Code (`claude`), logged in with the Member's own account
- git `user.name` and `user.email` set (the Doctor warns otherwise)
- On Windows: Git for Windows, for Git Bash

## Install

```bash
git clone https://github.com/toinguyen-agilityio/clauderon.git
```

```bash
cd clauderon && corepack enable && pnpm install
```

## Configure

```bash
cp .env.example .env
```

Fill in at least `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` and `OPERATOR_EMAILS` (put your own Google email there, so you can sign in and manage the allowlist). Generate the session secret with:

```bash
openssl rand -base64 32
```

Every variable is described in [environment-variables.md](environment-variables.md). `.env` is git-ignored; never commit it.

## Start the database

```bash
pnpm db:up
```

This starts the `postgres:16` container of the `clauderon-dev` Compose project on `localhost:54329` (user, password and database are all `clauderon`). It is for development and tests only.

The database scripts read `DATABASE_URL` from the shell, not from `.env`, so export the file first. `db:seed` applies the migrations and then seeds the sample Nodes and Flows; `db:migrate` only applies migrations:

```bash
set -a && . ./.env && set +a && pnpm db:seed
```

## Run the app

```bash
pnpm dev
```

| Service | URL | Notes |
| --- | --- | --- |
| Web app | <http://localhost:3000> | `next dev`; `next.config.ts` loads the root `.env` |
| Gateway | `ws://localhost:4000` (health: <http://localhost:4000/health>) | `tsx watch --env-file-if-exists=../../.env` |

Sign in with a Google account listed in `OPERATOR_EMAILS`. To read real issues, open the Projects page and save a read-only GitHub token there.

## Pair your computer as a Machine

In a second terminal:

```bash
pnpm --filter @clauderon/host-agent pair http://localhost:3000
```

The Agent prints a pairing code and opens the Machines page, where you approve it. The Agent then keeps running in that terminal. To check the computer:

```bash
pnpm --filter @clauderon/host-agent start doctor
```

The Agent's commands are `pair <url>`, `run` (or `start`), `doctor`, `install-service`, `uninstall-service` and `help` (`apps/host-agent/src/main.ts`). From a clone, the Agent keeps its state in `~/.clauderon` unless `CLAUDERON_HOME` says otherwise.

The one-line installer on the Machines page (`/agent/install.sh`, `/agent/install.ps1`) needs a built bundle, `pnpm --filter @clauderon/host-agent build`. Under `next dev` it installs into `~/.clauderon-dev` (`AGENT_HOME_NAME`), so a development Agent and a production Agent can share one computer.

## Try a Flow

Enable a Project, **Sync** its Tickets, clone a sample Flow, and press **Test run** in the Flow editor first: it steps through every Node in the browser and never calls Claude or GitHub. Then select Tickets and start real Runs; each one runs on your Machine in a worktree under `~/.clauderon`.

## Build, check and test

Run from the repository root.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Web (Next.js) and Gateway in watch mode |
| `pnpm build` | Build every package that has a build (`next build`, the Agent bundle) |
| `pnpm lint` | ESLint in every package |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm test` | Vitest in every package (needs Postgres, see below) |
| `pnpm db:up` | Start the local Postgres on port 54329 |
| `pnpm db:migrate` | Apply Drizzle migrations (needs `DATABASE_URL` in the shell) |
| `pnpm db:seed` | Apply migrations, then seed the sample Nodes and Flows |
| `pnpm --filter @clauderon/db generate` | Generate a migration after editing `packages/db/src/schema.ts` |
| `pnpm --filter @clauderon/host-agent build` | Bundle the Agent into `apps/host-agent/dist` (`agent.mjs`, `agent.json`) |
| `pnpm --filter @clauderon/gateway test` | Tests of one package |
| `pnpm --filter @clauderon/core exec vitest run src/flow` | One test file or name filter |
| `pnpm features:build` | Regenerate `docs/features.json` from `packages/features/features.map.json` |
| `pnpm features:check` | Fail when `docs/features.json` is stale (CI runs it) |

To run the production builds locally after `pnpm build`: `pnpm --filter @clauderon/web start` and `pnpm --filter @clauderon/gateway start`.

**Tests** use a real Postgres, never mocks. Each test file creates and drops its own database on the server named by `TEST_DATABASE_URL`, so the container from `pnpm db:up` is enough. CI (`.github/workflows/ci.yml`, `agent.yml`) runs lint, typecheck and tests, plus the Agent's tests, its bundle build and an install smoke test (`apps/web/scripts/agent-smoke.ts`) on macOS, Linux and Windows.

## Next steps

- [Architecture](architecture.md) to find your way around the code
- [Troubleshooting](troubleshooting.md) when something does not start
- [CONTRIBUTING.md](../CONTRIBUTING.md) for branches, commits and pull requests
