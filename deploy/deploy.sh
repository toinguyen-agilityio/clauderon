#!/usr/bin/env bash
# One-command deploy of the self-hosted stack (deploy/README.md, ADR 0005).
#
#   deploy/deploy.sh           create the env file if missing, then build, start,
#                              publish over Tailscale Serve and check everything
#   deploy/deploy.sh status    what is running, the URL and the Host Agent link
#   deploy/deploy.sh down      stop the stack and the Serve routes (data is kept)
#
# Safe to run again: unchanged services are left running.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/deploy/.env.production}"
REQUIRED=(POSTGRES_PASSWORD SESSION_SECRET HOST_AGENT_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET PUBLIC_URL PUBLIC_GATEWAY_URL OPERATOR_EMAILS POD_IMAGE)

say() { printf '\033[1m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33mwarning:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
compose() { docker compose -f "$ROOT/deploy/compose.yml" --env-file "$ENV_FILE" "$@"; }
env_get() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }
env_set() {
  local tmp; tmp="$(mktemp)"
  awk -v k="$1" -v v="$2" 'BEGIN { FS = OFS = "=" } $1 == k { print k "=" v; next } { print }' "$ENV_FILE" >"$tmp"
  cat "$tmp" >"$ENV_FILE"; rm -f "$tmp"
}
web_port() { local p; p="$(env_get WEB_HOST_PORT)"; echo "${p:-3000}"; }
gateway_port() { local p; p="$(env_get GATEWAY_HOST_PORT)"; echo "${p:-4000}"; }

# This machine's HTTPS name in its current tailnet, e.g. mac.tail1234.ts.net.
tailnet_host() {
  tailscale status --self --json 2>/dev/null |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(j.BackendState==="Running"&&j.CertDomains?.[0])console.log(j.CertDomains[0])})'
}

init_env() {
  [ -f "$ENV_FILE" ] && return 0
  local host; host="$(tailnet_host)"
  [ -n "$host" ] || die "Tailscale is not running here, or its tailnet has no HTTPS certificates (enable them in the admin console)"
  say "Creating $ENV_FILE"
  (umask 077; cp "$ROOT/deploy/.env.production.example" "$ENV_FILE")
  for key in POSTGRES_PASSWORD SESSION_SECRET HOST_AGENT_SECRET; do
    env_set "$key" "$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-40)"
  done
  # 3100/4100 keep clear of a dev server on 3000/4000.
  env_set WEB_HOST_PORT 3100
  env_set GATEWAY_HOST_PORT 4100
  env_set PUBLIC_URL "https://$host"
  env_set PUBLIC_GATEWAY_URL "wss://$host:8443"
}

preflight() {
  command -v docker >/dev/null || die "Docker is not installed"
  docker info >/dev/null 2>&1 || die "Docker is not running (start Docker Desktop)"
  command -v tailscale >/dev/null || die "Tailscale is not installed"
  init_env

  local missing=()
  for key in "${REQUIRED[@]}"; do [ -n "$(env_get "$key")" ] || missing+=("$key"); done
  if [ ${#missing[@]} -gt 0 ]; then
    printf 'Fill these in %s, then run this again:\n' "$ENV_FILE" >&2
    printf '  %s\n' "${missing[@]}" >&2
    printf 'Google OAuth redirect URI: %s/api/auth/callback/google\n' "$(env_get PUBLIC_URL)" >&2
    exit 1
  fi
  [ -n "$(env_get GITHUB_TOKEN)" ] || warn "GITHUB_TOKEN is empty: Tickets cannot be read from GitHub"

  local host want; host="$(tailnet_host)"; want="$(env_get PUBLIC_URL)"; want="${want#https://}"
  [ -n "$host" ] || die "Tailscale is not connected (run: tailscale up, or tailscale switch <tailnet>)"
  [ "$host" = "$want" ] || die "this machine is $host in the current tailnet but PUBLIC_URL is https://$want (switch tailnet with: tailscale switch --list)"

  local image; image="$(env_get POD_IMAGE)"
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    case "$image" in
      */*) say "Pulling Pod image $image"; docker pull "$image" ;;
      *) say "Building Pod image $image"; docker build -t "$image" "$ROOT/images/pod" ;;
    esac
  fi
}

wait_for() {
  local url="$1" tries="${2:-60}"
  for _ in $(seq "$tries"); do
    curl -fsS -o /dev/null --max-time 3 "$url" 2>/dev/null && return 0
    sleep 2
  done
  return 1
}

host_agent_connected() { curl -fsS --max-time 3 "http://127.0.0.1:$(gateway_port)/health" 2>/dev/null | grep -q '"hostAgentConnected":true'; }

up() {
  preflight
  say "Building and starting the stack (migrations, Gateway, web)"
  compose up -d --build --remove-orphans
  wait_for "http://127.0.0.1:$(web_port)/sign-in" || { compose logs --tail 30 web gateway; die "the web app did not come up"; }

  say "Publishing over Tailscale Serve (tailnet only)"
  tailscale serve --bg --https=443 "http://127.0.0.1:$(web_port)" >/dev/null
  tailscale serve --bg --https=8443 "http://127.0.0.1:$(gateway_port)" >/dev/null
  wait_for "$(env_get PUBLIC_URL)/sign-in" 15 || warn "$(env_get PUBLIC_URL) does not answer yet; the first HTTPS certificate can take a minute"

  say "Checking the Host Agent"
  for _ in $(seq 10); do host_agent_connected && break; sleep 3; done
  if host_agent_connected; then
    echo "  connected"
  else
    warn "the Host Agent is not connected. Install it once (needs your password):"
    echo "  sudo env GATEWAY_URL=ws://127.0.0.1:$(gateway_port) HOST_AGENT_SECRET=\"\$(grep '^HOST_AGENT_SECRET=' '$ENV_FILE' | cut -d= -f2-)\" '$ROOT/scripts/install-host-agent.sh'"
  fi

  if [ "$(uname -s)" = Darwin ] && ! launchctl print "gui/$(id -u)/com.clauderon.backup" >/dev/null 2>&1; then
    warn "daily backups are not installed: run deploy/backup.sh install"
  fi
  status_line
}

status_line() {
  echo
  printf '\033[1mClauderon:\033[0m %s\n' "$(env_get PUBLIC_URL)"
  echo "Members must be in this tailnet, and an Operator adds their email to the allowlist."
}

status() {
  [ -f "$ENV_FILE" ] || die "no $ENV_FILE yet: run deploy/deploy.sh"
  compose ps -a --format 'table {{.Service}}\t{{.Status}}'
  echo; tailscale serve status 2>/dev/null || true
  echo; if host_agent_connected; then echo "Host Agent: connected"; else echo "Host Agent: not connected"; fi
  status_line
}

down() {
  [ -f "$ENV_FILE" ] || die "no $ENV_FILE: nothing to stop"
  say "Stopping the Tailscale Serve routes and the stack (the database volume is kept)"
  tailscale serve --https=443 off >/dev/null 2>&1 || true
  tailscale serve --https=8443 off >/dev/null 2>&1 || true
  compose down
}

case "${1:-up}" in
  up) up ;;
  status) status ;;
  down) down ;;
  *) echo "usage: deploy/deploy.sh [up|status|down]" >&2; exit 2 ;;
esac
