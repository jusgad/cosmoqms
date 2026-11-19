-- Runtime role for the app (CosmoQMS). Run as the table owner, with psql:
--   psql -v runtime_password=<secret> -f db/runtime-role.sql
-- docker-compose.yml runs it from the `db-security` service after every
-- `prisma migrate deploy`, followed by db/rls.sql. Safe to re-run.
--
-- `cosmoqms_runtime` is what the app's DATABASE_URL connects as: no
-- superuser, no BYPASSRLS, owns nothing — so every policy in db/rls.sql
-- applies to it. Migrations keep using the owner role (DIRECT_URL).

\set ON_ERROR_STOP on

select format(
  'create role cosmoqms_runtime login password %L nosuperuser nobypassrls nocreatedb nocreaterole noinherit',
  :'runtime_password'
)
where not exists (select 1 from pg_roles where rolname = 'cosmoqms_runtime')
\gexec

-- Re-applied every run so rotating the secret only needs a new value in .env.
alter role cosmoqms_runtime with login password :'runtime_password'
  nosuperuser nobypassrls nocreatedb nocreaterole noinherit;

grant connect on database cosmoqms to cosmoqms_runtime;
grant usage on schema public to cosmoqms_runtime;
grant select, insert, update, delete on all tables in schema public to cosmoqms_runtime;
grant usage, select on all sequences in schema public to cosmoqms_runtime;

-- Migration bookkeeping is the owner's business only.
revoke all on table _prisma_migrations from cosmoqms_runtime;

-- Append-only tables (CLAUDE.md rule 1 and the audit trail; attachments are
-- never replaced): no UPDATE/DELETE privilege at all, on top of the missing
-- RLS policies for those commands.
revoke update, delete on batch_events, audit_log, attachments from cosmoqms_runtime;

-- Tables created by future migrations get the same baseline grants; the
-- revokes above are re-applied on the next run of this file.
alter default privileges in schema public
  grant select, insert, update, delete on tables to cosmoqms_runtime;
alter default privileges in schema public
  grant usage, select on sequences to cosmoqms_runtime;
