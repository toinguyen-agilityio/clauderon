# Clauderon docs

| Path | What it is |
| --- | --- |
| [overview.md](overview.md) | **Start here:** a one-page brief of what Clauderon does, for leads and newcomers |
| [requirements/v1-requirements.md](requirements/v1-requirements.md) | v1 requirements: the source of truth for scope, features and decisions |
| [roadmap/v1-seven-day-plan.md](roadmap/v1-seven-day-plan.md) | Proposed seven-day roadmap for v1 with AI agents: milestones per day, checks, prerequisites and cut list |
| [Roadmap (visual)](https://claude.ai/artifact/T4AJv1hxGDNFb9Ktea7GV9) | The seven-day roadmap as a page (EN/VI): modules by day, milestones, daily checks. Hosted as a Claude artifact; source in [roadmap/clauderon-v1-roadmap.html](roadmap/clauderon-v1-roadmap.html) |
| [adr/](adr/) | Architecture decision records, one decision per file |
| [prototype/clauderon-prototype.html](prototype/clauderon-prototype.html) | Clickable UI prototype built from the v1 requirements, on simulated data; open it in a browser |
| [Product brief](https://claude.ai/artifact/2tCo9jMTGf5jVfXKqegs3t) | Client-facing product brief (EN/VI): problem, idea, screens, requirements, roadmap, open questions. Hosted as a Claude artifact |
| [../CONTEXT.md](../CONTEXT.md) | Domain glossary: the words to use in code, UI and conversation |

## Decision records

- [0001 · Pods push and open pull requests with their own git/gh login](adr/0001-pods-push-with-their-own-git-login.md)
- [0002 · Flows are typed DAGs without cycles, run one Node at a time](adr/0002-flows-are-typed-dags-run-sequentially.md)
- [0003 · Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent](adr/0003-pods-are-member-containers-on-one-pod-host.md)
- [0004 · The web app runs on Vercel, with an always-on Gateway for long-lived connections](adr/0004-web-app-on-vercel-with-an-always-on-gateway.md)
