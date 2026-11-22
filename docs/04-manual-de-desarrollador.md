# Manual de desarrollador de CosmoQMS

Versión 1.0 · Para quien modifica el código. Lea antes el
[manual arquitectónico](03-manual-arquitectonico.md): explica las decisiones
que este manual da por sentadas.

## 1. Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | 24 o superior (`engines` en `package.json`) |
| pnpm | 12.6 (se activa con `corepack enable`; versión fijada en `packageManager`) |
| Docker + Docker Compose | Para la base de datos y las pruebas E2E |
| Git | — |
| Cuenta de Clerk | Instancia de **desarrollo** (no la de producción) |

## 2. Primer arranque

```bash
git clone https://github.com/jusgad/cosmoqms.git
cd cosmoqms
corepack enable
pnpm install
cp .env.example .env      # complete las llaves de Clerk de desarrollo y genere las dos contraseñas
docker compose up -d db migrate db-security
pnpm exec prisma generate
pnpm seed:demo            # datos de demostración (empresa demo-org)
pnpm dev                  # http://localhost:3000
```

En `.env`, para trabajar desde su máquina contra la base de Docker:

```
DATABASE_URL=postgresql://cosmoqms_runtime:<RUNTIME_DB_PASSWORD>@localhost:5433/cosmoqms
DIRECT_URL=postgresql://cosmoqms_app:<POSTGRES_PASSWORD>@localhost:5433/cosmoqms
```

`DATABASE_URL` usa el rol de la app, así desarrolla con RLS activo como en
producción. `DIRECT_URL` (el dueño) solo lo usa Prisma para migrar.

**Modo demo** (sesión sin Clerk, para capturas y E2E):

```bash
DEMO_ROLE=admin docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
```

App en `http://localhost:3001`. La cookie `cosmoqms-demo-role=<rol>` cambia el
rol por navegador. Solo funciona en `localhost`.

## 3. Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript sin emitir (`tsc --noEmit`) |
| `pnpm test` | Pruebas unitarias (Vitest) |
| `pnpm test:e2e` | Pruebas E2E (Playwright) contra Docker en modo demo |
| `pnpm exec prisma migrate dev --name <nombre>` | Crear y aplicar una migración |
| `pnpm exec prisma generate` | Regenerar el cliente de Prisma |
| `pnpm seed:demo` | Sembrar datos de demostración (idempotente) |

## 4. Reglas no negociables

Estas reglas protegen el cumplimiento BPM. Un cambio que rompa una no se acepta.

1. `batch_events` es solo inserción: nunca `UPDATE` ni `DELETE`. Una corrección es un evento nuevo.
2. Toda escritura sobre una tabla regulada (`production_orders`, `batch_events`,
   `qc_results`, `deviations`, `finished_product_lots`) pasa por `withTenant`,
   que escribe `audit_log` en la misma transacción.
3. Ninguna firma se guarda sin reautenticación verificada en el servidor
   (`assertReverified` o `has({ reverification: "strict" })`) y una declaración de significado.
4. Toda consulta corre dentro de `withTenant` y filtra por `tenantId`. La app
   nunca usa el rol dueño de la base.
5. TypeScript estricto, sin `any`.
6. Los eventos sin conexión usan `clientEventId` generado en el dispositivo; el
   servidor ignora los duplicados.
7. Las transiciones de etapa se validan en el servidor con la máquina de
   estados; nunca se confía en el estado que manda el cliente.
8. Una fórmula solo se activa si suma 100% ± la tolerancia.
9. Mobile-first, botones de al menos 44 × 44 px.
10. Nunca subir archivos `.env`.
11. Un componente por archivo, máximo 300 líneas.

## 5. Convenciones de código

- **Alias:** importe con `@/` (equivale a `src/`). Sin *barrel exports*:
  importe directo del archivo.
- **Server Components por defecto.** `"use client"` solo con interactividad
  real (formularios, escáner, firma).
