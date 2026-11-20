# Contributing

Thanks for helping. Read [CONTEXT.md](CONTEXT.md) first and use its terms exactly in code, UI, tests and commit messages (`Member`, not *user*; `Node`, not *step*). Setup and commands are in the [README](README.md#quick-start); how the repo is built is in [CLAUDE.md](CLAUDE.md).

## Workflow

1. Pick or file an issue. Issues use the labels in [docs/agents/triage-labels.md](docs/agents/triage-labels.md); milestone work follows the [specs](docs/specs/README.md).
2. Branch from `staging` (the default branch). One focused change per pull request.
3. Open the pull request **into `staging`**.
4. Before opening it, run `pnpm lint`, `pnpm typecheck` and `pnpm test`.

## Branches

`<type>/<issue>-<short-kebab-summary>`, for example `fix/85-markdown-node-text`. Use the same types as commits. Leave out the issue number only when there is no ticket.

| Branch | Purpose |
| --- | --- |
| `staging` | Default branch. All feature and fix pull requests merge here. Never deleted. |
| `release/<date or version>` | Cut from `staging` to ship. Merged into `main`, then deleted. |
| `main` | What has been released. Every merge into `main` is a release. |

## Commits

[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/): `type(scope): subject`.

- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `revert`.
- Scope is optional: the package or app (`web`, `gateway`, `host-agent`, `db`, `core`, `protocol`, `testing`, `deploy`) or a feature area that spans packages (`flows`, `runs`, `machines`). Write `host-agent`, not `agent`.
- Subject: imperative, lower case, no full stop, about 72 characters at most.
- Breaking change: `!` after the type or scope (`feat(db)!: …`) and a `BREAKING CHANGE:` footer.
- The body says why, when it is not obvious. Every commit stays in history (merge commits), so each one must follow this.

## Pull requests

The title is a Conventional Commit line. The body follows [the template](.github/pull_request_template.md):

- **Why**: the main reason for the change, 10 to 30 words.
- **Change**: what changed.
- **Notes**: optional; trade-offs, follow-ups.
- **Test plan**: how you checked it.
- `Closes #N` when the pull request meets the ticket's Acceptance Criteria, `Refs #N` when only part of it does ([after a merge](docs/agents/ticket-status-after-merge.md)).

## Releases

1. Cut `release/<date or version>` from `staging`.
2. Refresh the repo graph on that branch (see [.claude/rules/release.md](.claude/rules/release.md)): `graphify update .`, then commit `graphify-out/graph.json` and `GRAPH_REPORT.md` as `chore(graph): refresh repo graph` if they changed.
3. Open a pull request from the release branch into `main` and merge it. The branch is deleted by the merge; `staging` is not.
4. Merge `main` back into `staging` (`chore: sync main into staging`) so the next release does not diverge.

## Repo graph for Claude

`graphify-out/graph.json` and `GRAPH_REPORT.md` are a committed map of the code that Claude reads instead of many files. Do not edit them by hand and do not commit them in feature pull requests; they are refreshed only on release branches. To build one locally: `pip install graphifyy` (or `uv tool install graphifyy`), then `graphify update .`.

## Configuration and secrets

Document new configuration in [.env.example](.env.example). Never commit secrets or `.env` files. Keep [packages/protocol](packages/protocol) and the database schema backward compatible: web and Gateway restart separately.
