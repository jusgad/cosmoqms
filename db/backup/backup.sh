#!/bin/sh
# One backup run (BPM data integrity): the database as a pg_dump custom
# archive, checked readable with pg_restore --list, plus the attachments
# (COAs, evidence, SOP documents) as a tar.gz, with SHA-256 checksums.
# Old files beyond BACKUP_RETENTION_DAYS are removed. Writes
# /backups/ultimo-backup.txt, which the container healthcheck watches.
#
# Runs in the `backup` service (postgres:16-alpine, same pg_dump version as
# the server). Connection comes from PGHOST/PGUSER/PGPASSWORD/PGDATABASE.
set -eu

STAMP=$(date +%Y-%m-%d_%H%M)
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DB_DIR=/backups/base-de-datos
FILES_DIR=/backups/adjuntos
mkdir -p "$DB_DIR" "$FILES_DIR"

fail() {
  echo "$(date -Iseconds) ERROR $1" | tee /backups/ultimo-error.txt >&2
  exit 1
}

DUMP="$DB_DIR/cosmoqms_$STAMP.dump"
echo "$(date -Iseconds) Respaldando la base de datos en $DUMP"
pg_dump --format=custom --compress=9 --file="$DUMP.tmp" || fail "pg_dump falló"
pg_restore --list "$DUMP.tmp" > /dev/null || fail "el archivo de respaldo no se puede leer"
mv "$DUMP.tmp" "$DUMP"
(cd "$DB_DIR" && sha256sum "$(basename "$DUMP")" > "$(basename "$DUMP").sha256")

ARCHIVE="$FILES_DIR/adjuntos_$STAMP.tar.gz"
if [ -d /storage ]; then
  echo "$(date -Iseconds) Respaldando adjuntos en $ARCHIVE"
  tar -czf "$ARCHIVE.tmp" -C /storage . || fail "no se pudieron empaquetar los adjuntos"
  mv "$ARCHIVE.tmp" "$ARCHIVE"
  (cd "$FILES_DIR" && sha256sum "$(basename "$ARCHIVE")" > "$(basename "$ARCHIVE").sha256")
fi

# Retention: only this script's own files, never anything else in /backups.
find "$DB_DIR" -name 'cosmoqms_*.dump*' -mtime +"$RETENTION_DAYS" -delete
find "$FILES_DIR" -name 'adjuntos_*.tar.gz*' -mtime +"$RETENTION_DAYS" -delete

SIZE=$(du -h "$DUMP" | cut -f1)
{
  echo "fecha=$(date -Iseconds)"
  echo "epoch=$(date +%s)"
  echo "base_de_datos=$(basename "$DUMP") ($SIZE)"
  [ -f "$ARCHIVE" ] && echo "adjuntos=$(basename "$ARCHIVE")"
} > /backups/ultimo-backup.txt
rm -f /backups/ultimo-error.txt
echo "$(date -Iseconds) Respaldo completo ($SIZE)."
