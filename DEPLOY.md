# Despliegue de CosmoQMS — paso a paso, 100% gratis

> Sigue los pasos en orden. Cuando un paso dice "avísame", escríbeme en el chat
> para que yo continúe desde ahí — algunos pasos los hago yo (migraciones, aplicar
> seguridad), otros los haces tú (crear cuentas, pegar llaves).

---

## Resumen de lo que vamos a usar (todo gratis)

| Servicio | Para qué | Costo |
|---|---|---|
| Supabase | Base de datos Postgres | Gratis |
| Clerk | Login, usuarios, organizaciones | Gratis |
| GitHub | Código (ya lo tienes) | Gratis |
| Vercel | Hospedar la app en internet | Gratis (plan Hobby) |

---

## PASO 1 — Crear el proyecto en Supabase

1. Entra a **https://supabase.com** → inicia sesión o crea cuenta.
2. Click **"New Project"**.
3. Nombre: `cosmoqms` (o el que quieras).
4. Contraseña de la base de datos: genera una segura y **guárdala en un lugar seguro** (la necesitarás si algo falla y tienes que reconectar manualmente).
5. Región: la más cercana a Colombia disponible (`South America (São Paulo)` si aparece, si no `US East`).
6. Click **"Create new project"** y espera ~2 minutos a que se aprovisione.

### Copiar las credenciales
1. Una vez creado, ve a **⚙️ Project Settings** (ícono de engranaje, abajo a la izquierda) → **Database**.
2. Busca la sección **"Connection string"**:
   - Pestaña **"Transaction"** (pooled) → copia la URL completa → esto va en `DATABASE_URL`.
   - Pestaña **"Session"** o el link de **"Direct connection"** → copia esa URL → esto va en `DIRECT_URL`.
   - Ambas traen `[YOUR-PASSWORD]` como placeholder — reemplázalo por la contraseña que generaste en el paso anterior.
3. Ve a **⚙️ Project Settings → API**.
4. Copia el valor de **"service_role"** (bajo "Project API keys") → esto va en `SUPABASE_SERVICE_ROLE_KEY`.

### Pegar en tu proyecto
Abre `C:\Users\sebas\Documents\Cosmoqms\.env` y pega los 3 valores:
```
DATABASE_URL=<la url de Transaction que copiaste>
DIRECT_URL=<la url de Direct connection que copiaste>
SUPABASE_SERVICE_ROLE_KEY=<la service_role key>
```

**→ Avísame cuando esto esté hecho.** Yo corro la migración (`prisma migrate dev`) para crear las tablas.

---

## PASO 2 — Confirmar Clerk (login y usuarios)

