# Pods push and open pull requests with their own git/gh login

Members sign in with Google (originally by typing a username), so the app has no verified GitHub identity per person and holds no GitHub token that can write. Instead, everything that writes to GitHub happens inside the Starter's Pod: the Run pushes its branch and opens its pull request with the gh login the Starter set up in their own Pod (see ADR 0003), so the pull request carries the Starter's GitHub name. The app keeps only one read-only token to sync issues and read pull request state, and never writes to GitHub.

Updated 2026-11-13: Pods became one container per Member, so "the Pod's login" is now the Starter's own login rather than a shared or per-machine account.

## Considered Options

- **A GitHub App bot with installation tokens scoped to one repository**: short-lived, narrow tokens, but pull requests lose the Starter's authorship and the app must handle tokens.
- **One shared bot account logged in on every Pod**: one login to manage, but pull requests carry the bot's name.
- **One shared personal access token held by the app**: simplest, but long-lived, broad, and stored on the app server.

## Consequences

- A Member's gh login usually reaches more than the Project's repository, so a malicious issue steering the agent is not capped to one repository. Logging in gh with a fine-grained token limited to the Projects' repositories is the recommended mitigation.
- A Pod without a working gh login cannot start Runs.
