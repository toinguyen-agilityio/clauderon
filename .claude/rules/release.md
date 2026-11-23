# Releases and the repo graph

Branch flow: feature and fix PRs go into `staging`. A release is a branch `release/v<version>` cut from `staging` and merged into `main`. Versions are SemVer (`vMAJOR.MINOR.PATCH`, first release `v0.1.0`, 0.y.z until the team decides on v1.0.0); see the Versions section of CONTRIBUTING.md for how to pick the bump from the Conventional Commits since the last tag.

Before `gh pr create` from a `release/*` branch into `main`:

1. Run `pnpm features:build` to refresh `docs/features.json`, and `graphify update .` (code only; no LLM, no API key).
2. If `docs/features.json` changed, commit it as `chore(features): refresh features.json`. If `graphify-out/graph.json` or `graphify-out/GRAPH_REPORT.md` changed, commit just those two files as `chore(graph): refresh repo graph`.
3. Then create the PR.

Do not refresh or commit the graph on any other branch. (`docs/features.json` is also refreshed on feature branches when a change adds, removes or moves a feature: edit `packages/features/features.map.json`, then run `pnpm features:build`; CI fails when it is stale.)

Before cutting the branch, find the last tag (`git describe --tags --abbrev=0 origin/main`), list the commits since it, work out the next version and tell the user which one and why. Title the release PR `chore(release): v<version>`.

After the release PR merges:
1. Write a two or three line summary of the release for Members (and any breaking changes with what to do about them), then tag it: `gh release create v<version> --target <merge commit sha on main> --title v<version> --generate-notes --notes "<summary>"`. The generated part lists merged PRs grouped by label (.github/release.yml). See "Release notes" in CONTRIBUTING.md.
2. Update the plain-language landing page (https://claude.ai/artifact/Uoah9d66hwGAi5feUGg1sK, source `docs/landing-page.html`) with what this release changed, on a branch into `staging` (`docs(landing): add v<version> to the guide`):
   - add a block for `v<version>` at the top of "What's new" (version, date, one or two plain lines on what is new for a Member, New / Fixed lists, and "No breaking changes" or what to do), written from the GitHub Release notes in everyday words: no Gateway, worktree, ADR, migration or other jargon, in English and Vietnamese;
   - move anything that shipped out of the "Next" block and add what is merged but not released yet;
   - update the status badges in Features (Ready, Partly ready, Planned) and the "Latest release" chip in the hero;
   - read the Artifact, then publish `docs/landing-page.html` to the same URL, so the README link keeps working. Earlier releases stay on the page.
3. Open or run a merge of `main` back into `staging` (`chore: sync main into staging`).
4. Tell the user the tag, the landing page update and the sync.

When answering questions about the code, prefer `graphify query "<question>"` or `graphify-out/GRAPH_REPORT.md` over reading many files.
