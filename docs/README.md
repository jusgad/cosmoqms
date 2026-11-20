# Documentación de CosmoQMS

| Documento | Para quién |
|---|---|
| [Manual de usuario](manual/manual-de-usuario.md) | Todo el personal, por rol |
| [SOP-SIS-001 · Firma electrónica](procedimientos/SOP-SIS-001-firma-electronica.md) | Todo el personal que firma |
| [Despliegue](../DEPLOY.md) | Administrador del sistema |
| [API (OpenAPI 3.1)](api/openapi.yaml) | Integradores. Se puede importar en Postman o abrir en editor.swagger.io |

## Validación (IQ/OQ/PQ)

Se ejecutan en este orden, cada protocolo aprobado antes de ejecutarlo:

1. [VAL-PMV-001 · Plan maestro de validación](validacion/01-plan-maestro-validacion.md)
2. [VAL-URS-001 · Requisitos de usuario](validacion/02-requisitos-de-usuario.md)
3. [VAL-IQ-001 · Calificación de instalación](validacion/03-protocolo-iq.md) — evidencia con `bash scripts/iq-evidencia.sh`
4. [VAL-OQ-001 · Calificación de operación](validacion/04-protocolo-oq.md)
5. [VAL-PQ-001 · Calificación de desempeño](validacion/05-protocolo-pq.md)
6. [VAL-MT-001 · Matriz de trazabilidad](validacion/06-matriz-de-trazabilidad.md)

Estos documentos viven en el repositorio a propósito: cada cambio del sistema
y de su validación queda bajo el mismo control de versiones (control de
cambios BPM). Para firmarlos se imprimen o se exportan a PDF; el original
firmado se archiva según el sistema documental del laboratorio.

`docs/superpowers/` es el historial del plan de construcción original.
