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
  - El archivo `db/rls.sql` tenía bugs reales (comparaba `text` contra `::uuid`, no forzaba RLS, no manejaba los paths de auth/webhook que corren fuera del contexto de tenant). Corregido.
  - Faltaba la forma de rechazar un lote (`qc.reject`), el release no exigía que hubiera resultados de QC, las firmas no restringían qué rol firma qué etapa, el PDF tenía un hueco de inyección HTML, el CI no tenía versión de pnpm fijada, y un bug de UI que ocultaba el botón de pesaje después del primer ingrediente en fórmulas multi-ingrediente.
  - Todo esto está corregido y re-verificado.

### Documentos clave
- Blueprint original: `cosmoqms-blueprint.md`
- Plan de implementación (19 tareas, con notas de revisión y desviaciones documentadas): `docs/superpowers/plans/2026-09-25-cosmoqms.md`
- Instrucciones del proyecto: `CLAUDE.md`

## Lo único que falta es infraestructura externa — no código

### 1. Base de datos (actualizado 2026-11-19)
Se retiró Supabase. La base es un PostgreSQL 16 propio en Docker (`docker-compose.yml`, servicio `db`, puerto 5433 en el host). Las migraciones se aplican solas con el servicio `migrate` (`prisma migrate deploy`). Ver `DEPLOY.md`.

### 2. Clerk
Las llaves básicas (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) ya estaban puestas en algún momento de la sesión anterior — confirmar que siguen ahí. Falta `CLERK_WEBHOOK_SECRET` si no se ha configurado el webhook todavía.

### 3. Row Level Security
`db/rls.sql` (en el repo, ya corregido en la revisión final) necesita:
- Un rol de conexión a Postgres que **no sea superusuario** (el usuario `cosmoqms_app` de Docker es superusuario y se salta RLS, así que las políticas no sirven de nada si la app se conecta con ese rol). El archivo trae una plantilla comentada para crear el rol `cosmoqms_runtime`.
- Aplicar el SQL contra la base real.
- Probar aislamiento: crear una orden con el tenant A, confirmar que el tenant B no la ve.

### 4. Decisión de producto pendiente
¿El rol `admin` debe ver la pantalla de **Auditoría** en el menú lateral? Quedó implementado que sí (`src/components/layout/Sidebar.tsx`), pero nunca se confirmó explícitamente con el usuario — es una inferencia del blueprint, no una instrucción directa.

### 5. Cómo probar la app localmente (con Docker)
**Importante:** `prisma/seed.ts` crea usuarios de prueba directo en la base de datos, pero esos usuarios **no tienen cuentas reales de Clerk**, así que no sirven para iniciar sesión. Para probar la app de verdad:

1. `docker compose up -d db migrate` (base + migraciones).
2. `.env` con `DATABASE_URL`/`DIRECT_URL` apuntando a `localhost:5433`.
3. (Opcional) `pnpm exec prisma db seed` — para tener materias primas/fórmula de ejemplo, aunque no para login.
4. `pnpm dev` → abrir `http://localhost:3000`
5. Registrarse en `/login` (crea cuenta + organización real en Clerk) → el webhook crea automáticamente la fila en `users`/`organizations` con rol `operario` por defecto.
6. Para probar otros roles sin crear 6 cuentas: `pnpm exec prisma studio`, buscar tu fila en `users`, cambiar el campo `role` manualmente (`admin`, `director_tecnico`, `calidad`, etc.), guardar y recargar la app.

### 6. Despliegue
Con Docker Compose (ver `DEPLOY.md`). Vercel solo sirve si se le da un PostgreSQL accesible desde internet.
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
