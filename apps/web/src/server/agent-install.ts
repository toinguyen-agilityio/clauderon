import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AgentManifest } from "@clauderon/protocol";

// One-line Agent install (ADR 0007): the script downloads the Agent's own
// Node 22 from nodejs.org (checked against its SHA-256) and the Agent bundle
// from this web app, checks the tools Runs need and says how to install any
// that is missing (it installs none, and never uses sudo), pairs unless the
// Machine is still paired, installs the service and runs the doctor. Running
// it again updates everything and replaces an old install (a clone run with tsx).

export type InstallInput = { webUrl: string };

/** The Node line the Agent runs on. */
export const NODE_MAJOR = 22;

const SAFE_URL = /^https?:\/\/[A-Za-z0-9.:[\]-]+(\/[A-Za-z0-9._~/-]*)?$/;

/** Only values that need no quoting go into a script anyone runs with `| sh`. */
export function checkInstallInput(input: InstallInput): InstallInput {
  const webUrl = input.webUrl.replace(/\/$/, "");
  if (!SAFE_URL.test(webUrl)) throw new Error(`unsafe web URL ${JSON.stringify(input.webUrl)}`);
  return { webUrl };
}

/** What the Machines page shows for macOS and Linux. */
export const installCommandSh = (webUrl: string) => `curl -fsSL ${webUrl}/agent/install.sh | sh`;
/** What the Machines page shows for Windows (PowerShell). */
export const installCommandPs1 = (webUrl: string) => `irm ${webUrl}/agent/install.ps1 | iex`;

/** Where the built bundle is (`pnpm --filter @clauderon/host-agent build`); `AGENT_BUNDLE_DIR` overrides it. */
export function agentBundleDir(): string {
  if (process.env.AGENT_BUNDLE_DIR) return process.env.AGENT_BUNDLE_DIR;
  // The web app runs from apps/web (`pnpm --filter`) or from the repository root (`next dev apps/web`).
  const candidates = [resolve(process.cwd(), "..", "host-agent", "dist"), resolve(process.cwd(), "apps", "host-agent", "dist")];
  return candidates.find((dir) => existsSync(join(dir, "agent.json"))) ?? candidates[0]!;
}

/** The bundle's manifest, or null when the Agent was not built. */
export async function agentManifest(dir = agentBundleDir()): Promise<AgentManifest | null> {
  try {
    return JSON.parse(await readFile(join(dir, "agent.json"), "utf8")) as AgentManifest;
  } catch {
    return null;
  }
}

/** The bundle itself, or null when the Agent was not built. */
export async function agentBundle(dir = agentBundleDir()): Promise<Buffer | null> {
  return readFile(join(dir, "agent.mjs")).catch(() => null);
}

/**
 * macOS and Linux. Prompts read from /dev/tty: under `curl | sh` stdin is the
 * script itself. `CLAUDERON_SKIP_PAIR` and `CLAUDERON_SKIP_SERVICE` are for
 * the smoke test in CI.
 */
