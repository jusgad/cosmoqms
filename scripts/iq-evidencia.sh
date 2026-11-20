#!/usr/bin/env bash
# Collects the evidence for the installation qualification (IQ,
# docs/validacion/03-protocolo-iq.md) into one dated text file. Run it on the
# server, from the project folder, with the stack up:
#   bash scripts/iq-evidencia.sh
# Attach the output file to the signed IQ protocol. It never prints secrets.
set -uo pipefail
export MSYS_NO_PATHCONV=1  # Git Bash on Windows: keep container paths as-is

OUT="iq-evidencia-$(date +%Y%m%d-%H%M%S).txt"
APP_URL="${APP_URL:-http://localhost:3001}"
compose() { docker compose "$@"; }

section() { printf '\n==== %s ====\n' "$1"; }
{
  echo "Evidencia de IQ — CosmoQMS"
  echo "Fecha: $(date -Iseconds)"
  echo "Equipo: $(hostname)"

  section "IQ-01 Versión del software"
  echo "Commit: $(git rev-parse HEAD 2>/dev/null || echo 'sin git')"
  echo "Rama: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '-')"
  echo "Cambios sin commit: $(git status --porcelain 2>/dev/null | grep -vc '^?? ' || true)"

  section "IQ-02 Plataforma"
  docker version --format 'Docker {{.Server.Version}} ({{.Server.Os}}/{{.Server.Arch}})'
  compose version
  compose ps --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}'

  section "IQ-03 Migraciones de base de datos"
  compose logs --no-color migrate 2>&1 | grep -E "migrations? (found|applied)|No pending|applied" | tail -5
  compose exec -T db psql -U cosmoqms_app -d cosmoqms -tAc \
    "select migration_name || '  ' || to_char(finished_at, 'YYYY-MM-DD HH24:MI') from _prisma_migrations order by started_at"

  section "IQ-04 Seguridad de la base (rol de la app y RLS)"
  RUNTIME_DB_PASSWORD=$(sed -n 's/^RUNTIME_DB_PASSWORD=//p' .env)
  compose exec -T -e RUNTIME_DB_PASSWORD="$RUNTIME_DB_PASSWORD" -e PGUSER=cosmoqms_app -e PGDATABASE=cosmoqms db sh < scripts/verify-db-security.sh

  section "IQ-05 Configuración de la aplicación"
  echo "DEMO_MODE en la app: $(compose exec -T cosmoqms printenv DEMO_MODE 2>/dev/null || echo '(no definido)')"
  echo "NEXT_PUBLIC_APP_URL: $(compose exec -T cosmoqms printenv NEXT_PUBLIC_APP_URL 2>/dev/null || echo '(no definido)')"
  echo "TZ: $(compose exec -T cosmoqms printenv TZ 2>/dev/null)"
  echo "STORAGE_DRIVER: $(compose exec -T cosmoqms printenv STORAGE_DRIVER 2>/dev/null)"
  echo "Llaves de Clerk presentes: $(compose exec -T cosmoqms sh -c '[ -n "$CLERK_SECRET_KEY" ] && [ -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ] && echo sí || echo NO' 2>/dev/null)"
  echo "Sentry configurado: $(compose exec -T cosmoqms sh -c '[ -n "$SENTRY_DSN" ] && echo sí || echo no' 2>/dev/null)"
  echo "Postgres publicado en: $(compose port db 5432 2>/dev/null)"

  section "IQ-06 Salud y HTTPS"
  echo "GET $APP_URL/api/health"
  curl -sS -m 10 "$APP_URL/api/health" || echo "(sin respuesta)"
  echo
  case "$APP_URL" in
    https://*) curl -sSI -m 10 "$APP_URL/api/health" | grep -iE '^(HTTP|strict-transport-security|x-frame-options|x-content-type-options)' ;;
    *) echo "APP_URL no es HTTPS: defina APP_URL=https://<dominio> para verificar el certificado." ;;
  esac

  section "IQ-07 Respaldos"
  compose ps backup --format '{{.Service}}: {{.Status}}'
  compose exec -T backup cat /backups/ultimo-backup.txt 2>/dev/null || echo "(sin respaldos todavía)"
  compose exec -T backup sh -c 'ls -1 /backups/base-de-datos | tail -3' 2>/dev/null
  echo "-- Simulacro de restauración --"
  compose exec -T backup sh /scripts/restore-test.sh 2>&1 | tail -4
} 2>&1 | tee "$OUT"

echo
echo "Evidencia guardada en $OUT"
