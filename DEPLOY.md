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
   eventos `organization.created`, `user.created`,
   `organizationMembership.created`, `organizationMembership.updated`.
   Copiar el Signing Secret a `CLERK_WEBHOOK_SECRET`.

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

## PASO 6 — Producción

- Backups: `pg_dump` diario del contenedor `db` hacia almacenamiento externo, y
  una restauración de prueba cada trimestre (requisito BPM de integridad de datos).
- Opcional: `SENTRY_DSN` para monitoreo de errores y `RESEND_API_KEY` para
  correos de notificación.

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
