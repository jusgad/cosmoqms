# VAL-OQ-001 · Protocolo de calificación de operación (OQ)

Versión 1.0 · Requisitos: [URS](02-requisitos-de-usuario.md) · Trazabilidad: [matriz](06-matriz-de-trazabilidad.md)

## 1. Objetivo

Demostrar que cada función de CosmoQMS opera según sus requisitos, en un
entorno igual al de producción, antes de usarla con producto real.

## 2. Prerrequisitos

- IQ aprobada (VAL-IQ-001).
- Entorno de prueba con la **misma versión (commit)** que se va a liberar.
- Cuentas reales de Clerk, una por rol, con MFA configurado para calidad y director técnico.
- Datos de prueba identificados con el prefijo `OQ-` (nunca productos reales).

## 3. Parte A — Suite automatizada

Ejecute sobre el commit a liberar y adjunte la salida completa de cada comando:

| Paso | Comando | Resultado esperado | Obtenido | Cumple | Iniciales |
|---|---|---|---|---|---|
| OQ-A1 | `pnpm test` | Todas las pruebas unitarias pasan (0 fallidas) | | | |
| OQ-A2 | `pnpm exec tsc --noEmit` y `pnpm lint` | Sin errores | | | |
| OQ-A3 | `pnpm test:e2e` (stack en modo demo, ver manual de desarrollador, sección 7.2) | Todas las pruebas E2E pasan (0 fallidas) | | | |
| OQ-A4 | Ejecución del CI en GitHub para el commit | Los trabajos "Calidad del código", "Migraciones y seguridad de la base" y "Pruebas E2E" en verde (adjunte el enlace) | | | |

La [matriz de trazabilidad](06-matriz-de-trazabilidad.md) indica qué requisito
cubre cada archivo de prueba.

## 4. Parte B — Casos manuales

Para lo que la automatización no puede probar: identidad real, firmas con
reautenticación real, el modo sin conexión en un dispositivo y la cámara.
Registre en "Obtenido" lo observado, con captura de pantalla cuando se pida.

| Caso | Req. | Pasos | Resultado esperado | Obtenido | Cumple | Iniciales |
|---|---|---|---|---|---|---|
| OQ-B01 | URS-01 | Inicie sesión con la cuenta de calidad: contraseña y luego el código MFA | Sin el código MFA no entra; con él, entra y ve solo su menú | | | |
| OQ-B02 | URS-01, 18 | Como admin, desactive la cuenta de bodega en Usuarios. Con esa cuenta, intente entrar | La persona ve "Sin acceso a CosmoQMS"; el cambio aparece en Auditoría (tabla User) con antes/después | | | |
| OQ-B03 | URS-03, 04 | Bodega recibe el lote `OQ-MP-01` con su COA en PDF; el jefe de planta intenta pesarlo | El lote queda en Cuarentena con QR; no aparece en el pesaje hasta que calidad lo libera | | | |
| OQ-B04 | URS-05 | Calidad intenta activar una fórmula al 99,4% y otra al 100% | La de 99,4% se rechaza con mensaje; la de 100% queda Activa | | | |
| OQ-B05 | URS-07 | En una tableta, abra el pesaje de una orden `OQ-`, active el modo avión, registre dos pesajes, desactive el modo avión | El indicador muestra eventos pendientes; al reconectar se sincronizan y aparecen **una sola vez** cada uno en "Eventos del lote" | | | |
| OQ-B06 | URS-07 | Escanee con la cámara el QR de un lote liberado en el pesaje | Selecciona el lote correcto | | | |
| OQ-B07 | URS-09 | Como jefe de planta, firme la etapa pesado: "Verificar identidad" → contraseña/MFA → "Firmar" | Sin verificar identidad, "Firmar" está deshabilitado. Tras firmar, el batch record muestra nombre, fecha, hora y la declaración de significado | | | |
| OQ-B08 | URS-09 | Como jefe de planta, intente abrir la firma de la etapa calidad | No tiene acceso; solo calidad o director técnico firman esa etapa | | | |
| OQ-B09 | URS-10 | Calidad registra un resultado fuera de especificación | El veredicto es No conforme; director técnico, calidad y jefe de planta reciben notificación | | | |
| OQ-B10 | URS-11 | Director técnico intenta liberar ese lote | El sistema lo impide (resultado no conforme). Con un lote conforme y sin desviaciones abiertas, libera tras reautenticarse | | | |
| OQ-B11 | URS-12 | El jefe de planta reporta una desviación; calidad investiga con causa y CAPA; director aprueba | La desviación recorre Abierta → En investigación → Pendiente de aprobación → Cerrada, cada paso en Auditoría | | | |
| OQ-B12 | URS-13 | En Trazabilidad busque el lote `OQ-MP-01` y luego el lote terminado | Muestra el lote terminado que lo usó, y al revés, sus materias primas | | | |
| OQ-B13 | URS-14 | Con el usuario de la app en la base, intente `UPDATE` y `DELETE` sobre `batch_events` y `audit_log` (ver manual de administrador, sección 9) | `permission denied` en ambos | | | |
| OQ-B14 | URS-15, 16 | Descargue el batch record PDF de la orden y el reporte BPM del período | El PDF y el reporte contienen exactamente los pesajes, firmas, resultados y desviaciones registrados | | | |
| OQ-B15 | URS-17 | Calidad crea un SOP, adjunta su PDF; director lo aprueba con reautenticación; el jefe de planta confirma la lectura | El SOP pasa a Vigente, la versión anterior a Obsoleto, el PDF ya no se puede cambiar y calidad ve al operario como "Leído" | | | |
| OQ-B16 | URS-19 | `docker compose exec backup sh /scripts/restore-test.sh` | `Restauración verificada` | | | |
| OQ-B17 | URS-20 | Detenga la base (`docker compose stop db`) por 2 minutos y vuelva a iniciarla | `/api/health` responde 503 y el monitor externo avisa; al volver, 200 | | | |
| OQ-B18 | URS-21 | Recorra pesaje y firma en un celular | Sin desplazamiento horizontal; todos los botones se pueden tocar con guantes | | | |

## 5. Desviaciones

| N.º | Caso | Descripción | Impacto | Acción | Cierre (firma/fecha) |
|---|---|---|---|---|---|
| | | | | | |

## 6. Conclusión

☐ Todas las funciones operan según sus requisitos. ☐ No cumple (ver desviaciones).

| | Nombre | Firma | Fecha |
|---|---|---|---|
| Ejecutó (Calidad) | | | |
| Revisó (Jefe de Planta) | | | |
| Aprobó (Director Técnico) | | | |
