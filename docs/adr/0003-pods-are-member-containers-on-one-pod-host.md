# Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent

Each Member gets one Docker container, built from one standard Ubuntu image, on a single always-on team machine (the Pod Host). The container's Workspace volume holds that Member's own Claude Code and gh logins, so Runs spend the Starter's own subscription and open pull requests under the Starter's name, and every Run executes on its Starter's Pod. The Clauderon web app is hosted elsewhere with its own database, so a Host Agent on the Pod Host opens an outbound HTTPS connection to the app and carries out every command (create, start, stop, recreate, delete, exec, stream logs). This keeps the Pod Host free of inbound ports and works for remote Members, at the cost of one more process to install and keep running.

## Considered Options

- **The app calls the Docker API on the Pod Host directly**: nothing to install, but the Pod Host must be reachable from wherever the app is hosted (static IP or a VPN or tunnel), and an exposed Docker API grants root on that machine.
- **Shared Pods that any Member can pick**: fewer containers, but Runs would spend someone else's Claude quota and push under someone else's GitHub name.
- **Pods on several machines**: more capacity, but out of scope for v1; one Pod Host is enough for one team.

## Consequences

- The Pod Host is a single point of failure: when it, Docker or the Host Agent is down, every running Run becomes Interrupted and nothing new starts.
- A Member who has not logged in to Claude Code and gh in their Pod cannot start Runs.
- Anyone holding a Member's signed-in session can use that Member's Pod and credentials, so sign-in uses Google with an email allowlist (updated 2026-11-13; originally a typed username).
