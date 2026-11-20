# Documentación de CosmoQMS

Sistema de producción y control de calidad (MES/QMS) para laboratorio
cosmético, conforme a BPM e INVIMA.

## Manuales

| N.º | Manual | Para quién | Contenido |
|---|---|---|---|
| 1 | [Manual de usuario](01-manual-de-usuario.md) | Todo el personal | Uso del sistema por rol: operario, jefe de planta, bodega, calidad, director técnico y administrador |
| 2 | [Manual técnico](02-manual-tecnico.md) | Área de TI, auditores | Tecnologías y versiones, componentes, configuración, modelo de datos, interfaces y mecanismos de seguridad |
| 3 | [Manual arquitectónico](03-manual-arquitectonico.md) | Arquitectos, auditores, desarrolladores | Diseño del sistema y sus decisiones: aislamiento por empresa, audit trail, firma electrónica, modo sin conexión |
| 4 | [Manual de desarrollador](04-manual-de-desarrollador.md) | Desarrolladores | Entorno local, reglas de código, cómo agregar funcionalidades, pruebas, CI y control de cambios |
| 5 | [Manual de administrador](05-manual-de-administrador.md) | Administrador del sistema | Instalación, usuarios, respaldos, monitoreo, actualizaciones, seguridad y solución de problemas |

## Anexos

| Documento | Para qué |
|---|---|
| [SOP-SIS-001 · Uso de la firma electrónica](procedimientos/SOP-SIS-001-firma-electronica.md) | Procedimiento que todo el personal que firma debe leer y aceptar |
| [Paquete de validación IQ/OQ/PQ](validacion/01-plan-maestro-validacion.md) | Plan maestro, requisitos de usuario, protocolos IQ, OQ y PQ, y matriz de trazabilidad |
| [API REST (OpenAPI 3.1)](api/openapi.yaml) | Contrato de la API para integraciones. Se importa en Postman o se abre en editor.swagger.io |
| [Checklist de entrega](06-checklist-de-entrega.md) | Acta de entrega del sistema al laboratorio: instalación, validación, capacitación y firmas |

### Paquete de validación

Se ejecuta en este orden; cada protocolo se aprueba antes de ejecutarse:

1. [VAL-PMV-001 · Plan maestro de validación](validacion/01-plan-maestro-validacion.md)
2. [VAL-URS-001 · Requisitos de usuario](validacion/02-requisitos-de-usuario.md)
3. [VAL-IQ-001 · Calificación de instalación](validacion/03-protocolo-iq.md)
4. [VAL-OQ-001 · Calificación de operación](validacion/04-protocolo-oq.md)
5. [VAL-PQ-001 · Calificación de desempeño](validacion/05-protocolo-pq.md)
6. [VAL-MT-001 · Matriz de trazabilidad](validacion/06-matriz-de-trazabilidad.md)

Los documentos viven en el repositorio junto al código, para que cada cambio
del sistema y de su documentación quede bajo el mismo control de versiones.
Para firmarlos se imprimen o se exportan a PDF; el original firmado se archiva
según el sistema documental del laboratorio.
