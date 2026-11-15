# Clauderon

A shared web app for one team to run GitHub issues through Flows on each Member's Pod, and to track the resulting Runs and their outputs.

Start with [docs/overview.md](docs/overview.md). The words used in code and UI are defined in [CONTEXT.md](CONTEXT.md).

## What is in the repo

| Path | What it is |
| --- | --- |
| `packages/core` | The app core: Flow validator, Slots and queue per Pod, Run engine, Dry-run runner, Ticket Status. Plain TypeScript, state in memory, tested with a fake clock |
| `apps/web` | Next.js app. For now it has one screen: the Flow editor at `/flows`, with Flows kept in the browser's memory |
| `images/pod` | Dockerfile of the standard Pod image |
| `docs` | Requirements, ADRs, spec questions and the UI prototype |

Not built yet: sign-in, database, the Host Agent, the real runner (Claude Code in a Pod), the web terminal, GitHub Sync.

## Run it

Needs Node 22 and pnpm 10.

```sh
pnpm install
pnpm test        # core tests
pnpm typecheck
pnpm dev         # Flow editor on http://localhost:3000/flows
```

Build the Pod image:

```sh
docker build -t clauderon-pod images/pod
```
