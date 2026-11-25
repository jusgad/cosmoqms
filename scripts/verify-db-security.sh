#!/bin/sh
# Verifies that the database security non-negotiable rule 4 depends on is really
# in place: the app's role cannot bypass RLS, every table has RLS forced, and
# the append-only tables refuse UPDATE/DELETE.
#
# Uses the libpq variables of the OWNER connection (PGHOST, PGPORT, PGUSER,
# PGPASSWORD, PGDATABASE) plus RUNTIME_DB_PASSWORD for cosmoqms_runtime.
#   CI:     run by .github/workflows/ci.yml
#   Docker: docker compose exec -T -e RUNTIME_DB_PASSWORD=... db sh < scripts/verify-db-security.sh
#           (inside the db container PGUSER=cosmoqms_app PGDATABASE=cosmoqms)
set -eu

: "${RUNTIME_DB_PASSWORD:?Falta RUNTIME_DB_PASSWORD}"
fail=0

check() {
  description="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "OK    $description"
  else
    echo "FALLA $description (esperado: $expected, obtenido: $actual)"
    fail=1
  fi
}

owner() { psql -v ON_ERROR_STOP=1 -tAc "$1"; }
runtime() { PGUSER=cosmoqms_runtime PGPASSWORD="$RUNTIME_DB_PASSWORD" psql -qtA 2>&1 || true; }

check "cosmoqms_runtime no es superusuario ni salta RLS" "f|f" \
  "$(owner "select rolsuper || '|' || rolbypassrls from pg_roles where rolname = 'cosmoqms_runtime'" | sed 's/false/f/g; s/true/t/g')"

check "cosmoqms_runtime no es dueño de ninguna tabla" "0" \
  "$(owner "select count(*) from pg_tables where schemaname = 'public' and tableowner = 'cosmoqms_runtime'")"

check "todas las tablas tienen RLS activo y forzado" "" \
  "$(owner "select string_agg(relname, ', ') from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relname <> '_prisma_migrations' and not (relrowsecurity and relforcerowsecurity)")"

for table in batch_events audit_log attachments; do
  check "$table no acepta UPDATE ni DELETE" "f|f" \
    "$(owner "select has_table_privilege('cosmoqms_runtime', '$table', 'UPDATE') || '|' || has_table_privilege('cosmoqms_runtime', '$table', 'DELETE')" | sed 's/false/f/g; s/true/t/g')"
done

check "la app no lee la tabla de migraciones" "f" \
  "$(owner "select has_table_privilege('cosmoqms_runtime', '_prisma_migrations', 'SELECT')" | sed 's/false/f/g; s/true/t/g')"

check "sin tenant, la app no ve ninguna organización" "0" "$(echo "select count(*) from organizations;" | runtime)"

check "con un tenant ajeno, la app no ve usuarios" "0" \
  "$(printf '%s\n' "begin;" "select set_config('app.current_tenant_id', 'tenant-que-no-existe', true);" "select count(*) from users;" "commit;" | runtime | tail -1)"

if [ "$fail" -ne 0 ]; then
  echo "La seguridad de la base NO está completa."
  exit 1
fi
echo "Seguridad de la base verificada."
