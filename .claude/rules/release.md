# Releases and the repo graph

Branch flow: feature and fix PRs go into `staging`. A release is a branch `release/<date or version>` cut from `staging` and merged into `main`. See CONTRIBUTING.md.

Before `gh pr create` from a `release/*` branch into `main`:

1. Run `graphify update .` (code only; no LLM, no API key).
2. If `graphify-out/graph.json` or `graphify-out/GRAPH_REPORT.md` changed, commit just those two files as `chore(graph): refresh repo graph`.
3. Then create the PR.

Do not refresh or commit the graph on any other branch.

After the release PR merges, open or run a merge of `main` back into `staging` (`chore: sync main into staging`) and say so to the user.

When answering questions about the code, prefer `graphify query "<question>"` or `graphify-out/GRAPH_REPORT.md` over reading many files.
