# CosmoQMS — Handoff

> Última actualización: 2026-10-03
> Escrito para continuar en una ventana/sesión nueva de Claude Code.

## Estado actual

El build está **terminado y fusionado en `main`**. Repo: `C:\Users\sebas\Documents\Cosmoqms`, commit actual `1d3a518`.

- Las 19 tareas del plan de implementación están completas.
- 161 tests pasando (`pnpm test`), typecheck y lint limpios.
- Se hizo una revisión final de todo el branch (más allá de la revisión por tarea) que encontró y corrigió bugs reales de producción, no solo cosas de estilo:
  - `ProductionOrder.orderNumber` era único globalmente en vez de por tenant → un segundo cliente nunca podía crear una orden. Corregido a `@@unique([tenantId, orderNumber])`.
  - Faltaban filtros explícitos por `tenantId` en varias consultas (dependían solo de RLS, que no existía). Corregido en todos los routers.
  - El archivo `supabase/rls.sql` tenía bugs reales (comparaba `text` contra `::uuid`, no forzaba RLS, no manejaba los paths de auth/webhook que corren fuera del contexto de tenant). Corregido.
  - Faltaba la forma de rechazar un lote (`qc.reject`), el release no exigía que hubiera resultados de QC, las firmas no restringían qué rol firma qué etapa, el PDF tenía un hueco de inyección HTML, el CI no tenía versión de pnpm fijada, y un bug de UI que ocultaba el botón de pesaje después del primer ingrediente en fórmulas multi-ingrediente.
  - Todo esto está corregido y re-verificado.

### Documentos clave
- Blueprint original: `cosmoqms-blueprint.md`
- Plan de implementación (19 tareas, con notas de revisión y desviaciones documentadas): `docs/superpowers/plans/2026-09-25-cosmoqms.md`
- Instrucciones del proyecto: `CLAUDE.md`

## Lo único que falta es infraestructura externa — no código

### 1. Supabase (bloqueante para casi todo lo demás)
`.env` en este momento **solo tiene `DATABASE_URL`/`DIRECT_URL`** (hay que confirmar si ya son las reales o siguen siendo placeholders de `localhost` — revisar antes de asumir). Faltan:
- `SUPABASE_SERVICE_ROLE_KEY`
- Confirmar que `DATABASE_URL`/`DIRECT_URL` son del proyecto Supabase real (región `sa-east-1` recomendada), no `localhost`.

**Nunca se ha corrido una migración contra una base viva.** No existe ningún archivo en `prisma/migrations/` — el esquema se validó solo con `prisma format`/`validate`/`generate` contra un `.env` de placeholder.

Próximo paso una vez estén las credenciales:
```bash
pnpm exec prisma migrate dev --name init
```

### 2. Clerk
Las llaves básicas (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) ya estaban puestas en algún momento de la sesión anterior — confirmar que siguen ahí. Falta `CLERK_WEBHOOK_SECRET` si no se ha configurado el webhook todavía.

### 3. Row Level Security
`supabase/rls.sql` (en el repo, ya corregido en la revisión final) necesita:
- Un rol de conexión a Postgres que **no sea superusuario** (el rol `postgres` por defecto de Supabase tiene `BYPASSRLS`, así que las políticas no sirven de nada si la app se conecta con ese rol). El archivo trae una plantilla comentada para crear ese rol.
- Aplicar el SQL contra la base real.
- Probar aislamiento: crear una orden con el tenant A, confirmar que el tenant B no la ve.

### 4. Decisión de producto pendiente
¿El rol `admin` debe ver la pantalla de **Auditoría** en el menú lateral? Quedó implementado que sí (`src/components/layout/Sidebar.tsx`), pero nunca se confirmó explícitamente con el usuario — es una inferencia del blueprint, no una instrucción directa.

### 5. Cómo probar la app localmente (una vez Supabase esté conectado)
**Importante:** `prisma/seed.ts` crea usuarios de prueba directo en la base de datos, pero esos usuarios **no tienen cuentas reales de Clerk**, así que no sirven para iniciar sesión. Para probar la app de verdad:

1. Confirmar `.env` con credenciales reales de Supabase.
2. `pnpm exec prisma migrate dev --name init`
3. (Opcional) `pnpm exec prisma db seed` — para tener materias primas/fórmula de ejemplo, aunque no para login.
4. `pnpm dev` → abrir `http://localhost:3000`
5. Registrarse en `/login` (crea cuenta + organización real en Clerk) → el webhook crea automáticamente la fila en `users`/`organizations` con rol `operario` por defecto.
6. Para probar otros roles sin crear 6 cuentas: `pnpm exec prisma studio`, buscar tu fila en `users`, cambiar el campo `role` manualmente (`admin`, `director_tecnico`, `calidad`, etc.), guardar y recargar la app.

### 6. Vercel (al final, para desplegar en internet)
1. Crear proyecto en Vercel, conectar el repo de GitHub.
2. Root Directory: la raíz del repo (no hay subcarpeta).
3. Pegar todas las variables de `.env.example` en Vercel (Preview y Production).
4. Deploy.
5. Smoke test completo: login → recibir materia prima → crear fórmula → activarla → crear orden → pesar (probar offline/online) → firmar cada etapa → QC → liberar lote → descargar PDF.

## Comandos útiles
```bash
pnpm dev                              # servidor de desarrollo
pnpm build                            # build de producción
pnpm lint                             # linter
pnpm test                             # unit tests (161 actuales)
pnpm exec tsc --noEmit                # typecheck
pnpm exec prisma migrate dev          # aplicar migraciones
pnpm exec prisma generate             # regenerar cliente Prisma
pnpm exec prisma studio               # explorar/editar la base visualmente
```
Nota: usar `pnpm exec prisma`, no `pnpm dlx prisma` — `dlx` descarga la última versión mayor de Prisma (7.x), que no tiene los mismos comandos que la 6.19.3 que usa este proyecto.

## Reglas no negociables del proyecto (ver CLAUDE.md completo)
1. `batch_events` es append-only — nunca `UPDATE`/`DELETE`.
2. Toda mutación sobre tabla regulada escribe en `audit_log` en la misma transacción (vía la extensión de Prisma en `src/lib/audit.ts`).
3. Ninguna firma electrónica sin `reauth_verified = true` + `meaning_statement` explícito, verificado del lado del servidor contra Clerk (no solo confiando en el cliente).
4. Todo query respeta Row Level Security por `tenant_id` (filtro explícito en el código, no solo RLS).
5. TypeScript strict, sin `any`.
6. Eventos offline usan `clientEventId`, el servidor ignora duplicados.
7. Transiciones de etapa validadas en el servidor como máquina de estados.
8. Fórmula solo se activa si ingredientes suman 100% ± tolerancia, y solo si está en `draft`.
9. Mobile-first, touch targets ≥44px.
10. Nunca commitear `.env`.
11. Un componente por archivo, máximo 300 líneas.

## Tema en paralelo (no relacionado con CosmoQMS)
El usuario mencionó que necesita ayuda con **testeo para varios trabajos del SENA** — quedó pendiente de que él aclare qué tipo de pruebas necesita (de software, de base de datos, revisión de evidencias, etc.) antes de poder ayudar con eso. No se ha avanzado nada en ese tema todavía.
