# Deploying Clauderon

The web app, the Gateway and Postgres run as one Docker Compose stack on one always-on host. A Cloudflare Tunnel, run by the stack's `cloudflared` container, publishes the web app and the Gateway to the internet with HTTPS; it connects out, so the host opens no port. Google sign-in and the email allowlist are the only gate. Runs do not execute here: each Member pairs their own computer, their Machine, whose Agent connects out to the Gateway. Why: [ADR 0005](../docs/adr/0005-self-host-the-app-on-the-pod-host.md), [ADR 0006](../docs/adr/0006-each-member-runs-on-their-own-machine.md).

```
Member's browser ──https──▶ WEB_HOSTNAME     ──▶ Cloudflare ══tunnel══▶ cloudflared ──▶ web:3000
Member's browser ──wss────▶ GATEWAY_HOSTNAME ──▶ Cloudflare ══tunnel══▶ cloudflared ──▶ gateway:4000
Member's Agent   ──wss────▶ GATEWAY_HOSTNAME ──▶ (same; /agent, /pair)
cloudflared opens the tunnel outbound; web, gateway ──▶ postgres (container only, never published)
```

All commands run from the repository root on the host.

## Quick deploy

Once the machine is prepared (sections 1 and 2), one command does sections 3 to 5 and checks the result:

```sh
deploy/deploy.sh           # first run creates deploy/.env.production with secrets, then lists what to fill in
cloudflared tunnel login   # once: opens the browser, pick the domain
deploy/deploy.sh tunnel    # once: creates the tunnel and both DNS records, saves the token
deploy/deploy.sh           # build, migrate, start with the tunnel, check the public URLs
deploy/deploy.sh status    # what runs and the URL
deploy/deploy.sh down      # stop the stack and the tunnel; the database is kept
```

It is safe to run again after `git pull`. It stops with a clear message when Docker is not running or a setting is missing. Backups (section 7) are installed once by hand; the script says so when they are missing.

## 1. Prepare the machine (once)

- A dedicated, always-on Mac (16 GB RAM is enough for six Members) with its own macOS account for Clauderon, so the stack does not share a session with anyone's personal data.
- That account logs in automatically after a restart (System Settings → Users & Groups → Automatic login; FileVault must be off for this) because Docker Desktop only runs inside a logged-in session.
- The machine never sleeps (System Settings → Energy: prevent automatic sleeping; or `sudo pmset -a sleep 0 disablesleep 1`).
- Docker Desktop set to start at login. Docker Desktop is free only for companies under 250 employees and US$10M revenue; above that, use Colima or OrbStack.
- `git clone` of this repository.
- `cloudflared` (`brew install cloudflared`), only to create the tunnel; the stack runs its own `cloudflared` container.

## 2. Outside accounts (once)

- **A domain on Cloudflare** (the free plan is enough): its DNS must be served by Cloudflare. Pick two hostnames one level under it, e.g. `clauderon.example.com` for the web app and `clauderon-gateway.example.com` for the Gateway; deeper names such as `gw.clauderon.example.com` are not covered by Cloudflare's free certificate.
- **Google OAuth client** (type Web application). Members sign in with personal Gmail accounts, so the consent screen's audience is **External**; request only `openid`, `email` and `profile`, then **Publish app** so its status is In production. These non-sensitive scopes need no Google verification, and no test-user list has to be kept: the app's allowlist decides who gets in. Authorized redirect URI: `https://<WEB_HOSTNAME>/api/auth/callback/google`.
- **GitHub token**: a fine-grained, read-only token for the team's repositories.

## 3. Configure

```sh
cp deploy/.env.production.example deploy/.env.production
chmod 600 deploy/.env.production
openssl rand -base64 32   # once each for POSTGRES_PASSWORD, SESSION_SECRET
```

`deploy/deploy.sh` does this on its first run. Fill in every value. `deploy/.env.production` is git-ignored and must never be committed.

