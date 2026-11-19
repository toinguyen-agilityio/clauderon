# The Agent ships as one bundle with its own Node, and checks its Machine

Supersedes the **Delivery** part of [ADR 0006](0006-each-member-runs-on-their-own-machine.md).

The Agent worked on the computer it was written on and failed on others: the installer cloned this repository (which needs access to it), ran `pnpm install` and started `src/main.ts` with `tsx` under whatever Node the Member had, often one from nvm whose path the service then pinned. Nodes ran in `bash -lc`, which reads `~/.profile` but not `~/.zshrc`, so `claude` in `~/.local/bin` read as "Not logged in" although it was. Nothing told the Member which of these was wrong.

- **One file**: `pnpm --filter @clauderon/host-agent build` bundles the Agent with esbuild into `dist/agent.mjs` (with `clauderon-open-pr` embedded) and `dist/agent.json` with its version and SHA-256. The version is `<AGENT_VERSION>+<hash of the code>`; one run from a checkout reports `<AGENT_VERSION>-dev`. The web app serves both at `/agent/agent.mjs` and `/agent/agent.json`; the web image builds them.
- **Its own Node**: the installer downloads Node 22 from nodejs.org into `~/.clauderon/node`, checked against `SHASUMS256.txt`, and the service runs the bundle with it. Changing or removing the Member's own Node no longer breaks the service.
- **Installer**: still one line (`curl … | sh`, `irm … | iex`), still no sudo and no administrator. It needs git and gh (on Windows, Git for Windows for Git Bash); when one is missing it stops and prints the command that installs it on that OS, and installs nothing itself. It keeps a pairing the Gateway still accepts (`pair --if-needed`, checked with `GET /agent/check`), installs the service, removes the old `~/.clauderon/app` clone and runs the doctor.
- **The Member's own PATH**: at start and on every login check, the Agent asks the Member's login shell (`$SHELL -l -i`, fish included) for its PATH and puts it first in every Node (`CLAUDERON_PATH`). The service also keeps the installing terminal's PATH as a fallback. Windows keeps Git Bash's own PATH.
- **Doctor**: `agent.mjs doctor` checks the tools and their versions, the Claude Code and gh logins, git's name and email, the pairing, the Gateway's reachability and clock, the service and free disk, each with the step that fixes it on that OS. It runs at the end of the installer, when the Agent starts and with every Check logins, never periodically, and is sent as `machine.doctor` for the Machine page's Health card. A missing tool or login fails it and makes the Machine Not ready; git identity, clock, service and disk only warn. A Project the gh login cannot reach shows on the page, from the logins, not the doctor.
- **Updates**: after connecting, a bundled Agent compares its version with the web app's manifest; when they differ and no Node runs, it downloads the bundle, checks its SHA-256, replaces its own file and restarts (launchd and systemd restart it on a non-zero exit; on Windows it starts its successor). Agents from the old install report `0.3.x` and cannot update: the Machine page asks their Member to run the install command once more.
- **CI**: on macOS, Linux and Windows, the Agent's tests run and a smoke test runs the real one-line installer against the built bundle, then the doctor.

## Considered Options

- **A single executable per OS (Node SEA or `bun build --compile`)**: no Node to download, but a build per OS and architecture, and unsigned binaries trip Gatekeeper and SmartScreen.
- **Keep the clone with pnpm**: nothing to build, but every failure above stays.
- **The Member's own Node**: lighter, but the service breaks when it moves.
- **Installing missing tools for the Member (brew, winget, apt)**: friendlier, but needs sudo on Linux and touches their package manager.
- **The web app ships Node itself**: works without internet access to nodejs.org, at about 150 MB more in the web image.

## Consequences

- The web app and the Agent are released together: every Machine converges on the bundle the web app serves within one connect.
- An Agent update needs no Run to be running on that Machine; a busy Machine updates later.
- Installing needs nodejs.org to be reachable from the Member's computer.
- The bundle is public, like the installer: it holds no secret, and a Machine gets its token only by Pairing.
