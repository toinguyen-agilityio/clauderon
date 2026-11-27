# Changelog

Notable changes to Clauderon, grouped by release. Versions follow [Semantic Versioning](https://semver.org/) (0.y.z until the team decides on v1.0.0) and are tagged on `main`; see [CONTRIBUTING.md](CONTRIBUTING.md#versions). Each release's full list of merged pull requests is on its [GitHub Release](https://github.com/toinguyen-agilityio/clauderon/releases). A plain-language version for Members is on the [landing page](https://claude.ai/artifact/Uoah9d66hwGAi5feUGg1sK).

## [Unreleased]

## [0.12.0] - 2026-11-27

### Added

- An in-app guided tour, started from "Take the tour", that walks a Member step by step from pairing a Machine to a first Run and its Pull request, in English or Vietnamese (#248, #253).
- The sidebar collapses to an icon rail on desktop (#247).
- Sort the Tickets, Runs, Pull requests, Machines and Members lists by column (#242).

### Removed

- The tab of deleted Flows on the Flows page (#238).
- The separate "Opened" sort on the Pull requests table; the time still shows under Opened by (#255).

### Fixed

- The selection bar stays pinned to the viewport on every screen size (#249, #252).
- The notifications switch explains why it stayed off (#250).
- Tour buttons show, follow the app theme, and keep their labels on one line (#251, #254).

### Changed

- Deployment docs describe Render as production; the self-hosted Compose stack is the alternative (#236).
- Project documentation: installation, environment variables, architecture, API, database, deployment and troubleshooting guides, and this changelog (#243).

## [0.11.0] - 2026-11-26

### Added

- Tickets and Runs pages page through 10, 20, 50 or 100 rows (#229).

### Changed

- Flow history shows exactly what changed; the Run page reads as one summary sheet; Needs you shows what has waited longest; every pop-up shares one look, as a bottom sheet on phones (#232).
- No app version is shown when `APP_VERSION` is unset (#231).

### Fixed

- Lists no longer trap the scroll wheel, and Machine names are no longer squeezed (#230).

## [0.10.0] - 2026-11-26

### Added

- A model and turn limit per Agent Node; a Run pauses at the limit and asks to Continue or Stop (#223).
- Context is handed down the Flow, and a retry soon after a failure resumes the Claude session (#224).
- Flow history with restore of any version (#219).
- Every Agent Node is told to read the repository's own guidance and keep its session small (#217, #222).

### Changed

- New look for the list pages with board-style lists (#220).

### Fixed

- Cache reads are left out of token totals (#221).

## [0.9.0] - 2026-11-26

### Breaking

- **Unpair is gone.** To leave a computer, Remove the Machine; to come back, run the install command again (#213).

### Added

- Browser notifications to the Starter about their Runs (#201).
- **Update agent** on the Machine page when the Agent is behind (#211).
- Needs you page and badge update live through the Gateway socket (#200).
- Times shown in Vietnam time, and the app version in the sidebar (#206).

### Changed

- A Machine has only Connect and Remove Machine; Remove stops its Agent (#213).
- Redesigned sign-in page and Flows page action icons (#199, #209).

### Fixed

- The Agent stops when the Gateway no longer knows its Machine (#212).

## [0.8.0] - 2026-11-25

### Added

- Start a Flow from the Flows page, with several pull requests at once, or a plan or summary with links and attached files of any type (#188).
- A Run shows its Nodes as a Flow diagram with the current Node highlighted (#190).

Runs with attached files need Agent 0.6.0, which Agents install by themselves.

## [0.7.0] - 2026-11-25

### Added

- Node inspector on the Run page: what each Agent Node did turn by turn and where its tokens went, with tips (#182).
- CI comments the merged pull request on its linked tickets (#184).

## [0.6.0] - 2026-11-24

### Breaking

- **`GITHUB_TOKEN` env var removed.** An Operator saves the read-only GitHub token once on the Projects page after the deploy; until then the Tickets page cannot read GitHub (#177, ADR 0010).

### Added

- Projects from any GitHub owner (#177).
- Start Runs from picked pull requests (#176).
- Delete a Flow that has Runs; its Runs stay (#175).

### Changed

- Agent Outputs are easier to read; the Tickets page opens on Open tickets (#177).

## [0.5.0] - 2026-11-24

### Changed

- Flows saved before v0.4.0 start from an Input Node that takes a Ticket, like new Flows; an unedited sample "Code a change" gets the optional plan input (#168).

## [0.4.0] - 2026-11-24

### Added

- A Flow can start from a branch, a pull request, a plan or a summary, not only a Ticket (#167).
- Machines show disk, CPU and memory, with low and critical disk states (#153, #155).
- `docs/features.json` generated as context for Claude (#159).
- Plain-language landing page refreshed after each release (#160, #164).

### Removed

- Dry-run; the Flow editor's Test run stays (#157, ADR 0009).

### Fixed

- Tickets sync no longer runs in the Tickets page render path; Tickets and Pull requests pages open faster (#158, #165).
- Token totals count subagents and every Grill round (#166).

## [0.3.0] - 2026-11-23

### Added

- Build a Flow draft with Claude on the Member's Machine (#136).
- Import Nodes and Flows from files (#142, #143).
- Every open pull request of each Project on the Pull requests page (#137).
- The typed data a Flow carries is shown in the editor (#135).
- Menu button that opens the sidebar on phones (#144).

### Fixed

- Cloning twice created Flows with the same name (#145).
- Mobile sidebar items sat in a row with horizontal scroll (#147).
- Needs you badge showed 1 while the page was empty (#148).
- Delete was offered for Flows with Runs but always refused (#149).

## [0.2.0] - 2026-11-20

### Added

- New Flow button; sample Flows are editable (#126).
- The Operator can remove a Project (#125).

### Changed

- Operators show as Owner on the Members page.

## [0.1.0] - 2026-11-20

First MVP release.

### Added

- Machines and Pairing: one-command Agent install, short-lived pairing codes, outbound connection to the Gateway, Doctor, self-updating Agent (ADR 0006, ADR 0007).
- Projects and Tickets: enable repositories with a base branch and Sync open issues.
- Flow editor: typed, acyclic Flows from a shared Node library; seeded samples; clone, export and import.
- Node kinds: Ticket, Agent (Claude Code), Command (bash), Approve and Grill.
- Runs: one per Ticket in its own worktree and branch; Batches, per-Machine queue with Slots, Retry from any Node, Cancel, Interrupted after 30 seconds without a heartbeat.
- Needs you inbox, live masked logs, token counts, Runs filters, Pull requests page and audit log.
- Google sign-in behind an Operator-managed email allowlist.

[Unreleased]: https://github.com/toinguyen-agilityio/clauderon/compare/v0.11.0...staging
[0.11.0]: https://github.com/toinguyen-agilityio/clauderon/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/toinguyen-agilityio/clauderon/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/toinguyen-agilityio/clauderon/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/toinguyen-agilityio/clauderon/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/toinguyen-agilityio/clauderon/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/toinguyen-agilityio/clauderon/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/toinguyen-agilityio/clauderon/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/toinguyen-agilityio/clauderon/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/toinguyen-agilityio/clauderon/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/toinguyen-agilityio/clauderon/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/toinguyen-agilityio/clauderon/releases/tag/v0.1.0
