# Manual técnico de CosmoQMS

Versión 1.0 · Describe de qué está hecho CosmoQMS, cómo se configura y qué
mecanismos técnicos protegen sus datos. El diseño y las decisiones de fondo
están en el [manual arquitectónico](03-manual-arquitectonico.md); la
instalación y la operación, en el [manual de administrador](05-manual-de-administrador.md).

## 1. Descripción general

CosmoQMS es un sistema de ejecución de manufactura y gestión de calidad
(MES/QMS) para un laboratorio cosmético, diseñado para cumplir BPM e INVIMA.
Registra el ciclo completo de un lote: recepción de materias primas,
fórmulas maestras, órdenes de producción, pesaje (también sin conexión),
firmas electrónicas, control de calidad, desviaciones, liberación,
trazabilidad, control de documentos (SOPs) y auditoría.

Es una aplicación web progresiva (PWA): funciona en navegador de computador,
tableta y celular, se puede instalar como app y sigue registrando pesajes sin señal.

## 2. Tecnologías y versiones

| Capa | Tecnología | Versión |
|---|---|---|
| Lenguaje | TypeScript (modo estricto) | 5 |
| Entorno de ejecución | Node.js | 24 LTS |
| Framework web | Next.js (App Router, React Server Components) | 15.5 |
| Interfaz | React | 19.1 |
| Estilos | Tailwind CSS · componentes base-ui/shadcn · íconos Lucide | 4 |
| API interna | tRPC + TanStack Query | 11 / 5 |
| Validación de datos | Zod | 4 |
| Acceso a datos | Prisma ORM | 6.19 |
| Base de datos | PostgreSQL | 16 |
| Identidad, sesiones y MFA | Clerk (Organizations) | @clerk/nextjs 7 |
| Modo sin conexión | Serwist (service worker) + Dexie (IndexedDB) | 9 / 4 |
| Generación de PDF | Playwright (Chromium sin interfaz) | 1.63 |
| Códigos QR de las etiquetas | qrcode (SVG en el servidor) | 1.5 |
| Almacenamiento de adjuntos | Disco local o S3 compatible (AWS SDK v3) | — |
| Correo | Resend (API HTTP) | — |
| Monitoreo de errores | Sentry | @sentry/nextjs 11 |
| Contenedores | Docker + Docker Compose; Caddy para HTTPS | Caddy 2.8 |
| Pruebas | Vitest (unitarias) · Playwright (E2E) | 5 / 1.63 |
| Integración continua | GitHub Actions | — |

## 3. Componentes desplegados

```
                Internet (HTTPS)
                      │
              ┌───────▼────────┐
              │  caddy :443    │  certificado automático, cabeceras de seguridad
              └───────┬────────┘
                      │ http
              ┌───────▼────────┐        ┌──────────────┐
              │ cosmoqms :3000 │──────► │ Clerk (SaaS) │ sesiones, MFA, webhooks
              │ Next.js + tRPC │        └──────────────┘
              └──┬─────────┬───┘
     rol sin     │         │ volumen
     privilegios │         ▼
              ┌──▼─────┐  cosmoqms-storage (adjuntos)
              │ db     │       ▲
              │ PG 16  │◄──────┤
              └──▲─────┘       │
                 │ dueño       │ solo lectura
              ┌──┴──────────────┴─┐
              │ backup (diario)   │──► backups/ en el servidor ──► copia externa
              └───────────────────┘
   Al arrancar: migrate (migraciones) → db-security (rol de la app + RLS)
```

| Servicio | Imagen | Puerto | Persistencia |
|---|---|---|---|
| `db` | `postgres:16-alpine` | `127.0.0.1:5433` (solo el servidor) | volumen `cosmoqms-db-data` |
| `migrate` | etapa `builder` del Dockerfile | — | — |
| `db-security` | `postgres:16-alpine` | — | — |
| `cosmoqms` | Dockerfile (Node 24, salida *standalone*, Chromium) | `3001 → 3000` | volumen `cosmoqms-storage` |
| `backup` | `postgres:16-alpine` | — | carpeta `BACKUP_DIR` del servidor |
| `caddy` (perfil `https`) | `caddy:2.8-alpine` | `80`, `443` | volúmenes `caddy-data`, `caddy-config` |

## 4. Configuración (variables de entorno)

Se definen en `.env` (nunca en git; plantilla en `.env.example`).

