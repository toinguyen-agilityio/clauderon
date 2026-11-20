# Contributing guide and team conventions (design)

Part of #107 (help Claude, and every dev, start a session with the same rules).

## Intent
Contributing rules live as 6 lines inside `README.md`, and branch, commit and PR-body habits differ per dev. Move them to a root `CONTRIBUTING.md` and fix one convention the whole team (and Claude) follows.

## Goals
- `CONTRIBUTING.md` at the root (GitHub links it from every new PR and issue).
- One convention for branch names, commit messages and PR bodies, written down.
- A PR template so the body is the same shape for everyone.

## Non-goals / anti-goals
- No enforcement: no commitlint, husky, CI title check (decided with the team lead: documents only). Revisit if drift continues.
- Do not copy `CLAUDE.md`, `CONTEXT.md` or ADR content into `CONTRIBUTING.md`; link to it.
- Do not rewrite history or rename existing branches.

## Approaches
1. **Documents only** (chosen): `CONTRIBUTING.md` + PR template. No dependency, nothing to install per dev; drift is possible.
2. CI check of PR title/branch: enforces without local setup; rejected for now (more to maintain).
3. commitlint + husky: enforces at commit time; rejected (per-dev install, heavy for a small team).

## Convention (my proposals, to be reviewed)
- **Commits**: [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) as the base. `type(scope): subject`, imperative, lower case, no trailing full stop, subject up to about 72 characters. Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `revert`. Breaking change: `!` after the type or scope, and a `BREAKING CHANGE:` footer. Body explains why when it is not obvious. Repo is merged with merge commits, so every commit message stays in history and must follow this.
- **Scope** (optional): the package or app directory (`web`, `gateway`, `host-agent`, `db`, `core`, `protocol`, `testing`, `deploy`) or a feature area that spans packages (`flows`, `runs`, `machines`). Use `host-agent`, not `agent`.
- **Branch**: `<type>/<issue>-<short-kebab-summary>`, same types as commits; leave out the issue number only when there is no ticket. Example: `fix/85-markdown-node-text`.
- **PR title**: also a Conventional Commit line. **PR body** sections: Why (the main reason for the change, 10 to 30 words), Change, Notes (optional), Test plan, then a link to the ticket: `Closes #N` when the PR meets the ticket's Acceptance Criteria, `Refs #N` when only part (matches `docs/agents/ticket-status-after-merge.md`). One focused change per PR.
- Before opening a PR: `pnpm lint`, `pnpm typecheck`, `pnpm test`; new config in `.env.example`; no secrets.

## Places to change
| File | Change |
| --- | --- |
| `CONTRIBUTING.md` (new) | Setup pointer to README Quick start, workflow, branch, commit, PR, checks, config and secrets |
| `.github/pull_request_template.md` (new) | Why (10 to 30 words) / Change / Notes / Test plan / `Closes #` |
| `README.md` (Contributing, ~line 325) | Replace the 6 bullets with a link to `CONTRIBUTING.md` |
| `CLAUDE.md` (Commands) | `pnpm db:migrate` and `db:seed` do not read `.env` (only `gateway` and `host-agent` use `--env-file-if-exists`), so they fail with `DATABASE_URL is not set`. Document exporting `.env` first (my call: docs only, since ticket #107 puts app code out of scope; changing the `migrate` script can be its own ticket) |
| `CLAUDE.md` | One line pointing to `CONTRIBUTING.md` for branch, commit and PR conventions |
| `.claude/rules/release.md` (new) | The release and graph rule above, plus the back-merge step |
| `.gitignore` | `graphify-out/cache/`, `graphify-out/graph.html` |
| `graphify-out/graph.json`, `GRAPH_REPORT.md` | Commit the first build |
| `.github/workflows/ci.yml`, `README.md` badge | Add `staging` to push trigger; badge `branch=staging` |
| `docs/agents/ticket-status-after-merge.md` | Mention that PRs go to `staging`; check `Closes #N` wording |
| `docs/README.md` | Add a link if it indexes root documents (check first) |

## Branch flow and repo graph (decided)
- All feature and fix PRs target `staging`. `staging` becomes the default branch (admin does this in GitHub settings), so `Closes #N` works and `gh pr create` targets it.
- Release: cut `release/<date or version>` from `staging`, refresh the graph there, open a PR into `main`. Auto-delete head branch then removes `release/...`, never `staging`.
- After a release merges, merge `main` back into `staging` (`chore: sync main into staging`), so the next release branch does not diverge and `staging` gets the refreshed graph.
- Graph: commit `graphify-out/graph.json` and `GRAPH_REPORT.md`; ignore `graphify-out/cache/` and `graph.html`. No CI job and no git hook; only a Claude rule in `.claude/rules/release.md`: before `gh pr create` from a `release/*` branch, run `graphify update .`, commit `chore(graph): refresh repo graph` if it changed, then open the PR. Code only, so no tokens spent.
- CI: `ci.yml` push trigger becomes `[main, staging]`; README badge points at `staging`.

## Left to the builder
Exact wording and order of `CONTRIBUTING.md`; whether `docs/README.md` needs the link.
