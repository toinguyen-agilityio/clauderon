# Deployment guide

Production runs on **Render** from the Blueprint [`render.yaml`](../render.yaml): a Postgres database, the Gateway and the web app, all in Singapore, deployed from `main` on every push. Merging a release pull request into `main` **is** the production deploy. The self-hosted Docker Compose stack behind a Cloudflare Tunnel is the alternative.

This page covers the release lifecycle. The step-by-step setup of each platform lives in [deploy/README.md](../deploy/README.md) and is not repeated here:

- [Production on Render](../deploy/README.md#production-on-render): first-time Blueprint setup
- [Self-hosted stack](../deploy/README.md#quick-deploy): `deploy/deploy.sh`, Cloudflare Tunnel, backups

Runs never execute on the servers: each Member's own Machine runs them ([ADR 0006](adr/0006-each-member-runs-on-their-own-machine.md)).

## Production prerequisites

- A Render account connected to the GitHub repository (Blueprint from `main`).
- A Google OAuth client (Web application, audience External, scopes `openid email profile`, published) with the redirect URI `https://<web host>/api/auth/callback/google`.
- A fine-grained, read-only GitHub token for the team's repositories, saved by an Operator on the Projects page after the first deploy.
- The Operator emails for `OPERATOR_EMAILS`.

## Environment configuration

| Service | Variables |
| --- | --- |
| `clauderon-gateway` | `SESSION_SECRET`, `OPERATOR_EMAILS` (shared group), `DATABASE_URL` (from the database), `GATEWAY_PORT=10000`, `WEB_URL` |
| `clauderon-web` | `SESSION_SECRET`, `OPERATOR_EMAILS` (shared group), `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_URL`, `GATEWAY_URL` (`wss://…`) |

Descriptions and defaults: [environment-variables.md](environment-variables.md). `SESSION_SECRET` must be the same on both services. Without `AUTH_URL` the install command and pairing links point at `https://localhost:10000`.

## How the build works

Both Render services build [`deploy/Dockerfile`](../deploy/Dockerfile) (its last stage, `web`), which installs the workspace with `pnpm install --frozen-lockfile`, builds the Agent bundle and runs `next build`. They differ only in the command:

| Service | Command | Health check |
| --- | --- | --- |
| `clauderon-gateway` | `pnpm start:gateway` (= `pnpm db:migrate`, then the Gateway) | `GET /health` → `{"ok":true}` |
| `clauderon-web` | `pnpm --filter @clauderon/web start` | `GET /sign-in` |

## Release and deploy steps

Releases follow [CONTRIBUTING.md](../CONTRIBUTING.md#releases) and [.claude/rules/release.md](../.claude/rules/release.md). In short:

1. Make sure `staging` is green (lint, typecheck, test, Agent checks).
2. Work out the next version from the Conventional Commits since the last tag (`git describe --tags --abbrev=0 origin/main`).
3. Cut `release/v<version>` from `staging`; run `pnpm features:build` and refresh the repo graph; open the pull request `chore(release): v<version>` into `main`.
4. If the release has a risky migration, take a database dump first ([database.md](database.md#backup-and-rollback)).
5. Merge. Render builds and deploys both services from `main`; the Gateway applies migrations before it starts.
6. Verify (below), then tag and publish the GitHub Release, update the plain-language landing page and merge `main` back into `staging`.

## Verify a deploy

- `https://<gateway host>/health` answers `{"ok":true}`.
- Sign-in works on the web URL and the sidebar shows the new version, if `APP_VERSION` is set.
- `https://<web host>/agent/agent.json` shows the new Agent version when the Agent changed; Machines update themselves on their next reconnect (the Machine page also has **Update agent**).
- On the Machines page, Machines reconnect within a minute or two and their Doctor reports are green.
- Start a small Run, or a **Test run** in the Flow editor, to check the end-to-end path.

## Database migrations

The Gateway runs `pnpm db:migrate` on every start, so migrations run on each deploy. Because web and Gateway restart separately, every migration must be compatible with the previous release's code (additive first, removals in a later release). Details: [database.md](database.md#migration-workflow).

## Rollback

There are no down migrations, so a rollback has two parts.

1. **Code.** Revert the release on `main` (a revert pull request into `main`, which redeploys), or redeploy the previous deploy of each service from the Render dashboard. Roll back both services, since they share the protocol.
2. **Database**, only when the release's migration is not compatible with the older code:
   - preferred: ship a forward migration that restores the old shape;
   - last resort: restore the dump taken in step 4 of the release (everything written since is lost). On the self-hosted stack use `deploy/backup.sh restore <file.dump>`.

After a rollback, tell Members if they need to do anything (for example run the install command again) and note it in the GitHub Release.

> [!WARNING]
> The rollback procedure above is derived from the current setup and has not been rehearsed. Before relying on it, the team should confirm on Render that reverting `main` and restoring a `pg_dump` into the free database work, and whether Agents step back to an older bundle served by the web app.

## Free plan limits (current production)

Render's free plan applies until [#118](https://github.com/toinguyen-agilityio/clauderon/issues/118) moves off it:

- Services sleep after 15 minutes without traffic and take about a minute to wake; an Agent's socket drops and reconnects, and a Run in progress can fail.
- The free database expires after 30 days, with its data, and has no backups.
- The 750 free instance hours a month do not cover two services running all month.

## Self-hosted alternative

```bash
deploy/deploy.sh
```

```bash
deploy/deploy.sh status
```

The script builds the images, runs migrations (`migrate` service), starts the Gateway, web app and `cloudflared`, and checks the public URLs. Updating is `git pull --rebase`, `pnpm install` and `deploy/deploy.sh` again. Setup, secrets rotation and backups: [deploy/README.md](../deploy/README.md).
