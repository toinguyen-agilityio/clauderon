#!/usr/bin/env bash
# One-command deploy of the self-hosted stack (deploy/README.md, ADR 0005).
#
#   deploy/deploy.sh           create the env file if missing, then build, start
#                              (with the Cloudflare Tunnel) and check everything
#   deploy/deploy.sh tunnel    create the Cloudflare Tunnel and its DNS records,
#                              and put its token in the env file (after: cloudflared tunnel login)
#   deploy/deploy.sh status    what is running and the URL
#   deploy/deploy.sh down      stop the stack (data is kept)
#
# Safe to run again: unchanged services are left running.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/deploy/.env.production}"
TUNNEL_NAME="${TUNNEL_NAME:-clauderon}"
REQUIRED=(POSTGRES_PASSWORD SESSION_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET WEB_HOSTNAME GATEWAY_HOSTNAME CLOUDFLARE_TUNNEL_TOKEN OPERATOR_EMAILS)

say() { printf '\033[1m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33mwarning:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
compose() { docker compose -f "$ROOT/deploy/compose.yml" --env-file "$ENV_FILE" "$@"; }
env_get() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }
env_set() {
  local tmp; tmp="$(mktemp)"
  awk -v k="$1" -v v="$2" 'BEGIN { FS = OFS = "=" } $1 == k { print k "=" v; done = 1; next } { print } END { if (!done) print k "=" v }' "$ENV_FILE" >"$tmp"
  cat "$tmp" >"$ENV_FILE"; rm -f "$tmp"
}
public_url() { echo "https://$(env_get WEB_HOSTNAME)"; }
web_port() { local p; p="$(env_get WEB_HOST_PORT)"; echo "${p:-3000}"; }

init_env() {
  [ -f "$ENV_FILE" ] && return 0
  say "Creating $ENV_FILE"
  (umask 077; cp "$ROOT/deploy/.env.production.example" "$ENV_FILE")
  for key in POSTGRES_PASSWORD SESSION_SECRET; do
    env_set "$key" "$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-40)"
  done
  # 3100/4100 keep clear of a dev server on 3000/4000.
  env_set WEB_HOST_PORT 3100
  env_set GATEWAY_HOST_PORT 4100
}

preflight() {
  command -v docker >/dev/null || die "Docker is not installed"
  docker info >/dev/null 2>&1 || die "Docker is not running (start Docker Desktop)"
  init_env

  local missing=()
  for key in "${REQUIRED[@]}"; do [ -n "$(env_get "$key")" ] || missing+=("$key"); done
  if [ ${#missing[@]} -gt 0 ]; then
    printf 'Fill these in %s, then run this again:\n' "$ENV_FILE" >&2
    printf '  %s\n' "${missing[@]}" >&2
    printf 'CLOUDFLARE_TUNNEL_TOKEN comes from: cloudflared tunnel login, then deploy/deploy.sh tunnel\n' >&2
    [ -z "$(env_get WEB_HOSTNAME)" ] || printf 'Google OAuth redirect URI: %s/api/auth/callback/google\n' "$(public_url)" >&2
    exit 1
  fi
  [ -n "$(env_get GITHUB_TOKEN)" ] || warn "GITHUB_TOKEN is empty: Tickets cannot be read from GitHub"
}

# Create the tunnel (once), point both hostnames at it and store its token.
tunnel() {
  command -v cloudflared >/dev/null || die "cloudflared is not installed (brew install cloudflared)"
  [ -f "$HOME/.cloudflared/cert.pem" ] || die "not logged in to Cloudflare: run cloudflared tunnel login and pick the domain"
  init_env
  local web gw; web="$(env_get WEB_HOSTNAME)"; gw="$(env_get GATEWAY_HOSTNAME)"
  [ -n "$web" ] && [ -n "$gw" ] || die "set WEB_HOSTNAME and GATEWAY_HOSTNAME in $ENV_FILE first"
  if cloudflared tunnel info "$TUNNEL_NAME" >/dev/null 2>&1; then
    say "Tunnel $TUNNEL_NAME already exists"
  else
    say "Creating tunnel $TUNNEL_NAME"
    cloudflared tunnel create "$TUNNEL_NAME" >/dev/null
  fi
  for host in "$web" "$gw"; do
    # Never --overwrite-dns: an existing record for another service must stay.
    cloudflared tunnel route dns "$TUNNEL_NAME" "$host" >/dev/null 2>&1 ||
      warn "could not add the DNS record for $host; if it does not point at tunnel $TUNNEL_NAME, fix it in the Cloudflare dashboard"
  done
  env_set CLOUDFLARE_TUNNEL_TOKEN "$(cloudflared tunnel token "$TUNNEL_NAME")"
  say "Tunnel token saved in $ENV_FILE; run deploy/deploy.sh"
}

wait_for() {
  local url="$1" tries="${2:-60}"
  for _ in $(seq "$tries"); do
    curl -fsS -o /dev/null --max-time 3 "$url" 2>/dev/null && return 0
    sleep 2
  done
  return 1
}

up() {
  preflight
  say "Building and starting the stack (migrations, Gateway, web)"
  compose up -d --build --remove-orphans
  wait_for "http://127.0.0.1:$(web_port)/sign-in" || { compose logs --tail 30 web gateway; die "the web app did not come up"; }

  wait_for "$(public_url)/sign-in" 30 || { compose logs --tail 20 cloudflared; warn "$(public_url) does not answer yet: check the tunnel log above and the DNS records"; }
  wait_for "https://$(env_get GATEWAY_HOSTNAME)/health" 10 || warn "the Gateway does not answer at https://$(env_get GATEWAY_HOSTNAME)/health"

  if [ "$(uname -s)" = Darwin ] && ! launchctl print "gui/$(id -u)/com.clauderon.backup" >/dev/null 2>&1; then
    warn "daily backups are not installed: run deploy/backup.sh install"
  fi
  status_line
}

status_line() {
  echo
  printf '\033[1mClauderon:\033[0m %s\n' "$(public_url)"
  echo "It is on the internet: Google sign-in and the allowlist an Operator keeps decide who gets in."
  echo "Each Member then pairs their own computer from the Machines page."
}

status() {
  [ -f "$ENV_FILE" ] || die "no $ENV_FILE yet: run deploy/deploy.sh"
  compose ps -a --format 'table {{.Service}}\t{{.Status}}'
  status_line
}

down() {
  [ -f "$ENV_FILE" ] || die "no $ENV_FILE: nothing to stop"
  say "Stopping the stack and the tunnel (the database volume is kept)"
  compose down
}

case "${1:-up}" in
  up) up ;;
  tunnel) tunnel ;;
  status) status ;;
  down) down ;;
  *) echo "usage: deploy/deploy.sh [up|tunnel|status|down]" >&2; exit 2 ;;
esac
