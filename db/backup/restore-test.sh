#!/bin/sh
# Restore drill (BPM: a backup only counts if it restores). Restores the most
# recent dump into a scratch database, compares the row count of every table
# with the live database, checks the checksum, and drops the scratch
# database. Run it at least every quarter and keep the output as evidence:
#   docker compose exec backup sh /scripts/restore-test.sh
set -eu

DUMP=$(ls -1t /backups/base-de-datos/cosmoqms_*.dump 2>/dev/null | head -1 || true)
[ -n "$DUMP" ] || { echo "No hay respaldos en /backups/base-de-datos." >&2; exit 1; }
SCRATCH=restore_drill_$(date +%s)

echo "Prueba de restauración — $(date -Iseconds)"
echo "Respaldo: $(basename "$DUMP")"
(cd "$(dirname "$DUMP")" && sha256sum -c "$(basename "$DUMP").sha256") || { echo "La suma SHA-256 no coincide." >&2; exit 1; }

cleanup() { dropdb --if-exists "$SCRATCH"; }
trap cleanup EXIT

createdb "$SCRATCH"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$SCRATCH" "$DUMP"

counts() {
  psql -d "$1" -tA -c "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1" |
    while read -r table; do
      printf '%s=%s\n' "$table" "$(psql -d "$1" -tA -c "select count(*) from \"$table\"")"
    done
}

counts "$PGDATABASE" > /tmp/live.txt
counts "$SCRATCH" > /tmp/restored.txt

echo "Tablas restauradas: $(wc -l < /tmp/restored.txt)"
# The live database may have grown since the dump; a restored table may
# have fewer rows, never more, and every table must exist.
status=0
while IFS='=' read -r table restored; do
  live=$(sed -n "s/^$table=//p" /tmp/live.txt)
  if [ -z "$live" ] || [ "$restored" -gt "$live" ]; then
    echo "FALLA $table: restaurado=$restored actual=${live:-no existe}"
    status=1
  else
    echo "OK    $table: $restored filas (hoy $live)"
  fi
done < /tmp/restored.txt
[ "$(wc -l < /tmp/live.txt)" -eq "$(wc -l < /tmp/restored.txt)" ] || { echo "FALLA: faltan tablas en el respaldo"; status=1; }

[ "$status" -eq 0 ] && echo "Restauración verificada." || echo "La restauración NO es confiable."
exit "$status"
