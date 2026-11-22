# Checklist de entrega de CosmoQMS

Acta de entrega del sistema al laboratorio. Cada ítem se marca al cumplirse;
al final firman quien entrega y quien recibe. El detalle de cada paso está en
el [manual de administrador](05-manual-de-administrador.md).

| Dato | Valor |
|---|---|
| Laboratorio | |
| NIT | |
| Dominio del sistema | `https://` |
| Versión entregada (commit) | |
| Fecha de entrega | |

## 1. Prerrequisitos del laboratorio

- [ ] Servidor con Docker y Docker Compose: 2 CPU, 4 GB de RAM y 40 GB de disco o más ([§2](05-manual-de-administrador.md#2-requisitos-del-servidor))
- [ ] Dominio propio apuntando a la IP del servidor
- [ ] Puertos 80 y 443 abiertos; la base de datos **no** queda expuesta a internet
- [ ] Cuenta de Clerk de **producción** a nombre del laboratorio (no la de desarrollo)
- [ ] Lugar de copia externa de respaldos definido (disco, NAS o nube)

## 2. Configuración de identidad (Clerk)

- [ ] Organizations y MFA activados ([§3.2](05-manual-de-administrador.md#32-configurar-clerk))
- [ ] Organización del laboratorio creada
- [ ] Webhook `https://<dominio>/api/webhooks/clerk` registrado, incluido el evento `user.updated`
- [ ] Secreto del webhook copiado a `CLERK_WEBHOOK_SECRET`

## 3. Instalación

- [ ] Código obtenido de la versión indicada arriba ([§3.1](05-manual-de-administrador.md#31-obtener-el-sistema))
- [ ] `.env` completo: llaves de Clerk de producción, `APP_DOMAIN`, `NEXT_PUBLIC_APP_URL` ([§3.3](05-manual-de-administrador.md#33-variables-de-entorno))
- [ ] `POSTGRES_PASSWORD` y `RUNTIME_DB_PASSWORD` largas, distintas entre sí y guardadas en un gestor de contraseñas
- [ ] `DEMO_MODE` **no** está definido; no se usa `docker-compose.demo.yml`
- [ ] `docker compose --profile https up -d --build` ejecutado y `docker compose ps` con todos los servicios en `healthy` ([§3.4](05-manual-de-administrador.md#34-levantar-el-sistema))
- [ ] El sistema abre en `https://<dominio>` con certificado válido
- [ ] `https://<dominio>/api/health` responde `"status":"ok"`

## 4. Puesta en marcha

- [ ] Primer administrador creado ([§3.5](05-manual-de-administrador.md#35-primer-administrador))
- [ ] Datos de la empresa cargados en **Configuración**: razón social, NIT y registro INVIMA ([§5](05-manual-de-administrador.md#5-datos-de-la-empresa))
- [ ] Usuarios del personal creados con su rol en **Usuarios**, con MFA activo para quienes firman ([§4](05-manual-de-administrador.md#4-usuarios-y-accesos))
- [ ] Cada persona que firma leyó y aceptó el [SOP-SIS-001 · Uso de la firma electrónica](procedimientos/SOP-SIS-001-firma-electronica.md)
- [ ] El plan de Clerk admite a todo el personal (el gratis permite 5 personas por organización; **Usuarios** muestra los cupos)
- [ ] Catálogo de materias primas cargado por bodega en **Materias Primas → Catálogo**
- [ ] Fórmulas maestras creadas, con sus especificaciones de calidad, y activadas por calidad
- [ ] Impresora de etiquetas de 100 × 70 mm probada con **Imprimir etiqueta con QR**
- [ ] Primera revisión de accesos hecha y su CSV archivado (**Usuarios → Revisión de accesos**)

## 5. Respaldos y monitoreo

- [ ] Servicio `backup` generando el respaldo diario en `backups/` ([§6.1](05-manual-de-administrador.md#61-respaldo-automático))
- [ ] Copia automática fuera del servidor configurada ([§6.2](05-manual-de-administrador.md#62-copia-fuera-del-servidor-obligatoria))
- [ ] Primer simulacro de restauración realizado con éxito ([§6.3](05-manual-de-administrador.md#63-simulacro-de-restauración-cada-trimestre))
- [ ] Monitor de disponibilidad revisando `/api/health` ([§7](05-manual-de-administrador.md#7-monitoreo))
- [ ] Opcional: Sentry (`SENTRY_DSN`) y correo de notificaciones (`RESEND_API_KEY`)

## 6. Validación (BPM / INVIMA)

El sistema no se usa para lotes reales hasta completar esta sección.

- [ ] [Plan maestro de validación](validacion/01-plan-maestro-validacion.md) aprobado
- [ ] [Requisitos de usuario (URS)](validacion/02-requisitos-de-usuario.md) revisados y aprobados por el laboratorio
- [ ] [IQ](validacion/03-protocolo-iq.md) ejecutado con `scripts/iq-evidencia.sh` y firmado; evidencia archivada
- [ ] [OQ](validacion/04-protocolo-oq.md) ejecutado y firmado
- [ ] [PQ](validacion/05-protocolo-pq.md) ejecutado y firmado
- [ ] [Matriz de trazabilidad](validacion/06-matriz-de-trazabilidad.md) completa, sin requisitos sin prueba
- [ ] Desviaciones de la validación cerradas o justificadas

## 7. Capacitación

| Rol | Personas capacitadas | Fecha | Firma |
|---|---|---|---|
| Operario | | | |
| Jefe de planta | | | |
| Bodega | | | |
| Calidad | | | |
| Director técnico | | | |
| Administrador | | | |

- [ ] Capacitación hecha con el [manual de usuario](01-manual-de-usuario.md); puede usarse el modo demo en un equipo aparte
- [ ] El administrador conoce respaldos, restauración, actualizaciones y solución de problemas ([manual de administrador](05-manual-de-administrador.md))

## 8. Documentación entregada

- [ ] [Manual de usuario](01-manual-de-usuario.md)
- [ ] [Manual técnico](02-manual-tecnico.md)
- [ ] [Manual arquitectónico](03-manual-arquitectonico.md)
- [ ] [Manual de desarrollador](04-manual-de-desarrollador.md)
- [ ] [Manual de administrador](05-manual-de-administrador.md)
- [ ] [SOP-SIS-001 · Firma electrónica](procedimientos/SOP-SIS-001-firma-electronica.md)
- [ ] [Paquete de validación IQ/OQ/PQ](validacion/01-plan-maestro-validacion.md)
- [ ] [Contrato de la API (OpenAPI)](api/openapi.yaml)
- [ ] Acceso al código fuente (repositorio o copia)

## 9. Accesos que pasan al laboratorio

- [ ] Servidor (usuario administrador)
- [ ] Cuenta de Clerk de producción
- [ ] Contraseñas de la base de datos (`.env`)
- [ ] Dominio y DNS
- [ ] Destino de los respaldos externos
- [ ] Sentry y monitor de disponibilidad, si aplican

## Observaciones

&nbsp;

&nbsp;

## Firmas

| | Entrega | Recibe |
|---|---|---|
| Nombre | | |
| Cargo | | |
| Firma | | |
| Fecha | | |
