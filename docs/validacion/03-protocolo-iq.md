# VAL-IQ-001 · Protocolo de calificación de instalación (IQ)

Versión 1.0 · Requisitos: [URS](02-requisitos-de-usuario.md) · Plan: [VAL-PMV-001](01-plan-maestro-validacion.md)

## 1. Objetivo

Verificar que CosmoQMS quedó instalado en el servidor de producción según
el [manual de administrador](../05-manual-de-administrador.md), con su base de datos protegida, sus respaldos
funcionando y sin modo demo.

## 2. Prerrequisitos

- Servidor con Docker y Docker Compose, dominio apuntando a él, puertos 80/443 abiertos.
- `.env` completo según `.env.example`, con contraseñas generadas (no las de ejemplo).
- Stack levantado: `docker compose --profile https up -d --build`.
- Este protocolo aprobado antes de ejecutarse.

## 3. Ejecución

En el servidor, desde la carpeta del proyecto:

```bash
APP_URL=https://<dominio> bash scripts/iq-evidencia.sh
```

El script genera `iq-evidencia-<fecha>.txt`. Imprímalo o adjúntelo a este
protocolo: es la evidencia objetiva de cada paso. Complete la tabla con lo
que muestra el archivo.

## 4. Pasos

| Paso | Verificación | Resultado esperado | Obtenido | Cumple (S/N) | Iniciales |
|---|---|---|---|---|---|
| IQ-01 | Versión del software | Commit registrado; `Cambios sin commit: 0`. El commit coincide con la versión aprobada para liberar | | | |
| IQ-02 | Plataforma | Servicios `db`, `cosmoqms`, `backup` y `caddy` en `Up (healthy)`; `migrate` y `db-security` terminaron | | | |
| IQ-03 | Migraciones | Todas las migraciones del repositorio aplicadas; `No pending migrations to apply` | | | |
| IQ-04 | Seguridad de la base | Las 9 comprobaciones en `OK` y `Seguridad de la base verificada` | | | |
| IQ-05a | Modo demo | `DEMO_MODE en la app: false` | | | |
| IQ-05b | URL pública | `NEXT_PUBLIC_APP_URL` es `https://<dominio>` | | | |
| IQ-05c | Zona horaria | `TZ: America/Bogota` | | | |
| IQ-05d | Identidad | `Llaves de Clerk presentes: sí`; en el panel de Clerk: Organizations activado, MFA disponible, webhook apuntando a `https://<dominio>/api/webhooks/clerk` | | | |
| IQ-05e | Base no expuesta | `Postgres publicado en: 127.0.0.1:5433` (nunca `0.0.0.0`) | | | |
| IQ-06a | Salud | `/api/health` responde `"status":"ok","database":"ok"` | | | |
| IQ-06b | HTTPS | Responde `HTTP/2 200` con `strict-transport-security`, `x-frame-options: DENY` y `x-content-type-options: nosniff`; el certificado es válido en el navegador | | | |
| IQ-07a | Respaldos | Servicio `backup` en `healthy`; existe un respaldo de las últimas 24 h | | | |
| IQ-07b | Restauración | El simulacro termina en `Restauración verificada` | | | |
| IQ-07c | Copia externa | La carpeta `BACKUP_DIR` se copia fuera del servidor (indique destino y frecuencia): __________ | | | |
| IQ-08 | Monitoreo | Monitor externo configurado sobre `/api/health` (indique servicio): __________; Sentry con DSN (opcional) | | | |
| IQ-09 | Primer administrador | Existe al menos un usuario `admin` activo y no es una cuenta compartida | | | |

## 5. Desviaciones

| N.º | Paso | Descripción | Impacto | Acción | Cierre (firma/fecha) |
|---|---|---|---|---|---|
| | | | | | |

## 6. Conclusión

☐ La instalación cumple todos los criterios. ☐ No cumple (ver desviaciones).

| | Nombre | Firma | Fecha |
|---|---|---|---|
| Ejecutó (Administrador del sistema) | | | |
| Revisó (Calidad) | | | |
| Aprobó (Director Técnico) | | | |