- **Esquemas en `src/lib/validation/`.** Nunca importan `@/lib/db` ni
  `@/lib/trpc/trpc`: los componentes cliente los usan y no deben arrastrar
  Prisma al navegador. Un componente cliente nunca importa un router.
- **Componentes junto a su página** cuando son de una sola pantalla
  (`src/app/(app)/<modulo>/`); los reutilizables van en `src/components/<dominio>/`.
- **Un router por dominio** en `src/lib/trpc/router/`, unido en `_app.ts`. Los
  routers no se importan entre sí; la lógica compartida va en `src/lib/<dominio>/`.
- **Errores de dominio** con `TRPCError` (`NOT_FOUND`, `CONFLICT`,
  `BAD_REQUEST`...). Las rutas REST los traducen con `restError`.
- **Textos de la interfaz** en español; nombres de código y comentarios en inglés.
- **Diseño:** paleta, tipografía (Fira Sans / Fira Code), radios de 8 y 12 px,
  sin sombras decorativas, espaciado en múltiplos de 8 (ver `CLAUDE.md`).
- **Decimales de Prisma** (`Decimal`) no cruzan al cliente: conviértalos con
  `Number()` en el Server Component.

## 6. Cómo agregar una funcionalidad

1. **Modelo:** edite `prisma/schema.prisma` y cree la migración
   (`prisma migrate dev --name <nombre>`). Una tabla nueva con datos de
   empresa lleva `tenantId` e índice.
2. **Seguridad de la base:** agregue la política RLS de la tabla nueva en
   `db/rls.sql` (`enable` + `force` + política). El CI falla si una tabla
   queda sin RLS forzado. Si es solo inserción, revoque `UPDATE`/`DELETE` en
   `db/runtime-role.sql`.
3. **Validación:** el esquema Zod en `src/lib/validation/<dominio>.ts`.
4. **Servicio:** las reglas en `src/lib/<dominio>/`, recibiendo el
   `Prisma.TransactionClient` y filtrando por `tenantId`. Si la tabla es
   regulada, agréguela a `REGULATED_MODELS` en `src/lib/audit.ts`; si no, pero
   sus cambios importan para BPM, escriba `audit_log` explícitamente.
5. **Procedimiento:** en el router del dominio, con `roleProcedure(...roles)` y `tenantTx`.
6. **Pantalla:** página en `src/app/(app)/<modulo>/` que empieza con
   `requirePageRole(MODULE_ROLES.<modulo>)`. Los roles de cada módulo viven en
   un solo lugar, `src/lib/roles/modules.ts`, que usan también el menú
   (`Sidebar.tsx`, que solo lista la entrada) y la pantalla de roles. El
   administrador abre los módulos en solo lectura: nunca lo agregue a un
   procedimiento que pese, firme, libere, apruebe o reciba, y anote la acción
   nueva en `src/lib/roles/permissions.ts` (la prueba `modules.test.ts` vigila
   la separación de funciones).
7. **Pruebas:** unitarias del servicio y del router (permisos, empresa ajena,
   reglas) y, si es un flujo de usuario, una prueba E2E.
8. **Documentación:** manual de usuario y, si cambia un requisito, la URS y la
   [matriz de trazabilidad](validacion/06-matriz-de-trazabilidad.md). Una ruta
   REST nueva va en `docs/api/openapi.yaml` (la prueba `openapi.test.ts` falla si no).

## 7. Pruebas

### 7.1 Unitarias (Vitest)

En `src/**/__tests__/*.test.ts`. Los routers se prueban con `createCaller` y
un `withTenant` simulado:

```ts
vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, _actor: string, fn: (tx: unknown) => unknown) =>
    fn({ rawMaterial: { findMany, create } }),
}));
const caller = materialsRouter.createCaller({ user: { id: "u1", tenantId: "t1", role: "bodega" }, prisma: {} as never });
```

