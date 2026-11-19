// One-line Agent install (ADR 0006): until the Agent ships as one file, the
// script checks the tools, clones this app's repository with the Member's own
// gh login, pairs (the browser opens on the Approve page) and installs the
// service that runs the Agent whenever the Member is logged in.

/** The repository the Agent runs from; `AGENT_REPOSITORY` overrides it, e.g. for a fork. */
export const DEFAULT_AGENT_REPOSITORY = "toinguyen-agilityio/clauderon";

export type InstallInput = { webUrl: string; repository: string };

const SAFE_URL = /^https?:\/\/[A-Za-z0-9.:[\]-]+(\/[A-Za-z0-9._~/-]*)?$/;
const SAFE_REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** Only values that need no quoting go into a script anyone runs with `| sh`. */
export function checkInstallInput(input: InstallInput): InstallInput {
  const webUrl = input.webUrl.replace(/\/$/, "");
  if (!SAFE_URL.test(webUrl)) throw new Error(`unsafe web URL ${JSON.stringify(input.webUrl)}`);
  if (!SAFE_REPO.test(input.repository)) throw new Error(`unsafe repository ${JSON.stringify(input.repository)}`);
  return { webUrl, repository: input.repository };
}

/** What the Machines page shows for macOS and Linux. */
export const installCommandSh = (webUrl: string) => `curl -fsSL ${webUrl}/agent/install.sh | sh`;
/** What the Machines page shows for Windows (PowerShell). */
export const installCommandPs1 = (webUrl: string) => `irm ${webUrl}/agent/install.ps1 | iex`;

/** macOS and Linux. Prompts read from /dev/tty: under `curl | sh` stdin is the script itself. */
export function installSh(input: InstallInput): string {
  const { webUrl, repository } = checkInstallInput(input);
  return `#!/bin/sh
# Clauderon Agent installer for ${webUrl}
# Pairs this computer as your Machine and runs the Agent whenever you are logged in.
set -eu

WEB_URL='${webUrl}'
REPOSITORY='${repository}'
APP_DIR="\${CLAUDERON_APP_DIR:-$HOME/.clauderon/app}"

say() { printf '\\033[1m==>\\033[0m %s\\n' "$*"; }
die() { printf '\\033[31merror:\\033[0m %s\\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is missing. Install it first: $2"; }

need git "https://git-scm.com/downloads"
need node "Node 22 or later, https://nodejs.org"
need gh "https://cli.github.com"
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' || die "Node 22 or later is needed (this is $(node -v))"
if command -v pnpm >/dev/null 2>&1; then PNPM=pnpm; else PNPM="corepack pnpm"; fi

if ! gh auth status >/dev/null 2>&1; then
  say "Log in to GitHub (Runs push and open pull requests as you)"
  gh auth login --web --git-protocol https </dev/tty
fi

if [ -d "$APP_DIR/.git" ]; then
  say "Updating $APP_DIR"
  git -C "$APP_DIR" pull --ff-only
else
  say "Downloading the Agent into $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  gh repo clone "$REPOSITORY" "$APP_DIR"
fi

cd "$APP_DIR"
say "Installing its packages"
$PNPM install --frozen-lockfile

say "Pairing (your browser opens; press Approve)"
node --import tsx apps/host-agent/src/main.ts pair "$WEB_URL" --no-start </dev/tty

say "Running the Agent whenever you are logged in"
node --import tsx apps/host-agent/src/main.ts install-service
say "Done. Your Machine shows Online on $WEB_URL/machines"
`;
}

/** Windows, from PowerShell. The Agent runs its commands in Git Bash, which Git for Windows installs. */
export function installPs1(input: InstallInput): string {
  const { webUrl, repository } = checkInstallInput(input);
  return `# Clauderon Agent installer for ${webUrl}
# Pairs this computer as your Machine and runs the Agent whenever you are logged in.
$ErrorActionPreference = "Stop"

$WebUrl = '${webUrl}'
$Repository = '${repository}'
$AppDir = if ($env:CLAUDERON_APP_DIR) { $env:CLAUDERON_APP_DIR } else { Join-Path $HOME ".clauderon\\app" }

function Say($text) { Write-Host "==> $text" -ForegroundColor Cyan }
function Need($command, $hint) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "$command is missing. Install it first: $hint" }
}
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed" } }

Need git "Git for Windows, which also installs Git Bash: https://git-scm.com/download/win"
Need node "Node 22 or later, https://nodejs.org"
Need gh "https://cli.github.com"
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if ($LASTEXITCODE -ne 0) { throw "Node 22 or later is needed (this is $(node -v))" }

gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  Say "Log in to GitHub (Runs push and open pull requests as you)"
  gh auth login --web --git-protocol https; Check "gh auth login"
}

if (Test-Path (Join-Path $AppDir ".git")) {
  Say "Updating $AppDir"
  git -C $AppDir pull --ff-only; Check "git pull"
} else {
  Say "Downloading the Agent into $AppDir"
  New-Item -ItemType Directory -Force -Path (Split-Path $AppDir) | Out-Null
  gh repo clone $Repository $AppDir; Check "gh repo clone"
}

Set-Location $AppDir
Say "Installing its packages"
if (Get-Command pnpm -ErrorAction SilentlyContinue) { pnpm install --frozen-lockfile } else { corepack pnpm install --frozen-lockfile }
Check "pnpm install"

Say "Pairing (your browser opens; press Approve)"
node --import tsx apps/host-agent/src/main.ts pair $WebUrl --no-start; Check "pair"

Say "Running the Agent whenever you are logged in"
node --import tsx apps/host-agent/src/main.ts install-service; Check "install-service"
Say "Done. Your Machine shows Online on $WebUrl/machines"
`;
}
