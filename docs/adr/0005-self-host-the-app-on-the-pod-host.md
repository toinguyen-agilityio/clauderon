# The whole app is self-hosted on the Pod Host and reached over Tailscale

Supersedes the hosting part of [ADR 0004](0004-web-app-on-vercel-with-an-always-on-gateway.md); the split into a web app and an always-on Gateway stays.

The team wants to use Clauderon without paying for hosting, and the Pod Host is already a machine that must stay on and run Docker. So the web app, the Gateway and Postgres run there as one Docker Compose stack (`deploy/compose.yml`), next to the Host Agent and the Pods. Web and Gateway listen on localhost only; Tailscale Serve publishes them to the team's tailnet with HTTPS (the web app on port 443, the Gateway's WebSockets on 8443). Members join the tailnet to reach the app; Google sign-in and the email allowlist still decide who gets in. Postgres is never published, and the Host Agent reaches the Gateway on localhost.

## Considered Options

- **Vercel and Railway (ADR 0004)**: managed, preview deploys, the Gateway apart from the Pod Host. Costs money once the free tiers run out, and Vercel's free plan is not meant for team use.
- **Web app on Vercel, Gateway on the Pod Host, Postgres on a free managed service (Neon)**: keeps preview deploys, but Vercel must reach the database over the internet and the Gateway's LISTEN/NOTIFY needs a direct, unpooled connection. Two outside services for little gain.
- **A Cloudflare Tunnel instead of Tailscale**: a public URL with no client to install, but needs a domain on Cloudflare and puts the sign-in page on the internet.

## Consequences

- One machine runs everything: when the Pod Host is off, asleep or offline, nobody can use Clauderon. This adds little risk, since without the Pod Host no Run can execute anyway (ADR 0003).
- Backups are ours: `deploy/backup.sh` dumps Postgres daily and keeps 14 days. For now the dumps stay on the Pod Host, so losing that machine loses the database and its backups together; syncing them elsewhere is one setting away (`BACKUP_DIR`).
- A Gateway restart or deploy is still a short drop that the Host Agent survives within 30 seconds (RUN-12). A web deploy no longer comes with preview deploys.
- Every Member installs Tailscale and joins a tailnet owned by one admin's Gmail; the Pod Host is a tagged device, so the free plan's six user seats are left for Members.
- Accepted risk: Tailscale's free plan is meant for non-commercial use, and this is a company team. If that becomes a problem, the way out is Tailscale's paid plan (about US$8 per user per month in 2026) or the company VPN with an internal DNS name and certificate from IT; neither changes the stack.
- Accepted risk: Docker Desktop is free only for companies under 250 employees and US$10M revenue; Colima or OrbStack replace it without other changes.
- Members sign in with personal Gmail accounts, so the Google OAuth client is External and published with only `openid`, `email` and `profile`; the allowlist is the only gate.
- The Pod Host is a dedicated Mac with its own macOS account that logs in automatically, because Docker Desktop runs only in a logged-in session.
- The app shares the Pod Host's CPU and memory with the Pods, so `POD_LIMIT_CEILING` must leave room for the stack.
- A staging stack can run later on the same machine as a second Compose project with its own ports, secrets and Host Agent.
