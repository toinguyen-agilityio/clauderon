# The GitHub token is set on the Projects page, stored encrypted

The app reads issues, branches and pull requests with one read-only GitHub token (PRJ-2, ADR 0001). It came from `GITHUB_TOKEN` in the environment, so setting or rotating it meant editing the deploy's env file (or Render's settings) and restarting web and Gateway, which only whoever runs the host could do. NFR-1 kept every secret out of the database.

The Tickets page also reads GitHub in the background after it renders, at most once a minute per Project, so the manual **Sync** button and the "Synced 5 min ago" status on the Projects page no longer told a Member anything useful.

**Decision:** an Operator sets, replaces or removes the token on the Projects page, and the environment no longer holds it.

- **Storage**: one row in `github_access` holds the token encrypted with AES-256-GCM, under a key derived with HKDF from `SESSION_SECRET`, plus its last four characters, the GitHub login it reads as, and who set it when. A database dump or backup alone does not reveal the token. NFR-1 now reads: no secret in the database in the clear.
- **Checks**: saving calls `GET /user` with the token and refuses it when GitHub does; the page then shows the login and `••••` with the last four characters, never the token. Saving and removing are audited (`github.token.set`, `github.token.remove`) with the login only.
- **Who**: only an Operator, the same rule as enabling a Project. Every Member sees whether a token is set and which login it reads as.
- **Reads**: every GitHub request reads and decrypts the current row, so a new token applies at once on every web instance, with no restart. With no token, or one sealed under a previous `SESSION_SECRET`, reads fail with a message that sends an Operator to the Projects page; the Tickets page shows it as it shows any GitHub error.
- **Gateway**: it no longer gets the token. Log lines are still masked: GitHub tokens match the `gh*_` and `github_pat_` patterns in `mask`.
- **Sync**: the Projects page has no Sync button and no Sync status. The background Sync on the Tickets page is unchanged, and its errors still show there.
- **Any owner**: Projects no longer have to share one GitHub owner. The Enable list shows every repository the token reads that is not yet a Project, and the Projects page groups Projects by owner. A fine-grained token reads one owner's repositories, so Projects of several owners need a token that reads them all, such as a classic token, which usually also carries write scopes: prefer one owner with a fine-grained token when that is enough.
- **Still read-only**: GitHub cannot say whether a fine-grained token is read-only, so the page asks for read-only access to Contents, Issues and Pull requests. ADR 0001 is unchanged: writes happen on the Starter's Machine.

## Considered Options

- **Keep `GITHUB_TOKEN` as a fallback** when no token is saved: easier upgrade, but two places to look for the token in use. Removed instead; after deploying, an Operator saves the token once.
- **A separate encryption key** (`GITHUB_TOKEN_KEY`): keeps rotating sessions apart from the token, at the cost of one more variable on every deploy. `SESSION_SECRET` is already required by web and Gateway and rarely rotated.
- **Plain text in the database**: simplest, but anyone with a backup reads the token.
- **A token per Project or per owner**: reads several owners with fine-grained tokens, but a token is needed before any Project exists to list the repositories to enable, and each Project would need its own token setting.