Use `vi.hoisted` para variables que el `vi.mock` necesite. Las pruebas que
necesitan DOM declaran `// @vitest-environment jsdom` al inicio del archivo.

Cada router nuevo debe probar al menos: sin sesión (`UNAUTHORIZED`), rol no
permitido (`FORBIDDEN`), registro de otra empresa (`NOT_FOUND`) y su regla principal.

### 7.2 E2E (Playwright)

En `e2e/*.spec.ts`, contra Docker en modo demo (sección 2):

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

- `asRole(context, "calidad")` (en `e2e/helpers.ts`) fija el rol de la prueba.
- `trpcCall(request, rol, "router.procedimiento", input)` llama a la API como el navegador.
- Las pruebas corren en serie y crean datos con códigos únicos, así que se
  pueden repetir sobre la misma base. Lo que no se puede aprobar en modo demo
  (firmas, aprobación de SOP) se prueba como rechazo sin reautenticación.
- El reporte queda en `playwright-report/`.

## 8. Integración continua

`.github/workflows/ci.yml` corre en cada push a `main` y en cada pull request:

| Trabajo | Qué verifica |
|---|---|
| Calidad del código | `pnpm install --frozen-lockfile`, lint, tipos, pruebas unitarias y `pnpm build` (Node 24) |
| Migraciones y seguridad de la base | Migraciones sobre un PostgreSQL vacío; falla si `schema.prisma` tiene cambios sin migración; aplica rol de la app y RLS dos veces; `scripts/verify-db-security.sh` |
| Pruebas E2E | Docker en modo demo + Playwright. Requiere los secretos `E2E_CLERK_PUBLISHABLE_KEY` y `E2E_CLERK_SECRET_KEY`; sin ellos se omite |

Antes de abrir un pull request corra localmente `pnpm lint`, `pnpm typecheck` y `pnpm test`.

## 9. Flujo de trabajo y control de cambios

1. Cree una rama desde `main`.
2. Haga el cambio con sus pruebas y documentación.
3. Abra un pull request: el CI debe pasar y otra persona lo revisa.
4. **Impacto en la validación:** indique en el PR qué requisitos (URS) toca.
   Calidad decide qué casos de OQ repetir antes de llevarlo a producción. Un
   cambio en firma, audit trail, liberación, permisos o seguridad de la base
   siempre repite esos casos.
5. Al fusionar a `main`, el administrador despliega según el
   [manual de administrador](05-manual-de-administrador.md#8-actualizar-a-una-versión-nueva).

Mensajes de commit con prefijo de tipo (`feat:`, `fix:`, `docs:`, `test:`,
`ci:`, `chore:`), en español, explicando el porqué.

## 10. Problemas frecuentes

| Problema | Solución |
|---|---|
| Una consulta devuelve vacío aunque hay datos | Corre fuera de `withTenant`: con RLS, sin empresa fijada no se ve nada |
| `permission denied` al actualizar `batch_events` o `audit_log` | Es correcto: son solo inserción. Inserte un evento compensatorio |
| Prisma en el bundle del navegador | Un componente cliente importa un router o `@/lib/db`; mueva el esquema a `lib/validation/` |
| El CI falla en "Migraciones y seguridad" | Falta la migración (`prisma migrate dev`) o la política RLS de una tabla nueva |
| `pnpm build` en Windows muestra `EPERM ... symlink` | Windows no deja crear enlaces simbólicos sin permisos de administrador; en Linux, CI y Docker no pasa |
| En Git Bash, `docker compose exec ... /scripts/x.sh` no encuentra el archivo | Git Bash convierte rutas: anteponga `MSYS_NO_PATHCONV=1` |
| Las pruebas de componentes no arrancan | Node menor a 24: Vitest 5 y jsdom 30 exigen Node reciente |
| La página redirige al Dashboard | El rol no está en `MODULE_ROLES` del módulo |
