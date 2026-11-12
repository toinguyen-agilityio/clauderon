# Pods push and open pull requests with their own git/gh login

Members sign in by typing a username, so the app has no GitHub identity per person and cannot act as the Starter. Instead, everything that writes to GitHub happens on the Pod: the Run pushes its branch and opens its pull request with the git and gh login already set up on that machine, and the pull request body names the Starter. The app keeps only one read-only token to sync issues and read pull request state, and never writes to GitHub. This supersedes ADR 0002.

## Considered Options

- **A GitHub App bot with installation tokens scoped to one repository**: short-lived, narrow tokens, but needs a GitHub App and token handling in the app.
- **One shared personal access token held by the app**: simplest, but long-lived, broad, and stored on the app server.

## Consequences

- Pull requests carry the Pod's GitHub account, not the Starter's.
- The Pod's login usually reaches more than the Project's repository, so a malicious issue steering the agent is no longer capped to one repository. A dedicated GitHub account per Pod, limited to the Projects' repositories, is the recommended mitigation.
- A Pod without a working gh login cannot complete a Run that opens a pull request.