1. Entra a **https://clerk.com** → tu aplicación (o crea una si no existe: "Create application", nombre `CosmoQMS`).
2. En el menú lateral, ve a **"Organizations"** → confirma que esté **activado** (toggle en verde). Esto es obligatorio: sin esto el sistema multi-empresa no funciona.
3. Ve a **"Multi-factor"** (bajo "User & Authentication") → confirma que **"Authenticator application"** esté activado como opción disponible.
4. Ve a **"API Keys"** → copia:
   - **Publishable key** → va en `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret key** → va en `CLERK_SECRET_KEY`
5. Pega ambas en tu `.env` (igual que el paso 1).

El **Webhook** (`CLERK_WEBHOOK_SECRET`) lo configuramos en el **Paso 6**, porque necesita la URL real de tu app en Vercel, que todavía no existe.

**→ Avísame cuando tengas las 2 llaves de Clerk puestas.**

---

## PASO 3 — Migrar la base de datos (lo hago yo)

Cuando confirmes los pasos 1 y 2, yo corro:
```bash
pnpm exec prisma migrate dev --name init
```
Esto crea todas las tablas en tu Supabase real. Te confirmo cuando esté listo.

---

## PASO 4 — Aplicar seguridad entre empresas (RLS)

Esto evita que una empresa vea los datos de otra. Requiere un paso manual tuyo porque hay que crear un usuario de base de datos especial (sin privilegios de superusuario):

1. En Supabase, ve a **SQL Editor** (menú lateral).
2. Yo te paso el comando SQL exacto para crear el rol — lo pegas ahí y ejecutas.
3. Actualizas `DATABASE_URL`/`DIRECT_URL` en `.env` para que usen ese rol nuevo en vez del rol `postgres` por defecto.
4. Yo aplico el archivo `supabase/rls.sql` (ya está en el proyecto, ya corregido) contra tu base.

**→ Cuando lleguemos aquí te doy el comando SQL exacto, paso por paso.**

---

## PASO 5 — Subir el código a Vercel

1. Entra a **https://vercel.com** → inicia sesión con tu cuenta de **GitHub**.
2. Click **"Add New..."** → **"Project"**.
3. Busca y selecciona el repositorio **`cosmoqms`** (el que ya tienes en `github.com/jusgad/cosmoqms`) → click **"Import"**.
4. En la pantalla de configuración:
   - **Root Directory**: déjalo en blanco / el valor por defecto (el proyecto está en la raíz del repo).
   - **Framework Preset**: debería detectar "Next.js" automáticamente.
5. Antes de darle "Deploy", abre la sección **"Environment Variables"** y agrega **cada una** de estas (con los valores reales de tu `.env`):
   ```
   DATABASE_URL
   DIRECT_URL
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   CLERK_SECRET_KEY
   CLERK_WEBHOOK_SECRET   <- deja esto vacío por ahora, lo llenamos en el paso 6
   NEXT_PUBLIC_APP_URL    <- déjalo vacío por ahora también
   ```
6. Click **"Deploy"** y espera (~2-3 minutos).
7. Al terminar, Vercel te muestra una URL tipo `https://cosmoqms-xxxxx.vercel.app` — **cópiala**.

---

## PASO 6 — Conectar el webhook de Clerk con tu URL real

1. Vuelve a `.env` **local** y a las variables de entorno en **Vercel**: pon `NEXT_PUBLIC_APP_URL` = la URL que copiaste (ej. `https://cosmoqms-xxxxx.vercel.app`).
2. En Clerk → **"Webhooks"** → **"Add Endpoint"**.
3. URL del endpoint: `https://cosmoqms-xxxxx.vercel.app/api/webhooks/clerk` (con tu URL real).
4. Eventos a marcar: `organization.created`, `user.created`, `organizationMembership.created`, `organizationMembership.updated`.
5. Click **"Create"**. Copia el **"Signing Secret"** que te muestra.
6. Pégalo como `CLERK_WEBHOOK_SECRET` tanto en tu `.env` local como en las variables de entorno de Vercel.
7. En Vercel → pestaña **"Deployments"** → en el último deploy, menú **"⋯"** → **"Redeploy"** (para que tome la variable nueva).

---

## PASO 7 — Probar que todo funciona

1. Abre tu URL de Vercel en el navegador.
2. Click en **registrarte** → crea tu cuenta y tu organización (esto lo hace Clerk).
3. Al entrar, tu usuario queda con rol `operario` por defecto (el más limitado, por diseño).
4. Para probar otros roles (admin, calidad, director técnico, etc.): yo corro `pnpm exec prisma studio` apuntando a tu base de producción, buscas tu usuario en la tabla `users`, y le cambias el campo `role` manualmente.
5. Recorremos juntos el flujo completo: recibir materia prima → crear fórmula → activarla → crear orden → pesar → firmar → QC → liberar lote.

---

## Nota aparte: el PDF del batch record

La función de descargar PDF usa un navegador real (Playwright/Chromium) para generarlo. Eso **no funciona de fábrica** en el plan gratuito de Vercel — lo arreglamos en un paso extra cuando lleguemos ahí, cambiando a una versión "liviana" de Chromium compatible con funciones serverless. No bloquea el resto de la app.

---

### ¿Por dónde seguimos?

Empezamos por el **Paso 1** (Supabase). Avísame cuando tengas las credenciales pegadas en `.env` y seguimos.
