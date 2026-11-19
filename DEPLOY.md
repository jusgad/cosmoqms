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

Copia `.env.example` a `.env` y llena como mínimo las llaves de Clerk:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
```

`DATABASE_URL` y `DIRECT_URL` dentro de los contenedores las fija
`docker-compose.yml` (apuntan al servicio `db`). En `.env` solo hacen falta
para correr Prisma o `pnpm dev` desde tu máquina, contra el puerto publicado:

```
DATABASE_URL=postgresql://cosmoqms_app:<contraseña>@localhost:5433/cosmoqms
DIRECT_URL=postgresql://cosmoqms_app:<contraseña>@localhost:5433/cosmoqms
```

> Antes de un despliegue real, cambia la contraseña de `POSTGRES_PASSWORD` en
> `docker-compose.yml` (y en las URLs) por una generada y guárdala fuera del
> repo. Nunca se commitea `.env`.

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
docker compose up -d --build
```

Orden de arranque:
1. `db` — PostgreSQL, espera a estar sano (`pg_isready`).
2. `migrate` — corre `prisma migrate deploy` y termina.
3. `cosmoqms` — la app en `http://localhost:3001`, con healthcheck en `/api/health`.

Datos de demostración (opcional, solo entornos de prueba):

```bash
pnpm seed:demo
```

## PASO 4 — Seguridad entre empresas (RLS)

`db/rls.sql` trae las políticas de Row Level Security por `tenant_id`. Para que
apliquen de verdad, la app **no** puede conectarse con el usuario dueño de las
tablas (`cosmoqms_app` en compose es superusuario y se salta RLS):

1. Crear el rol de ejecución con la plantilla comentada al final de `db/rls.sql`
   (`cosmoqms_runtime`: sin superusuario, sin BYPASSRLS, sin ser dueño).
2. Aplicar el archivo como dueño:
   `docker compose exec -T db psql -U cosmoqms_app -d cosmoqms < db/rls.sql`
3. Cambiar `DATABASE_URL` del servicio `cosmoqms` al rol `cosmoqms_runtime`;
   `DIRECT_URL` (migraciones) sigue con el dueño.
4. Verificar: `select rolsuper, rolbypassrls from pg_roles where rolname = current_user;` → `f, f`.

## PASO 5 — Producción

- Quitar `DEMO_MODE` y `DEMO_ROLE` del servicio `cosmoqms` (son solo para demo
  y capturas; nunca en producción).
- Poner un proxy con HTTPS delante del puerto 3001 (Caddy, Nginx o Traefik) y
  apuntar el dominio de la empresa.
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
