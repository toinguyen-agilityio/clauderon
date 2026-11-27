# Troubleshooting guide

Common problems when setting up, running and deploying Clauderon, with the fix for each. Start with the **Doctor**: it checks a Machine and shows its report on the Machine page.

```bash
~/.clauderon/node/bin/node ~/.clauderon/agent/agent.mjs doctor
```

From a clone: `pnpm --filter @clauderon/host-agent start doctor`.

## Where to look

| What | Where |
| --- | --- |
| Agent (installed as a service) | `~/.clauderon/agent.log` |
| Agent (run from a terminal) | That terminal |
| Web app and Gateway (local) | The `pnpm dev` terminal |
| Render | Each service's Logs tab in the Render dashboard |
| Self-hosted stack | `docker compose -f deploy/compose.yml --env-file deploy/.env.production logs -f gateway web` |
| A Run | The Run page: live log per Node, Node inspector, failure reason |
| Who did what | The Audit page |

## Local setup

| Symptom | Cause | Fix |
| --- | --- | --- |
| `pnpm db:migrate` or `pnpm db:seed` cannot connect, or connects to the wrong database | The `db:*` scripts read `DATABASE_URL` from the shell, not from `.env` | `set -a && . ./.env && set +a`, then run the script again |
| `pnpm db:up` fails: port 54329 already allocated | Another container or Postgres uses the port | Stop it, or change the port in `docker-compose.yml` and in `DATABASE_URL` / `TEST_DATABASE_URL` |
| `pnpm db:up` fails: cannot connect to the Docker daemon | Docker is not running | Start Docker Desktop (or Colima / OrbStack) |
| `pnpm install` picks the wrong pnpm | Corepack is off | `corepack enable` (the version is pinned in `package.json`) |
| Tests fail with connection errors | Postgres is down or `TEST_DATABASE_URL` is unset | `pnpm db:up` and set `TEST_DATABASE_URL` in `.env` (each test file creates and drops its own database) |
| CI fails on `features:check` | `docs/features.json` is stale | Edit `packages/features/features.map.json` if needed, then `pnpm features:build` and commit the result |

## Sign-in

| Symptom | Cause | Fix |
| --- | --- | --- |
| Google shows `redirect_uri_mismatch` | The redirect URI is not registered | Add exactly `<AUTH_URL>/api/auth/callback/google` to the OAuth client |
| Signed in but sent to the access-denied page | The email is not allowed | Add it on the allowlist page (an Operator), or to `OPERATOR_EMAILS` |
| Everyone is signed out at once | `SESSION_SECRET` changed | Expected. An Operator also saves the GitHub token again on the Projects page |
| Pages ask to sign in again while a Run page is open | The session was ended or revoked; the browser's Gateway socket gets `401` from `/api/gateway-ticket` | Sign in again. If it keeps happening in production, check the web and Gateway logs at that time |

## GitHub and Tickets

| Symptom | Cause | Fix |
| --- | --- | --- |
| Tickets page cannot read GitHub | No GitHub token saved, or it expired | An Operator saves a fine-grained, read-only token on the Projects page |
| A Project's Sync shows an error | GitHub's answer is stored in `project.sync_error` and shown on the page | Check the token can read that repository |
| Start says "Claude Code is not logged in on your Machine" or "gh is not logged in" | The Agent reported the login missing | On that computer: `claude` (log in) and `gh auth login`, then check the logins again from the Machine page |
| Start says "You have no paired Machine yet." | No Machine for this Member | Install and pair from the Machines page |

## Machines and the Agent

