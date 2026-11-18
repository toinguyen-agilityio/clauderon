# Deploying Clauderon on the Pod Host

The web app, the Gateway and Postgres run as one Docker Compose stack on the Pod Host, next to the Host Agent and the Pods. Tailscale Serve publishes the web app and the Gateway to the team's tailnet with HTTPS. Why: [ADR 0005](../docs/adr/0005-self-host-the-app-on-the-pod-host.md).

```
Member ──https──▶ <host>.ts.net:443  ─▶ web      127.0.0.1:3000
Member ──wss────▶ <host>.ts.net:8443 ─▶ gateway  127.0.0.1:4000
Host Agent (launchd/systemd) ──ws://127.0.0.1:4000──▶ gateway
web, gateway ──▶ postgres (container only, never published)
```

All commands run from the repository root on the Pod Host.

## 1. Prepare the machine (once)

- A dedicated, always-on Mac (16 GB RAM is enough for six Members) with its own macOS account for Clauderon, so the stack does not share a session with anyone's personal data.
- That account logs in automatically after a restart (System Settings → Users & Groups → Automatic login; FileVault must be off for this) because Docker Desktop only runs inside a logged-in session.
- The machine never sleeps (System Settings → Energy: prevent automatic sleeping; or `sudo pmset -a sleep 0 disablesleep 1`).
- Docker Desktop set to start at login. Docker Desktop is free only for companies under 250 employees and US$10M revenue; above that, use Colima or OrbStack.
- Node 22 and pnpm 10, `git clone` of this repository, then `pnpm install` (the Host Agent runs from this checkout).
- Tailscale, in a tailnet owned by the admin's Gmail account:
  - In the admin console, enable MagicDNS and HTTPS certificates.
  - In the access controls, add `"tagOwners": {"tag:pod-host": ["autogroup:admin"]}`, then on this Mac run `sudo tailscale up --advertise-tags=tag:pod-host`. A tagged device does not take a user seat, so the free plan's six seats stay for Members.
  - Invite every Member's Gmail. Each installs Tailscale and signs in.
  - The free plan is meant for non-commercial use (see ADR 0005). If a Member's company VPN breaks Tailscale routes, check `tailscale status` and the VPN's split-tunnel settings.

## 2. Outside accounts (once)

- **Google OAuth client** (type Web application). Members sign in with personal Gmail accounts, so the consent screen's audience is **External**; request only `openid`, `email` and `profile`, then **Publish app** so its status is In production. These non-sensitive scopes need no Google verification, and no test-user list has to be kept: the app's allowlist decides who gets in. Authorized redirect URI: `https://<host>.<tailnet>.ts.net/api/auth/callback/google`. Find the host name with `tailscale status --self` or in the admin console.
- **GitHub token**: a fine-grained, read-only token for the team's repositories.
- **Pod image**: build it here with `docker build -t clauderon-pod:local images/pod`, or use a tag the Pod image workflow published to GHCR.

## 3. Configure

```sh
cp deploy/.env.production.example deploy/.env.production
chmod 600 deploy/.env.production
openssl rand -base64 32   # once each for POSTGRES_PASSWORD, SESSION_SECRET, HOST_AGENT_SECRET
```

Fill in every value. `deploy/.env.production` is git-ignored and must never be committed.

| Variable | Used by | Value |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | postgres, migrate, web, gateway | Random secret |
| `SESSION_SECRET` | web, gateway | Random secret; rotating it signs everyone out |
| `HOST_AGENT_SECRET` | gateway, Host Agent | Random secret; the Host Agent gets the same value |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | web | From the OAuth client |
| `PUBLIC_URL` | web (`AUTH_URL`) | `https://<host>.<tailnet>.ts.net` |
| `PUBLIC_GATEWAY_URL` | web (`GATEWAY_URL` for browsers) | `wss://<host>.<tailnet>.ts.net:8443` |
| `OPERATOR_EMAILS` | web, gateway | Comma-separated Operator emails |
| `GITHUB_TOKEN` | web, gateway | Read-only token |
| `POD_IMAGE` | web, gateway | `clauderon-pod:local` or a GHCR tag |
| `WEB_HOST_PORT`, `GATEWAY_HOST_PORT` | compose | Ports on 127.0.0.1, default 3000 and 4000 |
| `POD_LIMIT_CEILING` | web | Max Slots, CPU and RAM per Pod; leave room for the stack |

## 4. Start the stack

```sh
docker compose -f deploy/compose.yml --env-file deploy/.env.production up -d --build
docker compose -f deploy/compose.yml --env-file deploy/.env.production ps
```

Compose runs migrations first, then the Gateway, then the web app once the Gateway is healthy. Every service restarts on its own after a crash or a reboot.

## 5. Publish with Tailscale Serve

```sh
tailscale serve --bg --https=443 http://127.0.0.1:3000    # WEB_HOST_PORT
tailscale serve --bg --https=8443 http://127.0.0.1:4000   # GATEWAY_HOST_PORT
tailscale serve status
```

Serve only reaches devices in the tailnet; do not use `tailscale funnel`, which would put the app on the internet.

## 6. Install the Host Agent

```sh
sudo GATEWAY_URL=ws://127.0.0.1:4000 HOST_AGENT_SECRET=<same value as in deploy/.env.production> \
  scripts/install-host-agent.sh
```

Use `GATEWAY_HOST_PORT` in place of 4000 if you changed it. Check it connected: `curl -s http://127.0.0.1:4000/health` shows `"hostAgentConnected":true`.

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

## Updating

```sh
git pull --rebase
pnpm install
docker compose -f deploy/compose.yml --env-file deploy/.env.production up -d --build
```

Migrations run before the new Gateway starts. A Gateway restart is a short drop: Runs keep going if the Host Agent reconnects within 30 seconds. After changes to `apps/host-agent`, restart the Host Agent service (`sudo launchctl kickstart -k system/com.clauderon.host-agent` on macOS, `sudo systemctl restart clauderon-host-agent` on Linux).

## Rotating secrets

- `SESSION_SECRET`: edit the env file and run `up -d`; everyone signs in again.
- `HOST_AGENT_SECRET`: edit the env file, run `up -d`, then run the Host Agent install script again with the new value.
- `POSTGRES_PASSWORD`: change it in Postgres first (`docker compose … exec postgres psql -U clauderon -c "alter user clauderon password '…'"`), then in the env file, then `up -d`.
- `GOOGLE_CLIENT_SECRET`, `GITHUB_TOKEN`: replace the value and run `up -d`.

## Troubleshooting

- `docker compose -f deploy/compose.yml --env-file deploy/.env.production logs -f gateway web`
- Host Agent logs: `/var/log/clauderon/` on macOS, `journalctl -u clauderon-host-agent` on Linux.
- Sign-in fails with a redirect error: the OAuth redirect URI must match `PUBLIC_URL` exactly.
- Terminals do not connect: `PUBLIC_GATEWAY_URL` must be `wss://…:8443` and `tailscale serve status` must list port 8443.
