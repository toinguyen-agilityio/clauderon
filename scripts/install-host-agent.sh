#!/usr/bin/env bash
# Installs the Clauderon Host Agent as a service that starts at boot (POD-1):
# a launchd daemon on macOS or a systemd unit on Linux. The Gateway URL and
# the Host Agent secret go in an env file only root can read (mode 600).
# systemd reads it as root; on macOS launchd has no env-file option, so the
# values are copied into the daemon's plist, which is also root-only (600).
#
# Usage (from a checkout with `pnpm install` done):
#   sudo GATEWAY_URL=wss://gateway.example.com HOST_AGENT_SECRET=... \
#     scripts/install-host-agent.sh [--user <name>] [--dry-run]
#
# --user     account the agent runs as; it must be able to use Docker
#            (default: the user who ran sudo)
# --dry-run  print the files instead of writing them; needs no root
set -euo pipefail

LABEL="com.clauderon.host-agent"
SERVICE="clauderon-host-agent"
ENV_DIR="/etc/clauderon"
ENV_FILE="$ENV_DIR/host-agent.env"
STATE_DIR="/var/lib/clauderon-host-agent"
LOG_DIR="/var/log/clauderon"

RUN_USER="${SUDO_USER:-$(id -un)}"
DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --user) RUN_USER="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

: "${GATEWAY_URL:?set GATEWAY_URL, e.g. wss://gateway.example.com}"
: "${HOST_AGENT_SECRET:?set HOST_AGENT_SECRET}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE="$(command -v node)"
TSX="$REPO/node_modules/.bin/tsx"
MAIN="$REPO/apps/host-agent/src/main.ts"
[ -x "$TSX" ] || { echo "run pnpm install in $REPO first" >&2; exit 1; }
RUN_GROUP="$(id -gn "$RUN_USER")"

env_file() {
  printf 'GATEWAY_URL=%s\nHOST_AGENT_SECRET=%s\nHOST_AGENT_STATE_DIR=%s\n' "$GATEWAY_URL" "$HOST_AGENT_SECRET" "$STATE_DIR"
}

xml_escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}

# $1: the secret to embed (the dry run passes a placeholder)
launchd_plist() {
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>UserName</key><string>$RUN_USER</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$TSX</string><string>$MAIN</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    <key>GATEWAY_URL</key><string>$(xml_escape "$GATEWAY_URL")</string>
    <key>HOST_AGENT_SECRET</key><string>$(xml_escape "$1")</string>
    <key>HOST_AGENT_STATE_DIR</key><string>$STATE_DIR</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIR/host-agent.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/host-agent.log</string>
</dict>
</plist>
EOF
}

systemd_unit() {
  cat <<EOF
[Unit]
Description=Clauderon Host Agent
After=network-online.target docker.service
Wants=network-online.target

[Service]
User=$RUN_USER
EnvironmentFile=$ENV_FILE
ExecStart=$NODE $TSX $MAIN
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
}

case "$(uname -s)" in
  Darwin) UNIT_PATH="/Library/LaunchDaemons/$LABEL.plist"; UNIT_MODE=600; UNIT="$(launchd_plist "$HOST_AGENT_SECRET")"; SHOWN="$(launchd_plist "<hidden>")" ;;
  Linux) UNIT_PATH="/etc/systemd/system/$SERVICE.service"; UNIT_MODE=644; UNIT="$(systemd_unit)"; SHOWN="$UNIT" ;;
  *) echo "unsupported system: $(uname -s)" >&2; exit 1 ;;
esac

if [ "$DRY_RUN" = 1 ]; then
  echo "# $ENV_FILE (mode 600, root)"
  env_file | sed 's/^HOST_AGENT_SECRET=.*/HOST_AGENT_SECRET=<hidden>/'
  echo "# $UNIT_PATH (mode $UNIT_MODE, root)"
  echo "$SHOWN"
  exit 0
fi

[ "$(id -u)" = 0 ] || { echo "run with sudo" >&2; exit 1; }

install -d -m 755 "$ENV_DIR"
# launchd opens StandardOutPath as the job's user, so the agent must own its log directory.
install -d -m 755 -o "$RUN_USER" -g "$RUN_GROUP" "$LOG_DIR"
install -d -m 700 -o "$RUN_USER" -g "$RUN_GROUP" "$STATE_DIR"
umask 077
env_file >"$ENV_FILE"
echo "$UNIT" >"$UNIT_PATH"
umask 022
chmod 600 "$ENV_FILE"
chmod "$UNIT_MODE" "$UNIT_PATH"

case "$(uname -s)" in
  Darwin)
    chown root:wheel "$UNIT_PATH" "$ENV_FILE"
    launchctl bootout system "$UNIT_PATH" 2>/dev/null || true
    launchctl bootstrap system "$UNIT_PATH"
    ;;
  Linux)
    systemctl daemon-reload
    systemctl enable --now "$SERVICE"
    ;;
esac

echo "Host Agent installed as $UNIT_PATH, running as $RUN_USER."
