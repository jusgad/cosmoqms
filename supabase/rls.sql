-- Row Level Security policies for multi-tenancy (CosmoQMS)
--
-- STATUS: NOT YET APPLIED to any database. Task 3 (Supabase project + live
-- Postgres) is blocked, so this file has never been run. It is written to be
-- applied once, after `prisma migrate deploy` has created the tables, and is
-- safe to re-run (every policy is dropped-if-exists before being created).
--
-- ============================================================================
-- READ THIS BEFORE APPLYING: RLS ONLY PROTECTS A NON-BYPASS ROLE
-- ============================================================================
-- PostgreSQL skips RLS entirely for superusers and for any role with the
-- BYPASSRLS attribute, and (without FORCE) also for the table's OWNER.
-- Prisma migrations create these tables as the connecting role — on Supabase
-- that is normally `postgres`, which owns the tables and has BYPASSRLS. If
-- the app's runtime `DATABASE_URL` connects as that same role, every policy
-- below is silently ignored and tenant isolation rests entirely on the
-- application-level `tenantId` filters.
--
-- Therefore, once this is applied:
--   1. `DATABASE_URL` (runtime, pooled) MUST connect as a dedicated role that
--      is NOT a superuser, does NOT have BYPASSRLS, and does NOT own the
--      tables. Choosing/creating that role requires live Supabase access and
--      is out of scope for the code build — a template is at the bottom of
--      this file (commented out).
--   2. `DIRECT_URL` (migrations only) keeps using the owner role.
--   3. Every table below also gets `FORCE ROW LEVEL SECURITY`, so that even
--      the table owner is subject to the policies (defense in depth in case
--      the runtime role ever ends up being the owner). FORCE does NOT affect
--      superusers or BYPASSRLS roles — point 1 is still required.
--   4. CLAUDE.md rule 4: the Supabase `service_role` key is only for
--      webhooks/migrations, never user-facing routes.
--
-- ============================================================================
-- HOW THE TENANT IS RESOLVED
-- ============================================================================
-- `withTenant()` (src/lib/db.ts) runs every request's queries inside one
-- transaction that first calls the parameterized
--   set_config('app.current_tenant_id', <tenantId>, true)
-- (`true` = transaction-local, like SET LOCAL). The policies compare each
-- row's `tenant_id` against `public.app_current_tenant_id()`, defined below.
--
-- Type note: `tenant_id` columns (and `organizations.id`) are TEXT holding
-- Clerk organization ids (`org_2abc...`), NOT uuids. The comparison is
-- text = text; an earlier draft cast the setting `::uuid`, which would fail
-- at query time for every real Clerk org id.
--
-- Unset-setting note: the helper uses `current_setting(name, true)` — the
-- `missing_ok = true` form returns NULL instead of raising
-- "unrecognized configuration parameter" when no `withTenant` ran. Also,
-- after a transaction-local set_config ends, Postgres resets the setting to
-- the EMPTY STRING (not NULL) for the rest of that pooled session, so the
-- helper normalises '' to NULL too. Either way, `tenant_id = NULL` is never
-- true: a query outside tenant context simply sees no rows — it never
-- crashes, and never sees another tenant's rows.
--
-- Paths that run OUTSIDE a request's tenant transaction (audited in the
-- final code review):
--   - `getCurrentUser()` (src/lib/auth.ts): looks the user up by its Clerk
--     user id, which is globally unique and needs no tenant filter of its
--     own. It now runs that lookup inside `withTenant(<session orgId>)`, so
--     the `users` policy returns exactly the one row it would accept anyway
--     (it already rejects a user whose tenant_id != the session's orgId).
--   - Clerk webhook (src/app/api/webhooks/clerk/route.ts): its
--     `organizations`/`users` upserts now also run inside
--     `withTenant(<the event's org id>)`. Known limitation: a Clerk user
--     moved to a DIFFERENT org already has a `users` row the new tenant
--     cannot see, so the upsert's INSERT branch fails on the primary key.
--     Multi-org membership is outside the single-org MVP; if it is needed,
--     run the webhook through a separate server-only connection as the
--     owner/service role (allowed for webhooks by CLAUDE.md rule 4).
--   - `prisma/seed.ts`: seeding runs through its own tenant transaction, or
--     via `DIRECT_URL` as the owner role.
--
-- ============================================================================
-- TABLE COVERAGE (verified against prisma/schema.prisma)
-- ============================================================================
-- Direct tenant_id column: users, raw_materials, raw_material_lots,
-- master_formulas, production_orders, batch_events, qc_specifications,
-- qc_results, deviations, finished_product_lots, sops, audit_log.
-- Tenant row itself: organizations (its `id` IS the tenant id).
-- No tenant_id column — isolated through the parent row: formula_ingredients
-- (-> master_formulas), batch_signatures (-> production_orders),
-- sop_acknowledgments (-> sops).
--
-- Append-only tables — batch_events (CLAUDE.md rule 1) and audit_log (the
-- immutable audit trail) — get SELECT and INSERT policies only. With RLS
-- enabled and forced and no UPDATE/DELETE policy, those commands affect zero
-- rows for the runtime role regardless of table GRANTs. This is defense in
-- depth on top of the application-level rule.

create or replace function public.app_current_tenant_id() returns text
  language sql
  stable
as $$
  select nullif(current_setting('app.current_tenant_id', true), '')
$$;

-- organizations (tenant row: its id is the tenant id)
alter table organizations enable row level security;
alter table organizations force row level security;
drop policy if exists tenant_isolation on organizations;
create policy tenant_isolation on organizations
  using (id = (select public.app_current_tenant_id()))
  with check (id = (select public.app_current_tenant_id()));

-- users
alter table users enable row level security;
alter table users force row level security;
drop policy if exists tenant_isolation on users;
create policy tenant_isolation on users
  using (tenant_id = (select public.app_current_tenant_id()))
  with check (tenant_id = (select public.app_current_tenant_id()));

-- raw_materials
alter table raw_materials enable row level security;
alter table raw_materials force row level security;
drop policy if exists tenant_isolation on raw_materials;
create policy tenant_isolation on raw_materials
  using (tenant_id = (select public.app_current_tenant_id()))
  with check (tenant_id = (select public.app_current_tenant_id()));

-- raw_material_lots
alter table raw_material_lots enable row level security;
alter table raw_material_lots force row level security;
drop policy if exists tenant_isolation on raw_material_lots;
create policy tenant_isolation on raw_material_lots
  using (tenant_id = (select public.app_current_tenant_id()))
  with check (tenant_id = (select public.app_current_tenant_id()));

-- master_formulas
alter table master_formulas enable row level security;
alter table master_formulas force row level security;
drop policy if exists tenant_isolation on master_formulas;
create policy tenant_isolation on master_formulas
  using (tenant_id = (select public.app_current_tenant_id()))
  with check (tenant_id = (select public.app_current_tenant_id()));

-- production_orders
alter table production_orders enable row level security;
alter table production_orders force row level security;
drop policy if exists tenant_isolation on production_orders;
create policy tenant_isolation on production_orders
  using (tenant_id = (select public.app_current_tenant_id()))
  with check (tenant_id = (select public.app_current_tenant_id()));

-- batch_events (append-only: SELECT + INSERT only, no UPDATE/DELETE policy)
alter table batch_events enable row level security;
alter table batch_events force row level security;
drop policy if exists tenant_isolation_select on batch_events;
create policy tenant_isolation_select on batch_events
  for select
  using (tenant_id = (select public.app_current_tenant_id()));
drop policy if exists tenant_isolation_insert on batch_events;
create policy tenant_isolation_insert on batch_events
  for insert
  with check (tenant_id = (select public.app_current_tenant_id()));

-- qc_specifications
alter table qc_specifications enable row level security;
alter table qc_specifications force row level security;
drop policy if exists tenant_isolation on qc_specifications;
create policy tenant_isolation on qc_specifications
  using (tenant_id = (select public.app_current_tenant_id()))
  with check (tenant_id = (select public.app_current_tenant_id()));

-- qc_results
alter table qc_results enable row level security;
alter table qc_results force row level security;
drop policy if exists tenant_isolation on qc_results;
create policy tenant_isolation on qc_results
  using (tenant_id = (select public.app_current_tenant_id()))
  with check (tenant_id = (select public.app_current_tenant_id()));

-- deviations
alter table deviations enable row level security;
alter table deviations force row level security;
drop policy if exists tenant_isolation on deviations;
create policy tenant_isolation on deviations
  using (tenant_id = (select public.app_current_tenant_id()))
  with check (tenant_id = (select public.app_current_tenant_id()));

-- finished_product_lots
alter table finished_product_lots enable row level security;
alter table finished_product_lots force row level security;
drop policy if exists tenant_isolation on finished_product_lots;
create policy tenant_isolation on finished_product_lots
  using (tenant_id = (select public.app_current_tenant_id()))
  with check (tenant_id = (select public.app_current_tenant_id()));

-- sops
alter table sops enable row level security;
alter table sops force row level security;
drop policy if exists tenant_isolation on sops;
create policy tenant_isolation on sops
  using (tenant_id = (select public.app_current_tenant_id()))
  with check (tenant_id = (select public.app_current_tenant_id()));

-- audit_log (append-only audit trail: SELECT + INSERT only)
alter table audit_log enable row level security;
alter table audit_log force row level security;
drop policy if exists tenant_isolation on audit_log;
drop policy if exists tenant_isolation_select on audit_log;
create policy tenant_isolation_select on audit_log
  for select
  using (tenant_id = (select public.app_current_tenant_id()));
drop policy if exists tenant_isolation_insert on audit_log;
create policy tenant_isolation_insert on audit_log
  for insert
  with check (tenant_id = (select public.app_current_tenant_id()));

-- formula_ingredients (no direct tenant_id -> via master_formulas). The
-- subquery on master_formulas is itself filtered by that table's policy too.
alter table formula_ingredients enable row level security;
alter table formula_ingredients force row level security;
drop policy if exists tenant_isolation on formula_ingredients;
create policy tenant_isolation on formula_ingredients
  using (
    formula_id in (
      select id from master_formulas
      where tenant_id = (select public.app_current_tenant_id())
    )
  )
  with check (
    formula_id in (
      select id from master_formulas
      where tenant_id = (select public.app_current_tenant_id())
    )
  );

-- batch_signatures (no direct tenant_id -> via production_orders)
alter table batch_signatures enable row level security;
alter table batch_signatures force row level security;
drop policy if exists tenant_isolation on batch_signatures;
create policy tenant_isolation on batch_signatures
  using (
    production_order_id in (
      select id from production_orders
      where tenant_id = (select public.app_current_tenant_id())
    )
  )
  with check (
    production_order_id in (
      select id from production_orders
      where tenant_id = (select public.app_current_tenant_id())
    )
  );

-- sop_acknowledgments (no direct tenant_id -> via sops)
alter table sop_acknowledgments enable row level security;
alter table sop_acknowledgments force row level security;
drop policy if exists tenant_isolation on sop_acknowledgments;
create policy tenant_isolation on sop_acknowledgments
  using (
    sop_id in (
      select id from sops
      where tenant_id = (select public.app_current_tenant_id())
    )
  )
  with check (
    sop_id in (
      select id from sops
      where tenant_id = (select public.app_current_tenant_id())
    )
  );

-- ============================================================================
-- TEMPLATE (commented out — requires live Supabase access; do NOT run blindly)
-- ============================================================================
-- A dedicated runtime role that RLS actually applies to. Put its credentials
-- in DATABASE_URL; keep DIRECT_URL on the owner role for migrations.
--
-- create role cosmoqms_app login password '<generate-a-strong-secret>'
--   nosuperuser nobypassrls nocreatedb nocreaterole;
-- grant usage on schema public to cosmoqms_app;
-- grant select, insert, update, delete on all tables in schema public to cosmoqms_app;
-- -- Append-only tables: no UPDATE/DELETE privilege at all (belt and braces
-- -- on top of the missing RLS policies above).
-- revoke update, delete on batch_events, audit_log from cosmoqms_app;
-- grant execute on function public.app_current_tenant_id() to cosmoqms_app;
-- alter default privileges in schema public
--   grant select, insert, update, delete on tables to cosmoqms_app;
--
-- Sanity check after switching DATABASE_URL (should return f, f):
-- select rolsuper, rolbypassrls from pg_roles where rolname = current_user;
