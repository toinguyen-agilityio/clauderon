# The web app runs on Vercel, with an always-on Gateway for long-lived connections

> **Hosting superseded by [ADR 0005](0005-self-host-the-app-on-the-pod-host.md)** (2026-11-18): the web app, Gateway and Postgres now run on the Pod Host. The split into a web app and an always-on Gateway below still holds.

The team wants Next.js on Vercel for the web app, but Vercel runs functions that live seconds to minutes, cannot hold a connection open and has no process running in the background. Clauderon needs exactly those things: the Host Agent keeps one WebSocket open to the app (ADR 0003), the web terminal streams through the app, a missing heartbeat must be noticed within 30 seconds (Vercel Cron runs at most once a minute), the app orchestrates each Run Node by Node, and removing an email from the allowlist must close open terminals and connections at once. So the app is split in two, in one monorepo: the **web app** (Next.js on Vercel) serves the UI and the ordinary API, and the **Gateway** (a small always-on Node service on Railway or Fly) holds the Host Agent link and the terminals, watches the heartbeat and runs the Run engine. Both use the same managed Postgres and the same protocol package.

## Considered Options

- **Next.js on Vercel alone**: one deploy target, but the Host Agent link, the terminal, the heartbeat and the Run engine cannot run there, so milestone M1 would fail at its first step (logging in through the terminal).
- **Next.js self-hosted on Railway or Fly, one process with a custom server**: one process does everything and there is one deploy target, but it gives up Vercel's preview deploys, and every deploy of the UI restarts the process that holds the Host Agent link.

## Consequences

- There are two deploy targets, which must agree on the protocol and the database schema (risk R10).
- Deploying the web app never drops the Host Agent link or a terminal. A Gateway restart or deploy is treated like a short network drop: Runs keep running if the Host Agent reconnects within 30 seconds (RUN-12).
- The allowlist is stored in the database rather than in a file, because neither Vercel nor a container platform gives the app a file it can edit without a redeploy.