| Variable | Used by | Value |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | postgres, migrate, web, gateway | Random secret |
| `SESSION_SECRET` | web, gateway | Random secret; rotating it signs everyone out |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | web | From the OAuth client |
| `WEB_HOSTNAME` | web (`AUTH_URL` = `https://<WEB_HOSTNAME>`), gateway, cloudflared | e.g. `clauderon.example.com` |
| `GATEWAY_HOSTNAME` | web (`GATEWAY_URL` = `wss://<GATEWAY_HOSTNAME>` for browsers and Agents), cloudflared | e.g. `clauderon-gateway.example.com` |
| `CLOUDFLARE_TUNNEL_TOKEN` | cloudflared | Filled in by `deploy/deploy.sh tunnel` |
| `OPERATOR_EMAILS` | web, gateway | Comma-separated Operator emails |
| `WEB_HOST_PORT`, `GATEWAY_HOST_PORT` | compose | Ports on 127.0.0.1 for checks on the host, default 3000 and 4000 |

## 4. Start the stack

```sh
docker compose -f deploy/compose.yml --env-file deploy/.env.production up -d --build
docker compose -f deploy/compose.yml --env-file deploy/.env.production ps
```

Compose runs migrations first, then the Gateway, then the web app once the Gateway is healthy, then `cloudflared`. Every service restarts on its own after a crash or a reboot.

## 5. Publish with a Cloudflare Tunnel

```sh
cloudflared tunnel login     # pick the domain; saves ~/.cloudflared/cert.pem
deploy/deploy.sh tunnel
```

This creates a locally managed tunnel named `clauderon` (`TUNNEL_NAME` changes it), adds a proxied CNAME for `WEB_HOSTNAME` and `GATEWAY_HOSTNAME` pointing at it, and writes the tunnel's token into `deploy/.env.production`. It never overwrites an existing DNS record. The routes live in `deploy/compose.yml` (`configs.cloudflared`): `WEB_HOSTNAME` → `web:3000`, `GATEWAY_HOSTNAME` → `gateway:4000`, anything else → 404. Do not add Cloudflare Access in front: the Agent's WebSocket could not pass it (ADR 0006).

### Moving from Tailscale Serve

The URLs change, so: add the new redirect URI to the Google OAuth client, set `WEB_HOSTNAME`, `GATEWAY_HOSTNAME` and the token, delete `PUBLIC_URL` and `PUBLIC_GATEWAY_URL` from the env file, run `deploy/deploy.sh`, then `tailscale serve reset` to stop the old routes. Every Member runs the install command from the Machines page again, since their Agent still points at the old address.

## 6. Members pair their Machines

Nothing to install on the host. Each Member copies the one line the Machines page shows into a terminal on their own computer (it needs git and gh; on Windows, Git for Windows for Git Bash):

```sh
curl -fsSL https://<WEB_HOSTNAME>/agent/install.sh | sh        # macOS, Linux
irm https://<WEB_HOSTNAME>/agent/install.ps1 | iex             # Windows PowerShell
```

It installs into `~/.clauderon` only, with no sudo: the Agent's own Node 22 from nodejs.org and the Agent bundle the web app serves (`/agent/agent.mjs`, built into the web image), both checked against their SHA-256. When git or gh is missing it stops and prints the command that installs it on that OS. It logs in to GitHub if needed, offers to log in to Claude Code, opens the browser on the Approve page (or keeps a pairing that still works), installs a launchd agent, systemd user unit or per-user Run key (Windows; no administrator needed) that runs the Agent whenever the Member is logged in (log: `~/.clauderon/agent.log`), and ends with the doctor, whose report also shows on the Machine page. Running it again repairs the install and replaces an old one (a `~/.clauderon/app` clone). Bundled Agents update themselves to the web app's bundle after each deploy. Why: [ADR 0007](../docs/adr/0007-the-agent-ships-as-one-bundle-with-its-own-node.md).

On the computer: `~/.clauderon/node/bin/node ~/.clauderon/agent/agent.mjs doctor` checks it again; `… uninstall-service` stops the Agent.

By hand, from a clone: `pnpm --filter @clauderon/host-agent pair https://<WEB_HOSTNAME>`, which pairs and then runs the Agent in that terminal.

Moving from Pods: deploying this interrupts every open Run, and the old Pods are no longer used. On a host that ran the Host Agent, remove it with `sudo launchctl bootout system/com.clauderon.host-agent` on macOS or `sudo systemctl disable --now clauderon-host-agent` on Linux, then delete the `clauderon-pod-*` containers and `clauderon-ws-*` volumes once nobody needs their Workspaces.

## 7. Backups

```sh
deploy/backup.sh install
```

