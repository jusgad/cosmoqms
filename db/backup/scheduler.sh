#!/bin/sh
# Daily scheduler for backup.sh: runs once at start if there is no backup
# from the last 24 h, then every day at BACKUP_HOUR (local time, TZ).
set -eu

HOUR="${BACKUP_HOUR:-2}"

last_epoch() {
  sed -n 's/^epoch=//p' /backups/ultimo-backup.txt 2>/dev/null || true
}

run() {
  sh /scripts/backup.sh || echo "$(date -Iseconds) El respaldo falló; se reintenta en el próximo ciclo." >&2
}

LAST=$(last_epoch)
if [ -z "$LAST" ] || [ $(( $(date +%s) - LAST )) -gt 86400 ]; then
  run
fi

while true; do
  NOW=$(date +%s)
  TARGET=$(date -d "$(date +%Y-%m-%d) $(printf '%02d' "$HOUR"):00" +%s)
  [ "$TARGET" -le "$NOW" ] && TARGET=$((TARGET + 86400))
  echo "$(date -Iseconds) Próximo respaldo: $(date -d "@$TARGET" -Iseconds)"
  sleep $((TARGET - NOW))
  run
done
