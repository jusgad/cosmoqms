# Despliegue de CosmoQMS — PostgreSQL propio en Docker

CosmoQMS corre con su propia base de datos PostgreSQL 16 dentro de Docker.
No depende de ningún proveedor de base de datos administrada: la app, las
migraciones y la base se levantan juntas con `docker compose`.

---

## Qué se usa

| Pieza | Para qué |
|---|---|
| Docker + Docker Compose | Levantar base de datos, migraciones y app |
| PostgreSQL 16 (`postgres:16-alpine`) | Base de datos, con volumen persistente `cosmoqms-db-data` |
| Clerk | Login, usuarios, organizaciones y MFA |
| Volumen `cosmoqms-storage` | Archivos adjuntos (`STORAGE_DRIVER=local`) |

---

## PASO 1 — Variables de entorno

Copia `.env.example` a `.env` y llena:

```
POSTGRES_PASSWORD=      # openssl rand -hex 24  (dueño de las tablas)
RUNTIME_DB_PASSWORD=    # openssl rand -hex 24  (rol de la app, sujeto a RLS)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=https://<tu-dominio>
APP_DOMAIN=<tu-dominio>
```

Compose no arranca si faltan las dos contraseñas. Dentro de los contenedores
`DATABASE_URL`/`DIRECT_URL` las arma `docker-compose.yml`; en `.env` solo
hacen falta para correr Prisma o `pnpm dev` desde tu máquina (ver
`.env.example`). Nunca se commitea `.env`.

> Si la base ya existía con otra contraseña, el volumen conserva la vieja:
> cámbiala con `docker compose exec db psql -U cosmoqms_app -d cosmoqms -c "ALTER ROLE cosmoqms_app PASSWORD '<nueva>'"`.
> La de `cosmoqms_runtime` se aplica sola en cada arranque.

## PASO 2 — Clerk

1. En **clerk.com** → tu aplicación → **Organizations**: debe estar activado.
2. **Multi-factor** → activar "Authenticator application".
3. **API Keys** → copiar Publishable key y Secret key al `.env`.
4. **Webhooks** → Add Endpoint → `https://<tu-dominio>/api/webhooks/clerk`,
   eventos `organization.created`, `user.created`, `user.updated` (sincroniza
   la marca de MFA), `organizationMembership.created`,
   `organizationMembership.updated`.
   Copiar el Signing Secret a `CLERK_WEBHOOK_SECRET`.

### Primer administrador

Todo usuario nuevo entra como `operario`. Después del primer registro, nombra al
primer administrador una sola vez desde la consola (como dueño de la base):

```bash
docker compose exec db psql -U cosmoqms_app -d cosmoqms -c "update users set role = 'admin' where email = '<correo>'"
```

Desde ahí los roles se cambian en **Usuarios** (`/usuarios`), con auditoría. El
rol que traiga la metadata de Clerk solo se usa al crear el usuario; el webhook
nunca lo vuelve a sobrescribir.

## PASO 3 — Levantar todo

```bash
docker compose --profile https up -d --build
```

Orden de arranque:
1. `db` — PostgreSQL 16, publicado solo en `127.0.0.1:5433`.
2. `migrate` — `prisma migrate deploy` como dueño de las tablas.
3. `db-security` — crea/actualiza el rol `cosmoqms_runtime` (`db/runtime-role.sql`) y aplica RLS (`db/rls.sql`) en todas las tablas.
4. `cosmoqms` — la app, conectada como `cosmoqms_runtime`, en el puerto 3001.
5. `caddy` — HTTPS en 443 (y redirección desde 80) para `APP_DOMAIN`. Con un dominio real que apunte al servidor, el certificado de Let's Encrypt es automático; con `localhost` usa un certificado local.

Sin `--profile https` se levanta todo menos Caddy (app en `http://localhost:3001`).

## PASO 4 — Comprobar la seguridad de la base

```bash
docker compose exec db psql -U cosmoqms_app -d cosmoqms -c "select rolname, rolsuper, rolbypassrls from pg_roles where rolname like 'cosmoqms%'"
```

`cosmoqms_runtime` debe salir con `f | f`. Con ese rol, una consulta sin
tenant no ve filas, no se pueden leer ni insertar filas de otra empresa, y
`batch_events`/`audit_log`/`attachments` no aceptan `UPDATE` ni `DELETE`.

## PASO 5 — Modo demo (solo capturas y Postman)

```bash
DEMO_ROLE=admin docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
```

Abre una sesión sin Clerk con el rol indicado. Solo funciona con
`docker-compose.demo.yml` y solo si la app corre en `localhost`
(`src/lib/demoMode.ts`): en un dominio real se ignora aunque alguien copie
`DEMO_MODE=true`. El `docker-compose.yml` normal lo fuerza a `false`.

### Pruebas de extremo a extremo (E2E)