export function installSh(input: InstallInput): string {
  const { webUrl } = checkInstallInput(input);
  return `#!/bin/sh
# Clauderon Agent installer for ${webUrl}
# Pairs this computer as your Machine and runs the Agent whenever you are logged in.
# Installs into ~/.clauderon only: its own Node, the Agent, no sudo.
set -eu

WEB_URL='${webUrl}'
NODE_MAJOR=${NODE_MAJOR}
HOME_DIR="\${CLAUDERON_HOME:-$HOME/.clauderon}"
NODE_DIR="$HOME_DIR/node"
NODE="$NODE_DIR/bin/node"
AGENT="$HOME_DIR/agent/agent.mjs"

say() { printf '\\033[1m==>\\033[0m %s\\n' "$*"; }
warn() { printf '\\033[33mwarning:\\033[0m %s\\n' "$*" >&2; }
die() { printf '\\033[31merror:\\033[0m %s\\n' "$*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }
sha256() { if has sha256sum; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

case "$(uname -s)" in
  Darwin) OS=darwin ;;
  Linux) OS=linux ;;
  *) die "this script is for macOS and Linux; on Windows run the PowerShell command from the Machines page" ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) ARCH=x64 ;;
  arm64 | aarch64) ARCH=arm64 ;;
  *) die "no Agent build for this processor ($(uname -m))" ;;
esac

# How to install a missing tool on this system: shown, never run.
fix() {
  case "$1:$OS" in
    git:darwin) echo "xcode-select --install   (or: brew install git)" ;;
    git:linux) echo "sudo apt install git   (or your distribution's package manager)" ;;
    gh:darwin) echo "brew install gh" ;;
    gh:linux) echo "see https://github.com/cli/cli/blob/trunk/docs/install_linux.md" ;;
    claude:*) echo "curl -fsSL https://claude.ai/install.sh | bash" ;;
  esac
}
need() { has "$1" || die "$1 is missing. Install it, then run this again: $(fix "$1")"; }

has curl || die "curl is missing"
has tar || die "tar is missing"
has shasum || has sha256sum || die "shasum or sha256sum is missing"
need git
need gh
has claude || warn "Claude Code is missing; Runs need it. Install it: $(fix claude)"

mkdir -p "$HOME_DIR"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# The Agent's own Node: a Node from nvm or Homebrew may move or change under the service.
if [ -x "$NODE" ] && "$NODE" -e "process.exit(Number(process.versions.node.split('.')[0]) === $NODE_MAJOR ? 0 : 1)" 2>/dev/null; then
  say "Node $("$NODE" -v) is in $NODE_DIR"
else
  BASE="https://nodejs.org/dist/latest-v$NODE_MAJOR.x"
  say "Downloading Node $NODE_MAJOR for $OS-$ARCH"
  curl -fsSL "$BASE/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
  FILE=$(awk -v want="-$OS-$ARCH.tar.gz" '$2 ~ /^node-v[0-9.]+/ && substr($2, length($2) - length(want) + 1) == want { print $2; exit }' "$TMP/SHASUMS256.txt")
  [ -n "$FILE" ] || die "nodejs.org has no Node $NODE_MAJOR for $OS-$ARCH"
  EXPECTED=$(awk -v f="$FILE" '$2 == f { print $1 }' "$TMP/SHASUMS256.txt")
  curl -fSL --progress-bar "$BASE/$FILE" -o "$TMP/$FILE"
  [ "$(sha256 "$TMP/$FILE")" = "$EXPECTED" ] || die "the Node download does not match its SHA-256; run this again"
  rm -rf "$NODE_DIR.new"
  mkdir -p "$NODE_DIR.new"
  tar -xzf "$TMP/$FILE" -C "$NODE_DIR.new" --strip-components=1
  rm -rf "$NODE_DIR"
  mv "$NODE_DIR.new" "$NODE_DIR"
  say "Node $("$NODE" -v) installed in $NODE_DIR"
fi

say "Downloading the Agent from $WEB_URL"
mkdir -p "$HOME_DIR/agent"
curl -fsSL "$WEB_URL/agent/agent.json" -o "$TMP/agent.json" || die "$WEB_URL serves no Agent; is the address right and reachable from here?"
curl -fsSL "$WEB_URL/agent/agent.mjs" -o "$TMP/agent.mjs"
EXPECTED=$("$NODE" -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).sha256)" "$TMP/agent.json")
[ "$(sha256 "$TMP/agent.mjs")" = "$EXPECTED" ] || die "the Agent download does not match its SHA-256; run this again"
mv "$TMP/agent.mjs" "$AGENT"
say "Agent $("$NODE" -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).version)" "$TMP/agent.json")"

if [ -z "\${CLAUDERON_SKIP_PAIR:-}" ]; then
  if ! gh auth status >/dev/null 2>&1; then
    say "Log in to GitHub (Runs push and open pull requests as you)"
    gh auth login --web --git-protocol https </dev/tty
  fi
  say "Pairing (your browser opens; press Approve)"
  "$NODE" "$AGENT" pair "$WEB_URL" --no-start --if-needed </dev/tty
fi

if [ -z "\${CLAUDERON_SKIP_SERVICE:-}" ]; then
  say "Running the Agent whenever you are logged in"
  "$NODE" "$AGENT" install-service
  # The old install: a clone of the repository run with tsx.
  if [ -d "$HOME_DIR/app/.git" ]; then
    say "Removing the old install in $HOME_DIR/app"
    rm -rf "$HOME_DIR/app"
  fi
fi

say "Checking this computer"
"$NODE" "$AGENT" doctor --no-fail
say "Done. Your Machine shows on $WEB_URL/machines"
`;
}

