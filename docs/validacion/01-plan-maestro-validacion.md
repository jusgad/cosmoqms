# VAL-PMV-001 · Plan maestro de validación de CosmoQMS

| Campo | Valor |
|---|---|
| Código | VAL-PMV-001 |
| Versión | 1.0 |
| Sistema | CosmoQMS — sistema de producción y calidad (MES/QMS) |
| Elaboró | __________________ (Calidad) |
| Revisó | __________________ (Jefe de Planta) |
| Aprobó | __________________ (Director Técnico) |
| Fecha de aprobación | ____ / ____ / ________ |

## 1. Objetivo

Demostrar con evidencia documentada que CosmoQMS está instalado correctamente
(IQ), funciona según sus requisitos (OQ) y cumple su propósito en la operación
real del laboratorio (PQ), de modo que sus registros electrónicos y firmas
electrónicas puedan usarse como registros BPM.

## 2. Alcance

Incluye todos los módulos que generan o custodian registros BPM:

- Recepción, cuarentena y liberación de materias primas.
- Fórmulas maestras y su activación.
- Órdenes de producción, pesaje (en línea y sin conexión) y etapas.
- Firmas electrónicas de etapa, de liberación/rechazo de lote y de aprobación de SOP.
- Control de calidad, desviaciones y CAPA.
- Trazabilidad, batch record en PDF y reporte BPM.
- Control de documentos (SOPs) y lectura del personal.
- Usuarios, roles, auditoría (audit trail), respaldos y restauración.

Excluye: la infraestructura de Clerk (servicio de identidad de terceros, se
califica por su documentación y por las pruebas de acceso de la OQ), el
hardware de los equipos de pesaje (se califica aparte) y los equipos del
personal (navegadores).

## 3. Marco de referencia

- Buenas Prácticas de Manufactura para productos cosméticos (normativa
  INVIMA y Decisión Andina 516) e ISO 22716.
- Principios de integridad de datos ALCOA+ (atribuible, legible,
  contemporáneo, original, exacto, completo, consistente, duradero, disponible).
- GAMP 5 como guía de validación basada en riesgo. CosmoQMS es software
  desarrollado a la medida: **categoría 5**.
- 21 CFR Parte 11 como modelo de referencia para registros y firmas
  electrónicas (no es obligatorio en Colombia, pero es el estándar de la industria).

## 4. Enfoque basado en riesgo

Cada requisito de [02-requisitos-de-usuario.md](02-requisitos-de-usuario.md)
tiene un riesgo para el producto, el paciente/consumidor o la integridad de
datos:

| Riesgo | Criterio | Profundidad de prueba |
|---|---|---|
| Alto | Afecta la liberación de producto, una firma o el audit trail | Prueba automatizada **y** caso manual con evidencia en OQ; incluido en PQ |
| Medio | Afecta un registro BPM sin decidir sobre el producto | Prueba automatizada o caso manual en OQ |
| Bajo | Usabilidad o información sin impacto BPM | Verificación en OQ |

La suite automatizada (pruebas unitarias con Vitest y E2E con Playwright, ver
[06-matriz-de-trazabilidad.md](06-matriz-de-trazabilidad.md)) es evidencia de
OQ cuando se ejecuta sobre la versión exacta a liberar y se adjunta su salida.

## 5. Responsabilidades

| Rol | Responsabilidad |
|---|---|
| Director Técnico | Aprueba este plan, los protocolos y el informe final; decide la liberación del sistema |
| Calidad | Redacta y ejecuta los protocolos, registra desviaciones de validación, compila evidencia |
| Jefe de Planta | Revisa los protocolos; participa en la PQ con producción real |
| Administrador del sistema | Instala el sistema, ejecuta la IQ, mantiene respaldos y accesos |
| Desarrollador | Corrige defectos; no ejecuta ni aprueba pruebas de su propio cambio |

## 6. Entregables y orden

1. [02 · Especificación de requisitos de usuario (URS)](02-requisitos-de-usuario.md)
2. [03 · Protocolo de calificación de instalación (IQ)](03-protocolo-iq.md)
3. [04 · Protocolo de calificación de operación (OQ)](04-protocolo-oq.md)
4. [05 · Protocolo de calificación de desempeño (PQ)](05-protocolo-pq.md)
5. [06 · Matriz de trazabilidad](06-matriz-de-trazabilidad.md)
6. Informe final de validación (se redacta al cerrar la PQ con los resultados de 3, 4 y 5).

Cada protocolo se aprueba **antes** de ejecutarse. Ningún paso se ejecuta con
datos de producción hasta que la IQ y la OQ estén aprobadas.

## 7. Desviaciones durante la validación

Todo resultado distinto al esperado se registra en la hoja de desviaciones del
protocolo con: número, paso, resultado obtenido, análisis de impacto, acción
(corrección, reprueba o justificación) y firma de Calidad. Un defecto de
riesgo alto impide aprobar el protocolo hasta que se corrija y se vuelva a
probar.

## 8. Criterio de aceptación del sistema

El sistema se libera para uso BPM cuando:

- La IQ, la OQ y la PQ están ejecutadas y aprobadas.
- No hay desviaciones abiertas de riesgo alto.
- La matriz de trazabilidad muestra cada requisito cubierto por al menos una prueba aprobada.
- Están aprobados y capacitados el
  [procedimiento de firma electrónica](../procedimientos/SOP-SIS-001-firma-electronica.md)
  y el [manual de usuario](../01-manual-de-usuario.md).

## 9. Mantenimiento del estado validado

- **Control de cambios:** todo cambio de código llega por pull request; el CI
  (lint, tipos, pruebas, build, migraciones y seguridad de la base) debe pasar.
  Calidad evalúa el impacto y decide qué pruebas de OQ repetir; un cambio en
  firma, audit trail, liberación o seguridad repite la OQ de esos requisitos.
- **Versión validada:** se registra el commit (`git rev-parse HEAD`) de cada
  versión liberada en el informe de validación.
- **Revisión periódica:** una vez al año, y además cada trimestre el simulacro
  de restauración de respaldos (IQ-07).
- **Revalidación** si cambia la base de datos, el proveedor de identidad, el
  servidor o una regla de negocio fija (tolerancia de fórmulas, flujo de firma).