This adds a launchd agent that dumps Postgres every day at 03:00 and keeps 14 days in `deploy/backups/`. Take one by hand with `deploy/backup.sh`.

By default the dumps stay on this Mac, so a broken disk or a lost machine loses the database and its backups together. To keep a copy elsewhere, install with `BACKUP_DIR` pointing at a synced folder or an external disk, for example `BACKUP_DIR="$HOME/Google Drive/clauderon-backups" deploy/backup.sh install`.

To restore (stops web and Gateway, replaces the database, starts them again):

```sh
deploy/backup.sh restore <path to clauderon-….dump>
```

Log chunks older than 90 days are deleted by the Gateway every day; Runs, Outputs and Artifacts are kept.

## Demo on Render

For trying Clauderon without a host, [`render.yaml`](../render.yaml) at the repo root is a Render Blueprint: a free Postgres, the Gateway and the web app, in Singapore, deployed from `main` on every push. It is a demo only: free web services sleep after 15 minutes without traffic and take about a minute to wake (an Agent's socket drops and reconnects, and a Run in progress can fail), the free database expires after 30 days with its data, and a workspace's 750 free instance hours a month do not cover two services running all month.

1. In the Render dashboard: **New → Blueprint**, connect the GitHub repository, pick `main`. Render asks for the values marked `sync: false`: `OPERATOR_EMAILS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Leave `WEB_URL`, `AUTH_URL` and `GATEWAY_URL` empty for now.
2. When both services are created, note their URLs (`https://clauderon-web….onrender.com`, `https://clauderon-gateway….onrender.com`), then set:
   - on `clauderon-gateway`: `WEB_URL` = the web URL;
   - on `clauderon-web`: `AUTH_URL` = the web URL, and `GATEWAY_URL` = the Gateway URL with `wss://` instead of `https://`.

   Save with **Save, rebuild and deploy**. Without `AUTH_URL` the install command and pairing links point at `https://localhost:10000`, the address the app sees behind Render's proxy.
3. Add `https://<web URL host>/api/auth/callback/google` to the Google OAuth client's redirect URIs.
4. Check `https://<gateway URL host>/health` answers `{"ok":true}`, sign in on the web URL, and pair Machines from its Machines page.

The Gateway runs migrations before it starts (`pnpm start:gateway`), since free services have no pre-deploy step. A custom domain can be added to each service later; Agents paired before that must run the installer again.

## Updating

```sh
git pull --rebase
pnpm install
docker compose -f deploy/compose.yml --env-file deploy/.env.production up -d --build
```

Migrations run before the new Gateway starts. A Gateway restart is a short drop: Runs keep going if each Agent reconnects within 30 seconds. After changes to `apps/host-agent`, Members pull and restart their Agent.

The sidebar shows the release tag from `APP_VERSION`. `deploy/deploy.sh` sets it from the latest tag in this clone (`git fetch --tags` first); the plain `docker compose … up` above shows no version unless you export it, e.g. `APP_VERSION=$(git describe --tags --abbrev=0) docker compose …`.

## Rotating secrets

- `SESSION_SECRET`: edit the env file and run `up -d`; everyone signs in again.
- `POSTGRES_PASSWORD`: change it in Postgres first (`docker compose … exec postgres psql -U clauderon -c "alter user clauderon password '…'"`), then in the env file, then `up -d`.
- `GOOGLE_CLIENT_SECRET`: replace the value and run `up -d`.
- The GitHub token: an Operator replaces it on the Projects page; nothing restarts. After changing `SESSION_SECRET`, save it there again.

## Troubleshooting

- `docker compose -f deploy/compose.yml --env-file deploy/.env.production logs -f gateway web`
- Agent logs: `~/.clauderon/agent.log` when it runs as a service, else the terminal where the Member runs it. An Agent that prints that the Gateway no longer accepts it was unpaired or paired on another computer: pair again.
- Sign-in fails with a redirect error: the OAuth redirect URI must be exactly `https://<WEB_HOSTNAME>/api/auth/callback/google`.
- The public URL gives a Cloudflare error (1033, 502): `docker compose … logs cloudflared`; the tunnel must show registered connections, and both hostnames must be CNAMEs to `<tunnel id>.cfargotunnel.com` (`cloudflared tunnel info clauderon`).
- Live logs or Agents do not connect: `https://<GATEWAY_HOSTNAME>/health` must answer `{"ok":true}`.
