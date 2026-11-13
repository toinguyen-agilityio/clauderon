# Clauderon docs

| Path | What it is |
| --- | --- |
| [overview.md](overview.md) | **Start here:** a one-page brief of what Clauderon does, for leads and newcomers |
| [requirements/v1-requirements.md](requirements/v1-requirements.md) | v1 requirements: the source of truth for scope, features and decisions |
| [adr/](adr/) | Architecture decision records, one decision per file |
| [prototype/clauderon-prototype.html](prototype/clauderon-prototype.html) | Clickable UI prototype built from the v1 requirements, on simulated data; open it in a browser |
| [../CONTEXT.md](../CONTEXT.md) | Domain glossary: the words to use in code, UI and conversation |

## Decision records

- [0001 · Pods push and open pull requests with their own git/gh login](adr/0001-pods-push-with-their-own-git-login.md)
- [0002 · Flows are typed DAGs without cycles, run one Node at a time](adr/0002-flows-are-typed-dags-run-sequentially.md)
- [0003 · Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent](adr/0003-pods-are-member-containers-on-one-pod-host.md)
