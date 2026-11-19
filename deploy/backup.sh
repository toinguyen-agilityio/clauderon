#!/usr/bin/env bash
# Daily Postgres backup for the self-hosted stack (spec M4 §5.2): a pg_dump in
# custom format, keeping the last 14 days.
#
#   deploy/backup.sh            take one backup now
#   deploy/backup.sh install    run it every day at 03:00 with a launchd agent (macOS)
#   deploy/backup.sh restore <file>   restore a dump into the running stack
#
# BACKUP_DIR (default deploy/backups) should be synced off this machine, for
# example a Google Drive or iCloud folder: a backup on the Pod Host alone is
# lost with the Pod Host.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/deploy/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
PROJECT="${COMPOSE_PROJECT_NAME:-clauderon-prod}"
LABEL="com.clauderon.backup"
compose() { docker compose -p "$PROJECT" -f "$ROOT/deploy/compose.yml" --env-file "$ROOT/deploy/.env.production" "$@"; }

backup() {
  mkdir -p "$BACKUP_DIR"
  local file="$BACKUP_DIR/clauderon-$(date -u +%Y%m%dT%H%M%SZ).dump"
  compose exec -T postgres pg_dump -U clauderon -d clauderon -Fc > "$file.partial"
  mv "$file.partial" "$file"
  find "$BACKUP_DIR" -name 'clauderon-*.dump' -mtime "+$KEEP_DAYS" -delete
  echo "backup written: $file"
}

restore() {
  local file="${1:?usage: backup.sh restore <file>}"
  compose stop web gateway
  compose exec -T postgres pg_restore -U clauderon -d clauderon --clean --if-exists < "$file"
  compose start gateway web
  echo "restored from $file"
}

install_agent() {
  local plist="$HOME/Library/LaunchAgents/$LABEL.plist"
  mkdir -p "$HOME/Library/LaunchAgents" "$BACKUP_DIR"
  cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$ROOT/deploy/backup.sh</string></array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    <key>BACKUP_DIR</key><string>$BACKUP_DIR</string>
  </dict>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$BACKUP_DIR/backup.log</string>
  <key>StandardErrorPath</key><string>$BACKUP_DIR/backup.log</string>
</dict>
</plist>
PLIST
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$plist"
  echo "installed $plist: daily backup at 03:00 into $BACKUP_DIR"
}

case "${1:-backup}" in
  backup) backup ;;
  restore) restore "${2:-}" ;;
  install) install_agent ;;
  *) echo "unknown command: $1" >&2; exit 2 ;;
esac