/** Windows, from PowerShell. The Agent runs its commands in Git Bash, which Git for Windows installs. */
export function installPs1(input: InstallInput): string {
  const { webUrl } = checkInstallInput(input);
  return `# Clauderon Agent installer for ${webUrl}
# Pairs this computer as your Machine and runs the Agent whenever you are logged in.
# Installs into ~\\.clauderon only: its own Node, the Agent, no administrator rights.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$WebUrl = '${webUrl}'
$NodeMajor = ${NODE_MAJOR}
$HomeDir = if ($env:CLAUDERON_HOME) { $env:CLAUDERON_HOME } else { Join-Path $HOME ".clauderon" }
$NodeDir = Join-Path $HomeDir "node"
$Node = Join-Path $NodeDir "node.exe"
$AgentDir = Join-Path $HomeDir "agent"
$Agent = Join-Path $AgentDir "agent.mjs"

function Say($text) { Write-Host "==> $text" -ForegroundColor Cyan }
function Warn($text) { Write-Host "warning: $text" -ForegroundColor Yellow }
function Has($command) { [bool](Get-Command $command -ErrorAction SilentlyContinue) }
function Need($command, $fix) { if (-not (Has $command)) { throw "$command is missing. Install it, then run this again: $fix" } }
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed" } }
# .NET directly, not Get-FileHash or Expand-Archive: Windows PowerShell started from PowerShell 7
# inherits a module path where those cmdlets fail to load.
function Sha256($path) {
  $stream = [IO.File]::OpenRead($path)
  try { ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($stream)) -replace "-", "").ToLower() } finally { $stream.Dispose() }
}
Add-Type -AssemblyName System.IO.Compression.FileSystem

$Arch = switch ($env:PROCESSOR_ARCHITECTURE) { "AMD64" { "x64" } "ARM64" { "arm64" } default { throw "no Agent build for this processor ($env:PROCESSOR_ARCHITECTURE)" } }

Need git "winget install --id Git.Git -e   (Git for Windows, which also installs Git Bash)"
Need gh "winget install --id GitHub.cli -e"
if (-not (Has claude)) { Warn "Claude Code is missing; Runs need it. Install it: irm https://claude.ai/install.ps1 | iex" }

New-Item -ItemType Directory -Force -Path $HomeDir, $AgentDir | Out-Null
$Tmp = Join-Path ([IO.Path]::GetTempPath()) ("clauderon-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null
try {
  # The Agent's own Node: one from nvm-windows or an installer may move or change under the service.
  $current = if (Test-Path $Node) { & $Node -e "process.exit(Number(process.versions.node.split('.')[0]) === $NodeMajor ? 0 : 1)"; $LASTEXITCODE -eq 0 } else { $false }
  if ($current) {
    Say "Node $(& $Node -v) is in $NodeDir"
  } else {
    $Base = "https://nodejs.org/dist/latest-v$NodeMajor.x"
    Say "Downloading Node $NodeMajor for win-$Arch"
    $Sums = (Invoke-WebRequest -UseBasicParsing "$Base/SHASUMS256.txt").Content -split "\`n"
    $Line = $Sums | Where-Object { $_ -match "^([0-9a-f]{64})\\s+(node-v[0-9.]+-win-$Arch\\.zip)$" } | Select-Object -First 1
    if (-not $Line) { throw "nodejs.org has no Node $NodeMajor for win-$Arch" }
    $Expected, $File = $Line -split "\\s+"
    Invoke-WebRequest -UseBasicParsing "$Base/$File" -OutFile (Join-Path $Tmp $File)
    if ((Sha256 (Join-Path $Tmp $File)) -ne $Expected) { throw "the Node download does not match its SHA-256; run this again" }
    [IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $Tmp $File), (Join-Path $Tmp "node"))
    if (Test-Path $NodeDir) { Remove-Item -Recurse -Force $NodeDir }
    Move-Item (Join-Path (Join-Path $Tmp "node") ($File -replace "\\.zip$", "")) $NodeDir
    Say "Node $(& $Node -v) installed in $NodeDir"
  }

  Say "Downloading the Agent from $WebUrl"
  try { $Manifest = Invoke-RestMethod "$WebUrl/agent/agent.json" } catch { throw "$WebUrl serves no Agent; is the address right and reachable from here?" }
  Invoke-WebRequest -UseBasicParsing "$WebUrl/agent/agent.mjs" -OutFile (Join-Path $Tmp "agent.mjs")
  if ((Sha256 (Join-Path $Tmp "agent.mjs")) -ne $Manifest.sha256) { throw "the Agent download does not match its SHA-256; run this again" }
  Move-Item -Force (Join-Path $Tmp "agent.mjs") $Agent
  Say "Agent $($Manifest.version)"
} finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}

if (-not $env:CLAUDERON_SKIP_PAIR) {
  gh auth status *> $null
  if ($LASTEXITCODE -ne 0) {
    Say "Log in to GitHub (Runs push and open pull requests as you)"
    gh auth login --web --git-protocol https; Check "gh auth login"
  }
  Say "Pairing (your browser opens; press Approve)"
  & $Node $Agent pair $WebUrl --no-start --if-needed; Check "pair"
}

if (-not $env:CLAUDERON_SKIP_SERVICE) {
  Say "Running the Agent whenever you are logged in"
  & $Node $Agent install-service; Check "install-service"
  # The old install: a clone of the repository run with tsx.
  $OldApp = Join-Path $HomeDir "app"
  if (Test-Path (Join-Path $OldApp ".git")) {
    Say "Removing the old install in $OldApp"
    Remove-Item -Recurse -Force $OldApp
  }
}

Say "Checking this computer"
& $Node $Agent doctor --no-fail
Say "Done. Your Machine shows on $WebUrl/machines"
`;
}
