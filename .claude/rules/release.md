# Releases and the repo graph

Branch flow: feature and fix PRs go into `staging`. A release is a branch `release/v<version>` cut from `staging` and merged into `main`. Versions are SemVer (`vMAJOR.MINOR.PATCH`, first release `v0.1.0`, 0.y.z until the team decides on v1.0.0); see the Versions section of CONTRIBUTING.md for how to pick the bump from the Conventional Commits since the last tag.

Before `gh pr create` from a `release/*` branch into `main`:

1. Run `pnpm features:build` to refresh `docs/features.json`, and `graphify update .` (code only; no LLM, no API key).
2. Run `pnpm features:summary`. If `docs/features.json` changed, commit it as `chore(features): refresh features.json`; if `docs/features-summary.html` changed, commit it as `chore(docs): refresh feature summary page`, then republish it to the same Artifact (https://claude.ai/artifact/1qdVixh6YocMYDmFLxYRT8: read it, then publish `docs/features-summary.html` to that URL). Keep the Vietnamese lines in `docs/features-summary.vi.json` up to date (the generator fails when one is missing). If `graphify-out/graph.json` or `graphify-out/GRAPH_REPORT.md` changed, commit just those two files as `chore(graph): refresh repo graph`.
3. Then create the PR.

Do not refresh or commit the graph on any other branch. (`docs/features.json` is also refreshed on feature branches when a change adds, removes or moves a feature: edit `packages/features/features.map.json`, then run `pnpm features:build`; CI fails when it is stale.)

Before cutting the branch, find the last tag (`git describe --tags --abbrev=0 origin/main`), list the commits since it, work out the next version and tell the user which one and why. Title the release PR `chore(release): v<version>`.

After the release PR merges:
1. Write a two or three line summary of the release for Members (and any breaking changes with what to do about them), then tag it: `gh release create v<version> --target <merge commit sha on main> --title v<version> --generate-notes --notes "<summary>"`. The generated part lists merged PRs grouped by label (.github/release.yml). See "Release notes" in CONTRIBUTING.md.
2. Open or run a merge of `main` back into `staging` (`chore: sync main into staging`).
3. Tell the user the tag and the sync.

When answering questions about the code, prefer `graphify query "<question>"` or `graphify-out/GRAPH_REPORT.md` over reading many files.