Con el stack en modo demo arriba:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Recorren con navegador real el flujo BPM (recepción → liberación de lotes →
fórmula al 100% → orden → pesaje → firma que exige reautenticación), los
permisos de cada rol en escritorio y celular, SOPs (borrador, aprobación con
firma, lectura del personal), configuración, paginación, usuarios,
la API REST y el reporte BPM. Crean datos con códigos únicos, así que se
pueden repetir sobre la misma base. El reporte queda en `playwright-report/`.

## PASO 6 — Backups

El servicio `backup` arranca con el resto del stack. Cada día a las
`BACKUP_HOUR` (2:00 a. m. por defecto, hora de Bogotá):

1. `pg_dump` de la base en `backups/base-de-datos/` y comprobación de que el
   archivo se puede leer (`pg_restore --list`).
2. Los adjuntos (COA, evidencias, documentos de SOP) en `backups/adjuntos/`.
3. Suma SHA-256 de cada archivo y borrado de los de más de
   `BACKUP_RETENTION_DAYS` días (30 por defecto).

Si el último respaldo correcto tiene más de 26 horas, `docker compose ps`
muestra el servicio `backup` como **unhealthy**.

**Copia fuera del servidor (obligatoria):** un backup en la misma máquina se
pierde con ella. Copia la carpeta `BACKUP_DIR` a diario a otro lugar: disco
externo, NAS o nube (por ejemplo con `rclone sync` o una tarea programada).

**Simulacro de restauración (cada trimestre, guardar la salida como
evidencia BPM):**

```bash
docker compose exec backup sh /scripts/restore-test.sh
```

Restaura el último respaldo en una base temporal, verifica la suma SHA-256,
compara las filas de cada tabla con la base actual y borra la base temporal.

**Restaurar de verdad** (pérdida de datos), con la app detenida:

```bash
docker compose stop cosmoqms
docker compose exec backup sh -c 'dropdb cosmoqms && createdb cosmoqms && pg_restore --no-owner --dbname=cosmoqms /backups/base-de-datos/<archivo>.dump'
docker compose up -d
```

`docker compose up` vuelve a aplicar el rol de la app y RLS (`db-security`).
Los adjuntos se recuperan descomprimiendo el `.tar.gz` en el volumen
`cosmoqms-storage`.

## PASO 7 — Monitoreo

- **Salud:** `/api/health` responde si la app y la base están arriba. Docker
  reinicia la app y la marca unhealthy si deja de responder.
- **Caídas del servidor:** un monitor externo gratuito (UptimeRobot, Better
  Stack) que consulte `https://<tu-dominio>/api/health` cada 5 minutos y avise
  por correo o Telegram. Tiene que ser externo: si se apaga el servidor, nada
  de adentro puede avisar.
- **Errores de la app:** crea un proyecto en Sentry y pon `SENTRY_DSN` y
  `NEXT_PUBLIC_SENTRY_DSN` en `.env`. Sin DSN no se envía nada.
- **Correos de notificación:** `RESEND_API_KEY` y `NOTIFICATIONS_FROM_EMAIL`.

## PASO 8 — Integración continua

`.github/workflows/ci.yml` corre en cada push a `main` y en cada pull request:

- **Calidad del código:** lint, tipos, pruebas unitarias y build de producción.
- **Base de datos:** aplica las migraciones a un PostgreSQL vacío, falla si
  `schema.prisma` tiene cambios sin migración, aplica el rol de la app y RLS
  dos veces (deben ser idempotentes) y corre `scripts/verify-db-security.sh`.
- **E2E:** levanta Docker en modo demo y corre Playwright. Necesita los
  secretos `E2E_CLERK_PUBLISHABLE_KEY` y `E2E_CLERK_SECRET_KEY` (llaves de
  desarrollo de Clerk) en GitHub → Settings → Secrets and variables → Actions;
  sin ellos el trabajo se omite con un aviso.

Para que nada llegue a `main` sin pasar el CI: GitHub → Settings → Branches →
regla para `main` con "Require status checks to pass".

La misma verificación de seguridad contra el Docker local:

```bash
docker compose exec -T -e RUNTIME_DB_PASSWORD=<la de .env> db sh < scripts/verify-db-security.sh
```

## Comandos útiles

| Acción | Comando |
|---|---|
| Ver estado | `docker compose ps` |
| Logs de la app | `docker compose logs -f cosmoqms` |
| Consola SQL | `docker compose exec db psql -U cosmoqms_app -d cosmoqms` |
| Backup | `docker compose exec -T db pg_dump -U cosmoqms_app cosmoqms > backup.sql` |
| Apagar (conserva datos) | `docker compose down` |
| Borrar todo, incluida la base | `docker compose down -v` (irreversible) |

## Nota sobre Vercel

Vercel no puede alojar este PostgreSQL en Docker. Para seguir usando Vercel hay
que darle una base PostgreSQL accesible desde internet (un servidor propio con
Docker o cualquier Postgres administrado) y configurar ahí `DATABASE_URL` y
`DIRECT_URL`. Además, el PDF con Playwright no funciona en funciones
serverless; la imagen Docker sí trae Chromium.