| Symptom or Doctor check | Cause | Fix |
| --- | --- | --- |
| Installer stops: git or gh missing | Required tools are not installed | Run the install command it prints, then the installer again |
| `/agent/agent.mjs` or `/agent/agent.json` returns 404 "the Agent bundle is not built" | The web app has no bundle | `pnpm --filter @clauderon/host-agent build` (production images build it), or set `AGENT_BUNDLE_DIR` |
| Install command and pairing links point at `https://localhost:10000` | `AUTH_URL` is not set behind Render's proxy | Set `AUTH_URL` on `clauderon-web` to its public `https://` URL and redeploy |
| Pairing code expired | Codes live 10 minutes | Run `pair` or the installer again |
| `POST /pair` answers 503 "too many pending pairings" | Too many codes waiting for approval | Approve or wait for the pending ones to expire, then try again |
| Agent prints that the Gateway no longer accepts it; Doctor "Pairing: the Gateway no longer accepts this computer" | The Machine was removed or paired on another computer | Run the install command from the Machines page again |
| Doctor "Gateway" fails | The Gateway is unreachable | Check `https://<gateway host>/health`; on Render the Gateway may be waking from sleep (about a minute) |
| Doctor "Runs at login" warns | No user service; the Agent stops when the terminal closes | Run the installer, or `agent.mjs install-service` |
| Doctor "git name and email" warns | Commits need `user.name` and `user.email` | `git config --global user.name "…"` and `git config --global user.email "…"` |
| Doctor "Clock" warns | The computer's clock is off the Gateway's | Turn on automatic time sync |
| Doctor "Free disk" warns | Low free disk | Free up space; each Run's worktree lives under `~/.clauderon` |
| Doctor "bash" / "Git Bash" fails | bash could not start | Install Git for Windows, or set `CLAUDERON_BASH` to a working bash |
| A tool works in your terminal but a Node cannot find it | PATH differs | The Agent uses your login shell's PATH (`tool-path.ts`); put the tool's PATH in your login profile, then restart the Agent |
| Agent stays on an old version | Self-update is off or has not reconnected | Unset `CLAUDERON_NO_UPDATE`, or press **Update agent** on the Machine page |

## Runs

| Symptom | Cause | Fix |
| --- | --- | --- |
| Run stays `queued` | The Machine is offline or all its Slots are busy | Start the Agent; raise the Slots on the Machine page; check older Runs |
| Run becomes `interrupted` | No heartbeat from the Machine for 30 seconds (sleep, network, Agent stopped, Gateway asleep on Render) | Bring the Machine back, then **Retry** from the Node you choose |
| Run `failed` | A Node failed or an Approve was rejected; no automatic retries | Read the failure reason and the Node's log, fix the cause, then **Retry** from a Node |
| Run is `waiting_for_human` | An Approve, Grill or turn-limit request is open | Answer it from **Needs you** |
| A Ticket cannot start a new Run | It already has an active Run (only one per Ticket) | Finish, cancel or retry the existing Run |
| Agent step stops at its turn limit | The Node's `max_turns` was reached | Continue or Stop from **Needs you**; raise the limit on the Node if needed |
| Attachment download fails with 410 | `SESSION_SECRET` changed after the Run started | Start a new Run |
| Attached files rejected (413) | More than 25 MB together | Attach fewer or smaller files |

## Production

| Symptom | Cause | Fix |
| --- | --- | --- |
| First request takes about a minute | Render free services sleep after 15 minutes | Expected on the free plan ([#118](https://github.com/toinguyen-agilityio/clauderon/issues/118)) |
| Gateway deploy fails at start | A migration failed (`pnpm start:gateway` runs it first) | Read the Gateway's deploy logs; fix with a new migration ([database.md](database.md)) |
| Live logs or Agents do not connect | Wrong `GATEWAY_URL` or Gateway down | `GATEWAY_URL` must be the Gateway URL with `wss://`; `/health` must answer `{"ok":true}` |
| Self-hosted: Cloudflare error 1033 or 502 | Tunnel not connected or DNS wrong | `docker compose … logs cloudflared`; `cloudflared tunnel info clauderon` ([deploy/README.md](../deploy/README.md#troubleshooting)) |

## Still stuck

Collect the Doctor report, the Agent log around the time of the problem and the Run id, then file a bug in [GitHub Issues](https://github.com/toinguyen-agilityio/clauderon/issues) (Problem, Acceptance Criteria, How to reproduce). Never paste tokens or `.env` contents; the app masks known token patterns in its own logs, but your terminal output is not masked.
