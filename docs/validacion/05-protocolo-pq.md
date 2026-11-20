# VAL-PQ-001 · Protocolo de calificación de desempeño (PQ)

Versión 1.0 · Requisitos: [URS](02-requisitos-de-usuario.md)

## 1. Objetivo

Demostrar que CosmoQMS, usado por el personal real en la operación diaria,
produce registros BPM completos, exactos y consistentes de forma repetible.

## 2. Prerrequisitos

- IQ y OQ aprobadas.
- Personal capacitado en el [manual de usuario](../manual/manual-de-usuario.md)
  y en el [procedimiento de firma electrónica](../procedimientos/SOP-SIS-001-firma-electronica.md),
  con registro de capacitación firmado.
- Durante la PQ el laboratorio mantiene en paralelo su registro en papel
  (sistema de respaldo) para poder comparar.

## 3. Diseño

Se fabrican **tres lotes consecutivos** de un producto real con CosmoQMS, de
principio a fin, en condiciones normales (turnos, tabletas de planta, red real
incluyendo zonas sin señal). Al menos uno de los tres incluye una desviación
real o simulada y su cierre.

## 4. Criterios por lote

| Criterio | Lote 1 | Lote 2 | Lote 3 |
|---|---|---|---|
| PQ-01 · Recepción y liberación de cada materia prima con COA adjunto | | | |
| PQ-02 · Pesajes coinciden con el registro en papel (lote, cantidad, operario) | | | |
| PQ-03 · Ningún pesaje duplicado ni perdido, también los hechos sin señal | | | |
| PQ-04 · Cada etapa firmada por el rol correcto, con reautenticación | | | |
| PQ-05 · Resultados de QC y veredictos coinciden con el certificado del laboratorio | | | |
| PQ-06 · La decisión final (liberado/rechazado) la firma el director técnico | | | |
| PQ-07 · El batch record PDF está completo y coincide con el registro en papel | | | |
| PQ-08 · La trazabilidad muestra todos los lotes de materia prima usados | | | |
| PQ-09 · El audit trail registra cada acción con usuario y hora correctos (hora de Bogotá) | | | |
| PQ-10 · Ninguna caída o error impidió registrar a tiempo (contemporaneidad) | | | |

Además, durante el periodo de la PQ:

| Criterio | Resultado |
|---|---|
| PQ-11 · Respaldos diarios correctos todos los días (servicio `backup` healthy) | |
| PQ-12 · Simulacro de restauración al final del periodo: `Restauración verificada` | |
| PQ-13 · Reporte BPM del periodo coincide con los tres lotes | |
| PQ-14 · El personal confirmó la lectura de los SOPs vigentes que aplican | |

## 5. Aceptación

Los tres lotes cumplen PQ-01 a PQ-10 y el periodo cumple PQ-11 a PQ-14. Una
discrepancia con el papel se investiga como desviación: si la causa es el
sistema, se corrige, se repite la OQ afectada y se reinicia el conteo de lotes.

## 6. Desviaciones

| N.º | Lote/criterio | Descripción | Causa | Acción | Cierre (firma/fecha) |
|---|---|---|---|---|---|
| | | | | | |

## 7. Conclusión y liberación del sistema

☐ CosmoQMS queda liberado para uso BPM como registro oficial. A partir de la
fecha se suspende el registro en papel para los procesos validados.
☐ No se libera (ver desviaciones).

Versión liberada (commit): ______________________________

| | Nombre | Firma | Fecha |
|---|---|---|---|
| Ejecutó (Calidad) | | | |
| Revisó (Jefe de Planta) | | | |
| Aprobó (Director Técnico) | | | |
