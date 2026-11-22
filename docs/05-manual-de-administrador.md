# Manual de administrador de CosmoQMS

Versión 1.0 · Para la persona que instala, opera y mantiene CosmoQMS en el
servidor del laboratorio. Para entender cómo está construido el sistema vea el
[manual técnico](02-manual-tecnico.md); para la operación diaria de cada rol,
el [manual de usuario](01-manual-de-usuario.md).

## Contenido

1. [Qué administra](#1-qué-administra)
2. [Requisitos del servidor](#2-requisitos-del-servidor)
3. [Instalación](#3-instalación)
4. [Usuarios y accesos](#4-usuarios-y-accesos)
5. [Datos de la empresa](#5-datos-de-la-empresa)
6. [Respaldos y restauración](#6-respaldos-y-restauración)
7. [Monitoreo](#7-monitoreo)
8. [Actualizar a una versión nueva](#8-actualizar-a-una-versión-nueva)
9. [Seguridad](#9-seguridad)
10. [Tareas periódicas](#10-tareas-periódicas)
11. [Solución de problemas](#11-solución-de-problemas)
12. [Comandos de referencia](#12-comandos-de-referencia)

---

## 1. Qué administra

CosmoQMS corre en un servidor propio con Docker. Todos los datos (base de
datos, adjuntos y respaldos) quedan en ese servidor; la única pieza externa es
**Clerk**, el servicio de inicio de sesión, usuarios y MFA.

| Servicio de Docker | Qué hace |
|---|---|
| `db` | PostgreSQL 16, la base de datos. Solo acepta conexiones desde el propio servidor |
| `migrate` | Al arrancar, aplica los cambios de estructura de la base y termina |
| `db-security` | Al arrancar, crea el usuario de la app y activa la seguridad por empresa (RLS) y termina |
| `cosmoqms` | La aplicación web |
| `backup` | Respaldo diario de la base y los adjuntos |
| `caddy` | HTTPS con certificado automático para el dominio |

## 2. Requisitos del servidor

| Recurso | Mínimo | Recomendado |
|---|---|---|
| Sistema | Linux con Docker 24+ y Docker Compose v2 | Ubuntu Server LTS |
| CPU / RAM | 2 núcleos / 4 GB | 4 núcleos / 8 GB |
| Disco | 40 GB | 100 GB SSD (crece con adjuntos y respaldos) |
| Red | Dominio propio apuntando al servidor; puertos 80 y 443 abiertos | IP fija |
| Respaldo externo | Un destino fuera del servidor: disco, NAS o nube | Copia diaria automática |

Los usuarios solo necesitan un navegador actualizado (Chrome, Edge, Safari o
Firefox) en computador, tableta o celular.

## 3. Instalación

### 3.1 Obtener el sistema

```bash
git clone https://github.com/jusgad/cosmoqms.git
cd cosmoqms
```

### 3.2 Configurar Clerk

1. En **clerk.com**, cree la aplicación de producción.
2. **Organizations**: actívelo.
3. **Multi-factor**: active "Authenticator application" y, si su plan lo
   permite, exija MFA.
4. **API Keys**: copie la *Publishable key* y la *Secret key*.
5. **Webhooks** → Add Endpoint → `https://<su-dominio>/api/webhooks/clerk` con
   los eventos `organization.created`, `user.created`, `user.updated`,
   `organizationMembership.created` y `organizationMembership.updated`.
   Copie el *Signing Secret*.

### 3.3 Variables de entorno

Copie `.env.example` a `.env` y complete como mínimo:

```
POSTGRES_PASSWORD=          # openssl rand -hex 24
RUNTIME_DB_PASSWORD=        # openssl rand -hex 24 (distinta de la anterior)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=https://<su-dominio>
APP_DOMAIN=<su-dominio>
```

Opcionales: `RESEND_API_KEY` y `NOTIFICATIONS_FROM_EMAIL` (correos de
notificación), `SENTRY_DSN` y `NEXT_PUBLIC_SENTRY_DSN` (monitoreo de errores),
`BACKUP_DIR`, `BACKUP_HOUR` y `BACKUP_RETENTION_DAYS` (respaldos).

El archivo `.env` contiene secretos: solo lo lee el administrador, nunca se
sube a git ni se envía por correo. Guarde una copia de las contraseñas en el
gestor de contraseñas de la empresa.

### 3.4 Levantar el sistema

```bash
docker compose --profile https up -d --build
docker compose ps
```

Al terminar, `db`, `cosmoqms`, `backup` y `caddy` deben verse `Up (healthy)`, y
`migrate` y `db-security` terminados sin error. Abra `https://<su-dominio>`.

### 3.5 Primer administrador

Todo usuario nuevo entra como **Operario**. Después de registrarse la persona
que será administradora, nómbrela una sola vez desde la consola:

```bash
docker compose exec db psql -U cosmoqms_app -d cosmoqms -c "update users set role = 'admin' where email = '<correo>'"
```

Desde ese momento todos los roles se asignan en la pantalla **Usuarios**.

### 3.6 Calificación de instalación (IQ)

Antes de usar el sistema con producto real, ejecute la IQ del paquete de
validación:

```bash
APP_URL=https://<su-dominio> bash scripts/iq-evidencia.sh
```

Siga el protocolo [VAL-IQ-001](validacion/03-protocolo-iq.md) y adjunte el
archivo de evidencia que genera el script.

## 4. Usuarios y accesos

| Acción | Cómo |
|---|---|
| Alta | La persona se registra en la app; aparece en **Usuarios** como Operario |
| Asignar rol | **Usuarios** → elegir el rol en la lista → confirmar |
| Baja o retiro | **Usuarios** → **Desactivar** (el acceso se corta de inmediato) |
| Reactivar | **Usuarios** → **Reactivar** |
| Verificar MFA | **Usuarios** muestra "MFA activo" en cada cuenta que lo tiene |
| Consultar qué hace cada rol | **Roles y permisos**: matriz de acciones por rol y personas activas por rol |
| Revisión de accesos | **Usuarios** → **Revisión de accesos**: hallazgos (sin MFA, nunca ingresó, más de 90 días sin ingresar) y CSV como evidencia |
| Ver el historial | **Auditoría** → tabla `User` |

Reglas:

- Asigne el rol que corresponde al cargo aprobado por el jefe del área.
- Desactive la cuenta **el mismo día** en que alguien se retira o cambia de funciones.
- Nadie cambia su propio acceso: un administrador no puede modificar su
  propia cuenta, lo hace otro administrador. Mantenga al menos dos administradores.
- Por separación de funciones el administrador ve todos los módulos solo en **modo supervisión** (lectura):
  no recibe lotes, no pesa, no firma, no libera y no aprueba. El servidor rechaza esas acciones para el rol admin.
- Las contraseñas y el MFA los gestiona cada persona en Clerk. Para bloquear
  una cuenta comprometida, desactívela en **Usuarios** y, si es necesario,
  bloquéela también en el panel de Clerk.

Las reglas de uso de la firma electrónica están en el
[SOP-SIS-001](procedimientos/SOP-SIS-001-firma-electronica.md).

## 5. Datos de la empresa

**Configuración** guarda la razón social, el NIT y el registro INVIMA que
aparecen en el reporte BPM y en los registros de lote. Cada cambio queda en la
Auditoría (tabla `Organization`).

## 6. Respaldos y restauración

### 6.1 Respaldo automático

El servicio `backup` respalda cada día a las `BACKUP_HOUR` (2:00 a. m. por
defecto, hora de Bogotá):

- la base de datos en `backups/base-de-datos/` (verifica que el archivo se pueda leer);
- los adjuntos (COA, evidencias y documentos de SOP) en `backups/adjuntos/`;
- una suma SHA-256 de cada archivo;
- y borra los respaldos de más de `BACKUP_RETENTION_DAYS` días (30 por defecto).

Si el último respaldo correcto tiene más de 26 horas, `docker compose ps`
muestra `backup` como **unhealthy**.

### 6.2 Copia fuera del servidor (obligatoria)

Un respaldo en la misma máquina se pierde con ella. Programe una copia diaria
de la carpeta `backups/` a otro lugar: disco externo, NAS o nube (por ejemplo
con `rclone sync` en una tarea `cron`). Revise cada semana que la copia exista.

### 6.3 Simulacro de restauración (cada trimestre)

```bash
docker compose exec backup sh /scripts/restore-test.sh
```

Restaura el último respaldo en una base temporal, verifica la suma SHA-256,
compara las filas de cada tabla con la base actual y borra la base temporal.
Debe terminar en `Restauración verificada`. Guarde la salida como evidencia BPM.

### 6.4 Restaurar de verdad

Solo ante pérdida o corrupción de datos, con autorización del director técnico:

```bash
docker compose stop cosmoqms
docker compose exec backup sh -c 'dropdb cosmoqms && createdb cosmoqms && pg_restore --no-owner --dbname=cosmoqms /backups/base-de-datos/<archivo>.dump'
docker compose up -d
```

Al volver a levantar, `db-security` reaplica el usuario de la app y la
seguridad. Los adjuntos se recuperan descomprimiendo el `.tar.gz` del mismo
día en el volumen `cosmoqms-storage`. Registre la restauración como desviación.

## 7. Monitoreo

| Qué | Cómo |
|---|---|
| Estado de cada servicio | `docker compose ps` (todos `healthy`) |
| Salud de la app y la base | `https://<su-dominio>/api/health` responde `"status":"ok"` |
| Caídas del servidor | Monitor externo gratuito (UptimeRobot o Better Stack) sobre `/api/health` cada 5 minutos, con aviso por correo o Telegram. Tiene que ser externo: si el servidor se apaga, nada de adentro puede avisar |
| Errores de la aplicación | Sentry, poniendo `SENTRY_DSN` y `NEXT_PUBLIC_SENTRY_DSN` en `.env` |
| Respaldos | Servicio `backup` en `healthy` y archivo `backups/ultimo-backup.txt` |
| Registros (logs) | `docker compose logs -f cosmoqms` |

## 8. Actualizar a una versión nueva

Toda actualización es un **cambio controlado**: Calidad evalúa su impacto y
decide qué pruebas de validación repetir (ver
[plan maestro de validación](validacion/01-plan-maestro-validacion.md), sección 9).

1. Confirme que hay un respaldo de hoy y su copia externa.
2. Avise a planta: la app se detiene alrededor de un minuto.
3. Actualice y vuelva a levantar:

   ```bash
   git pull
   docker compose --profile https up -d --build
   docker compose ps
   ```

   `migrate` aplica los cambios de la base y `db-security` reaplica la seguridad solos.
4. Registre el nuevo commit (`git rev-parse HEAD`) en el control de cambios y
   ejecute las pruebas de verificación que Calidad indicó.

Si algo falla, vuelva a la versión anterior con `git checkout <commit anterior>`
y repita el paso 3. Si la versión nueva ya cambió la base, restaure el
respaldo de antes de actualizar.

## 9. Seguridad

- **Contraseñas de la base:** viven solo en `.env`. Para cambiarlas:
  - `RUNTIME_DB_PASSWORD`: cámbiela en `.env` y ejecute `docker compose up -d`; se aplica sola.
  - `POSTGRES_PASSWORD`: cámbiela primero en la base y luego en `.env`:

    ```bash
    docker compose exec db psql -U cosmoqms_app -d cosmoqms -c "ALTER ROLE cosmoqms_app PASSWORD '<nueva>'"
    docker compose up -d
    ```
- **Verificación de seguridad de la base** (9 comprobaciones, todas deben salir `OK`):

  ```bash
  docker compose exec -T -e RUNTIME_DB_PASSWORD=<la de .env> -e PGUSER=cosmoqms_app -e PGDATABASE=cosmoqms db sh < scripts/verify-db-security.sh
  ```
- **La base nunca se expone a la red:** está publicada solo en `127.0.0.1:5433`.
- **Modo demo:** solo existe con `docker-compose.demo.yml` y solo funciona en
  `localhost`. Nunca lo use en el servidor de producción; la IQ lo verifica.
- Mantenga el sistema operativo y Docker actualizados.

## 10. Tareas periódicas

| Frecuencia | Tarea |
|---|---|
| Diaria | Revisar `docker compose ps` y que la copia externa de respaldos se haya hecho |
| Semanal | Revisar avisos del monitor externo y de Sentry |
| Mensual | Revisar espacio en disco (`df -h`) |
| Trimestral | Simulacro de restauración (6.3) con evidencia; revisión de accesos con Calidad en **Usuarios → Revisión de accesos** (guardar el CSV): retirados desactivados, MFA en calidad, director técnico y administrador |
| Anual | Revisión periódica de la validación con Calidad; renovar contraseñas de la base |

## 11. Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| La página no carga | App o Caddy detenidos | `docker compose ps`; `docker compose up -d`; revise `docker compose logs caddy cosmoqms` |
| `/api/health` responde 503 | La base no responde | `docker compose logs db`; espacio en disco (`df -h`); `docker compose restart db` |
| Certificado HTTPS inválido | El dominio no apunta al servidor o los puertos 80/443 están cerrados | Revise el DNS y el firewall; `docker compose logs caddy` |
| `migrate` o `db-security` terminan con error | Migración fallida o contraseña incorrecta | `docker compose logs migrate db-security`; no use la app hasta resolverlo |
| `backup` en unhealthy | El respaldo falló | `docker compose logs backup`; revise `backups/ultimo-error.txt` y el espacio en disco |
| Una persona ve "Sin acceso a CosmoQMS" | Cuenta desactivada o el webhook no la creó | Revise **Usuarios**; si no aparece, verifique el webhook en el panel de Clerk |
| Una persona nueva no aparece en Usuarios | El webhook de Clerk no llega | En Clerk → Webhooks revise los intentos fallidos y que `CLERK_WEBHOOK_SECRET` coincida |
| No llegan correos de notificación | Falta `RESEND_API_KEY` | Configúrelo; mientras tanto las notificaciones siguen llegando a la campana de la app |
| No se generan los PDF | Chromium no disponible en la imagen | Reconstruya: `docker compose up -d --build` |

## 12. Comandos de referencia

| Acción | Comando |
|---|---|
| Estado | `docker compose ps` |
| Logs de la app | `docker compose logs -f cosmoqms` |
| Reiniciar la app | `docker compose restart cosmoqms` |
| Consola SQL (dueño) | `docker compose exec db psql -U cosmoqms_app -d cosmoqms` |
| Respaldo manual inmediato | `docker compose exec backup sh /scripts/backup.sh` |
| Apagar (conserva los datos) | `docker compose down` |
| Borrar todo, incluida la base | `docker compose down -v` — **irreversible**, nunca en producción |
