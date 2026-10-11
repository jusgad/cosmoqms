# CosmoQMS

Sistema interno de producción y calidad (MES/QMS) para laboratorio cosmético, diseñado para cumplir BPM/INVIMA (Colombia).

## Commands

- `pnpm dev` — Servidor de desarrollo
- `pnpm build` — Build de producción
- `pnpm lint` — Linter
- `pnpm test` — Unit tests (Vitest)
- `pnpm test:e2e` — E2E (Playwright)
- `pnpm dlx prisma migrate dev` — Aplicar migraciones
- `pnpm dlx prisma generate` — Generar cliente Prisma

## Tech Stack

Next.js 15 (App Router) + TypeScript strict + Tailwind CSS v4 + shadcn/ui + PostgreSQL (Supabase) + Prisma + Clerk (Organizations + MFA) + tRPC + Serwist (PWA) + Dexie (offline) + Playwright (PDF) + Vercel

## Architecture

### Directory Structure

- `src/app/(app)/` — Rutas protegidas, una carpeta por módulo (materias-primas, formulas, produccion, calidad, trazabilidad, auditoria)
- `src/components/` — Organizados por dominio (`batch/`, `quality/`, `dashboard/`, `layout/`), no por tipo
- `src/lib/offline/` — Cola Dexie + motor de sincronización, aislado del resto de `lib/`
- `src/lib/trpc/router/` — Un router por dominio, mergeados en `_app.ts`
- `prisma/schema.prisma` — Fuente de verdad del modelo de datos

### Data Flow

Server Components leen directo de Prisma para listados/reportes. Pantallas interactivas (batch record, formularios) usan tRPC + TanStack Query. En planta sin señal: las acciones se escriben primero en Dexie (IndexedDB) como eventos con `clientEventId` propio, y el `sync-engine` las empuja a `/api/sync/events` al reconectar — append-only, nunca sobrescribe.

### Key Patterns

- **Server Components por defecto.** `"use client"` solo en componentes con interactividad real (formularios, scanner QR, firma).
- **Toda escritura sobre una tabla regulada pasa por el middleware de auditoría de Prisma** — nunca se escribe directo sin que quede en `audit_log`.
- **Las transiciones de etapa de un lote se validan en el servidor**, nunca se confía en el estado enviado por el cliente.
- **`batch_events` es append-only.** Nunca `UPDATE` ni `DELETE` sobre esa tabla — una corrección es un evento nuevo que compensa al anterior.

## Code Organization Rules

1. **Un componente por archivo. Máximo 300 líneas.** Si crece, extraer subcomponentes.
2. **Alias de rutas:** usar `@/` para `src/`.
3. **Sin barrel exports.** Importar directo del archivo fuente.
4. **Server Components por defecto.** Solo `"use client"` cuando hay interactividad.
5. **Colocar componentes junto a su página** cuando son específicos de una sola pantalla.

## Design System

### Colors

Primary `#0891B2` · Secondary `#22D3EE` · Accent/Liberado `#16A34A` · Pendiente `#D97706` · Destructive/Rechazado `#DC2626` · Background `#F0FDFA` (light) / `#0B1120` (dark) · Card `#FFFFFF` / `#111827` · Text `#134E4A` / `#E5E7EB` · Muted `#475569` · Border `#CCFBF1` / `#1F2937`

### Typography

- Headings/Body: Fira Sans, pesos 400–700
- Datos/códigos/lotes/timestamps: Fira Code (mono), 400–500

### Style

- Border radius: 8px default, 12px cards
- Sin sombras decorativas — flat design
- Spacing base: 8px (escala densa: 8/12/16/24/32/48)
- Touch targets mínimo 44×44px (uso con guantes en planta)
- Estética: clínica, de alto contraste, iconografía SVG (Lucide), nunca emoji, modo oscuro con mismo contraste verificado (4.5:1 mínimo)

## Environment Variables

| Variable                            | Description                              |
| ----------------------------------- | ---------------------------------------- |
| `DATABASE_URL`                      | Postgres pooled connection               |
| `DIRECT_URL`                        | Postgres direct connection (migraciones) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk pública                            |
| `CLERK_SECRET_KEY`                  | Clerk secreta                            |
| `CLERK_WEBHOOK_SECRET`              | Verificación de webhooks Clerk           |
| `SUPABASE_SERVICE_ROLE_KEY`         | Solo contextos server-only de confianza  |
| `NEXT_PUBLIC_APP_URL`               | URL pública de la app                    |

## Reglas No Negociables

1. `batch_events` es append-only — nunca `UPDATE`/`DELETE`, solo `INSERT`. Una corrección es un evento nuevo.
2. Toda mutación sobre una tabla regulada (`production_orders`, `batch_events`, `qc_results`, `deviations`, `finished_product_lots`) debe escribir en `audit_log` en la misma transacción.
3. Ninguna firma electrónica se persiste sin `reauth_verified = true` y `meaning_statement` explícito.
4. Todo query debe respetar Row Level Security por `tenant_id` — el `service role` de Supabase solo se usa en webhooks/migraciones, nunca en rutas de usuario.
5. TypeScript strict, sin `any`.
6. Los eventos offline usan `clientEventId` generado en el dispositivo — el servidor debe ignorar duplicados, nunca aplicarlos dos veces.
7. Las transiciones de etapa del lote se validan en el servidor como máquina de estados — nunca se confía en el estado enviado por el cliente.
8. Una fórmula solo puede activarse (`status = active`) si sus ingredientes suman 100% ± tolerancia configurada.
9. Mobile-first, touch targets ≥44px.
10. Nunca commitear archivos `.env`.
11. Un componente por archivo, máximo 300 líneas.
