# Each Member runs on their own Machine, paired to a public app

Supersedes [ADR 0003](0003-pods-are-member-containers-on-one-pod-host.md) and the Tailscale part of [ADR 0005](0005-self-host-the-app-on-the-pod-host.md); the web app, the Gateway and Postgres stay one Docker Compose stack on one host.

One shared Pod Host was a single point of failure, and its CPU and memory were split across every Member's Pod. Each Member now pairs their own laptop or workstation, their Machine, and every Run they start executes there, directly on its operating system, under the Claude Code and gh logins the Member already has. An Agent on the Machine connects out to the Gateway over a WebSocket, as the Host Agent did, so no Machine opens an inbound port.

- **Pairing**: the Agent asks the Gateway for a short-lived pairing code, shows it and opens the web app's page for it; the Member, signed in, checks the computer's name and approves. A code made by the web app and pasted into the installer, with no Approve step, was turned down: whoever holds that command for a few minutes could pair their computer to the Member. The Agent made its own random token and sent only its SHA-256 hash, which the app stores on the Member's Machine, so no secret is kept in the database. Each Member has exactly one Machine: approving a new pairing replaces the old token, and the old Machine's Running Runs become Interrupted.
- **Execution**: Runs execute with the Member's full user permissions (`claude --dangerously-skip-permissions`), with no container or sandbox. Each Run gets a git worktree under the Agent's own directory (`~/.clauderon` by default), never the Member's own checkouts. Command Nodes always run in bash; on Windows that is Git Bash.
- **Capacity**: only Slots remain, set by the Member. CPU and memory limits and `POD_LIMIT_CEILING` are gone.
- **Reach**: web and Gateway are published to the internet through a Cloudflare Tunnel; Google sign-in with the email allowlist is the only gate.
- **Delivery**: the Agent ships as a Node single executable per OS and architecture and is upgraded by the Gateway. Until then it runs from source with `tsx`: a one-line installer from the web app clones this repository with the Member's own gh login, pairs, and installs a launchd agent, systemd user unit or logon Scheduled Task under the Member's own user (never a system service, so Runs keep their logins).
- **Terminal**: the browser terminal is off until a PTY is chosen; Members log in to Claude Code and gh in their own terminal.
- **Cutover**: big-bang. Deploying this interrupts every open Run; Members retry after pairing.

## Considered Options

- **Keep the shared Pod Host alongside personal Machines**: an easier move, but two execution paths to keep working.
- **Docker Pods on each Machine**: keeps isolation and one Ubuntu image, but every Member needs Docker and must log in again inside the container.
- **A sandbox (Claude Code's, Seatbelt, bubblewrap)**: limits what a Run can touch, but differs per OS and does not exist on Windows.
- **Tailscale for Machines and browsers**: keeps the app off the internet, but every Member installs a VPN client.
- **Cloudflare Access in front of the web app**: a second gate before Google sign-in, at the cost of one more login.

## Consequences

- A Member's Google session is a remote shell on their Machine: whoever holds it can start Runs there. A bug in the app's auth reaches every paired Machine.
- Anyone who can edit a Flow runs code on the Machine of every Member who starts a Run with it.
- A Machine that sleeps, shuts down or loses its network for 30 seconds interrupts its Running Runs, as a stopped Pod did; Runs cannot start while it is offline.
- A Flow can behave differently on two Machines, since their tools and versions differ.
- Losing one Machine stops only its Member's Runs.