| Variable | Obligatoria | Descripción |
|---|---|---|
| `POSTGRES_PASSWORD` | Sí | Contraseña del dueño de la base (`cosmoqms_app`), solo para migraciones y respaldos |
| `RUNTIME_DB_PASSWORD` | Sí | Contraseña del rol de la app (`cosmoqms_runtime`), sujeto a RLS |
| `DATABASE_URL`, `DIRECT_URL` | Solo fuera de Docker | Conexión para Prisma o desarrollo local; dentro de Docker las arma `docker-compose.yml` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Sí | Llaves de Clerk |
| `CLERK_WEBHOOK_SECRET` | Sí | Verificación de los webhooks de Clerk |
| `NEXT_PUBLIC_APP_URL` | Sí | URL pública (enlaces en correos, modo demo) |
| `APP_DOMAIN` | Con HTTPS | Dominio para Caddy |
| `RESEND_API_KEY`, `NOTIFICATIONS_FROM_EMAIL` | No | Correo de notificaciones; sin ellas solo hay bandeja en la app |
| `STORAGE_DRIVER` | No | `local` (por defecto) o `s3` |
| `STORAGE_LOCAL_DIR` | No | Carpeta de adjuntos con `local` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Con `s3` | Bucket de adjuntos (AWS S3, MinIO, Cloudflare R2) |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` | No | Monitoreo de errores |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | No | Subida de *source maps* en el build |
| `BACKUP_DIR`, `BACKUP_HOUR`, `BACKUP_RETENTION_DAYS` | No | Respaldos (por defecto `./backups`, 2 a. m., 30 días) |
| `DEMO_MODE`, `DEMO_ROLE` | Nunca en producción | Solo demostración, con `docker-compose.demo.yml` y en `localhost` |

## 5. Modelo de datos

Fuente de verdad: `prisma/schema.prisma`. Todas las tablas de negocio tienen
`tenant_id` (la empresa) o se aíslan por su tabla madre.

| Área | Tablas | Notas |
|---|---|---|
| Empresa y personas | `organizations`, `users` | El rol vive en `users.role`; `active` corta el acceso |
| Materias primas | `raw_materials`, `raw_material_lots` | Lote: cuarentena → liberado / rechazado; QR interno único; el pesaje descuenta `quantity_available`; un lote vencido no se libera ni se pesa |
| Fórmulas | `master_formulas`, `formula_ingredients` | Versión; borrador → activa solo si suma 100% ± 0,5%; al activar la versión N+1 la N queda archivada |
| Producción | `production_orders`, `batch_events`, `batch_signatures` | Eventos *append-only*; una firma por etapa y orden |
| Calidad | `qc_specifications`, `qc_results`, `deviations`, `finished_product_lots` | Veredicto calculado en el servidor |
| Documentos | `sops`, `sop_acknowledgments` | Borrador → vigente → obsoleto; una lectura por persona y versión |
| Soporte | `audit_log`, `notifications`, `attachments` | Audit trail y adjuntos *append-only* |

**Tablas reguladas** (cada cambio se audita en la misma transacción):
`production_orders`, `batch_events`, `qc_results`, `deviations`,
`finished_product_lots`. Además se auditan los cambios de `users`, `sops` y
`organizations`.

Los cambios de estructura se hacen solo con migraciones de Prisma
(`prisma/migrations/`), que el servicio `migrate` aplica al arrancar.

## 6. Interfaces

| Interfaz | Uso | Documentación |
|---|---|---|
| Aplicación web | Personal del laboratorio | [Manual de usuario](01-manual-de-usuario.md) |
| API REST `/api/v1` | Integraciones (catálogo de materias primas) | [OpenAPI 3.1](api/openapi.yaml) |
| `/api/health` | Monitores de disponibilidad (pública) | OpenAPI |
| `/api/reports/produccion`, `/api/reports/accesos`, `/api/pdf/batch/{id}`, `/api/pdf/lot-label/{id}`, `/api/attachments` | Reporte BPM, revisión de accesos, batch record, etiqueta con QR y adjuntos | OpenAPI |
| `/api/trpc/*` | Interna, solo la usa la interfaz | — |
| `/api/sync/events` | Interna, sincronización del modo sin conexión | — |
| `/api/webhooks/clerk` | Entrada de eventos de Clerk (firmados con Svix) | — |

## 7. Mecanismos de seguridad e integridad

| Mecanismo | Implementación |
|---|---|
| Autenticación | Clerk: sesión en cookie, MFA con aplicación autenticadora |
| Autorización por rol | Seis roles. Qué rol abre cada módulo está en un solo lugar (`src/lib/roles/modules.ts`), que usan el menú y las páginas (`requirePageRole`); cada procedimiento tRPC (`roleProcedure`) y ruta REST valida además el rol de la acción en el servidor |
| Separación de funciones | El administrador abre todos los módulos en modo supervisión (solo lectura); ningún procedimiento de pesaje, firma, liberación, aprobación o recepción lo admite. Pantalla `/roles` con la matriz de permisos (`src/lib/roles/permissions.ts`) |
| Revisión de accesos | `/usuarios/revision`: rol, MFA y último ingreso (consultado en Clerk) de cada cuenta, con hallazgos y exportación CSV |
| Aislamiento por empresa | Dos barreras: filtro por `tenant_id` en cada consulta y Row Level Security forzado en las 18 tablas (`db/rls.sql`) |
| Mínimo privilegio en la base | La app se conecta como `cosmoqms_runtime`: sin superusuario, sin BYPASSRLS, sin ser dueño, sin `UPDATE`/`DELETE` en `batch_events`, `audit_log` y `attachments` |
| Audit trail | Extensión de Prisma que escribe `audit_log` (antes/después, usuario, hora) en la misma transacción de cada escritura regulada |
| Firma electrónica | Reautenticación de Clerk de nivel *strict* verificada en el servidor, declaración de significado guardada y rol por etapa |
| Máquina de estados | Las etapas del lote avanzan solo según reglas del servidor; nunca se acepta el estado enviado por el cliente |
| Sin duplicados offline | Cada evento lleva `clientEventId` generado en el dispositivo, con índice único en la base |
| Adjuntos | Máximo 10 MB; el servidor verifica el tipo real del archivo (PDF, PNG, JPEG, WebP); no se reemplazan ni se borran |
| Transporte | HTTPS con HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |
| Secretos | Solo en `.env`; la base solo escucha en el propio servidor |
| Respaldos | Diarios, con verificación de lectura, SHA-256, retención y simulacro de restauración |

## 8. Modo sin conexión

- El *service worker* (`src/app/sw.ts`) guarda la aplicación en caché para abrirla sin red.
- El pesaje escribe primero en IndexedDB (`src/lib/offline/`) como un evento con su `clientEventId`.
- El motor de sincronización envía los eventos pendientes a `/api/sync/events`
  al recuperar la conexión. El servidor los aplica en orden, una sola vez, y
  responde `accepted` o `duplicate` por cada uno.

## 9. Calidad del software

| Control | Alcance |
|---|---|
| Pruebas unitarias (Vitest) | 55 archivos, 376 pruebas: reglas de negocio, routers, seguridad, reportes, contrato OpenAPI, lectura del QR del proveedor, especificaciones de calidad, versionado de fórmulas, inventario y vencimientos, batch record, etiquetas, revisión de accesos, pendientes y acciones rápidas por rol y matriz de permisos |
| Pruebas E2E (Playwright) | 42 pruebas con navegador real contra Docker: flujo BPM completo, permisos de los 6 roles en escritorio y celular, SOPs, usuarios, API y reportes |
| Integración continua | En cada cambio: lint, tipos, pruebas, build, migraciones en una base vacía y verificación de seguridad de la base |
| Validación | Paquete IQ/OQ/PQ en [validacion/](validacion/01-plan-maestro-validacion.md) |

## 10. Límites conocidos

- El PDF necesita Chromium: funciona en la imagen Docker, no en funciones *serverless* (por ejemplo Vercel).
- La firma con reautenticación real solo se prueba con cuentas reales de Clerk (caso manual de la OQ).
- Una empresa por instalación en la interfaz actual; el modelo de datos ya es multiempresa.
- El plan gratis de Clerk admite 5 personas por organización. Con la organización llena, el webhook
  registra el motivo en el log ("límite de miembros de Clerk") y **Usuarios** lo advierte; para más
  personas hay que liberar cupos o ampliar el plan.
- Las reglas de negocio fijas (tolerancia de fórmula 100% ± 0,5%, flujo de firma) se cambian solo por control de cambios, no desde la configuración.

## 11. Datos de demostración en una organización real

`prisma/seed-demo.ts` siembra seis meses de historia (materias primas con sus
lotes, fórmulas F-001 y F-002 con especificaciones, 14 órdenes, desviaciones y
SOPs) en `demo-org`. Con la variable `SEED_TENANT_ID` la siembra en una
organización real de Clerk, para una presentación con usuarios reales: la
historia queda firmada por cinco usuarios "históricos" inactivos con ids
propios de esa empresa, que no pueden iniciar sesión, y no se tocan los datos de
la empresa guardados en Configuración. Se niega a correr con
`NODE_ENV=production` y no hace nada si la empresa ya tiene órdenes.

```powershell
docker compose run --rm -T -v "${PWD}\prisma:/app/prisma" -v "${PWD}\src:/app/src" -e SEED_TENANT_ID=org_xxx migrate pnpm exec tsx prisma/seed-demo.ts
```
