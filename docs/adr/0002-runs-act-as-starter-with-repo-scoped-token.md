# Runs act as their Starter with a repo-scoped GitHub token

Pull requests should carry the name of the person who started the Run, and Agent Steps need to call GitHub themselves. So each Run receives a GitHub user-to-server token for its Starter, limited to the Project's single repository and expiring when the Run ends, and that token is exposed to the AI agent and Command Steps. Because Ticket text reaches the agent's prompt, a malicious issue could steer the agent; scoping the token to one repository caps that damage to the repository the Run already changes.

## Considered Options

- **A shared team bot opens PRs**: no personal tokens on Pods, but PRs lose the Starter's authorship.
- **Only the Pod Daemon holds the token**: safest, but Agent Steps could not use GitHub directly.
- **The Starter's full OAuth token in the agent's environment**: simplest, but a prompt injection would get every repository the Starter can reach.
