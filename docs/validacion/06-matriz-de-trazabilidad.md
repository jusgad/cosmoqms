# VAL-MT-001 · Matriz de trazabilidad

Relaciona cada requisito ([URS](02-requisitos-de-usuario.md)) con su
implementación y con las pruebas que lo verifican. Pruebas unitarias en
`src/**/__tests__/` (Vitest), E2E en `e2e/` (Playwright), casos manuales en la
[OQ](04-protocolo-oq.md) y criterios de la [PQ](05-protocolo-pq.md).

| Req. | Implementación principal | Pruebas automatizadas | OQ manual | PQ |
|---|---|---|---|---|
| URS-01 Acceso y roles | `src/lib/auth.ts`, `src/lib/pageAccess.ts`, `src/lib/trpc/trpc.ts` (`roleProcedure`), `Sidebar.tsx` | `lib/__tests__/auth.test.ts`, `lib/trpc/__tests__/trpc.test.ts`, `lib/__tests__/demoMode.test.ts`, `e2e/navegacion.spec.ts` (6 roles, escritorio y celular) | B01, B02 | PQ-04 |
| URS-02 Aislamiento por empresa | `db/rls.sql`, `db/runtime-role.sql`, `withTenant` en `src/lib/db.ts` | `lib/__tests__/db.test.ts`, `scripts/verify-db-security.sh` (CI, trabajo de base de datos) | B13 | — |
| URS-03 Recepción en cuarentena | router `materials.receiveLot`, `ReceiveLotForm.tsx`, adjuntos | `lib/trpc/router/__tests__/materials.test.ts`, `lib/attachments/__tests__/service.test.ts`, `sniff.test.ts`, `e2e/flujo-produccion.spec.ts` | B03 | PQ-01 |
| URS-04 Liberación de lotes de MP | `materials.setStatus` (máquina de estados del lote) | `materials.test.ts`, `e2e/flujo-produccion.spec.ts` | B03 | PQ-01 |
| URS-05 Fórmula al 100% ± 0,5%, especificaciones y versiones | `src/lib/formulas/validateComposition.ts`, `formulas.activate`, `src/lib/formulas/specifications.ts`, `src/lib/formulas/versioning.ts` | `lib/formulas/__tests__/validateComposition.test.ts`, `specifications.test.ts`, `versioning.test.ts`, `formulas.test.ts`, `e2e/flujo-produccion.spec.ts` (fórmula al 90% rechazada) | B04 | — |
| URS-06 Órdenes desde fórmula activa | `production.create`, `generateOrderNumber.ts` | `production.test.ts`, `lib/production/__tests__/generateOrderNumber.test.ts`, `e2e/flujo-produccion.spec.ts` | — | — |
| URS-07 Pesaje, inventario y modo sin conexión | `src/lib/production/weighing.ts`, `src/lib/materials/lotAvailability.ts`, `src/lib/offline/`, `/api/sync/events` | `weighing.test.ts`, `lotAvailability.test.ts`, `production.recordWeighing.test.ts`, `lib/offline/__tests__/sync-engine.test.ts`, `api/sync/__tests__/events.test.ts` (duplicados), `e2e/flujo-produccion.spec.ts` | B05, B06 | PQ-02, PQ-03 |
| URS-08 Máquina de estados del lote | `src/lib/production/stateMachine.ts`, `advanceStage.ts` | `lib/production/__tests__/stateMachine.test.ts`, `production.sign.test.ts` | B08 | PQ-04 |
| URS-09 Firma electrónica | `production.sign`, `src/lib/reauth.ts`, `SignaturePad.tsx` | `production.sign.test.ts`, `e2e/flujo-produccion.spec.ts` (firma sin reautenticación rechazada con 401) | B07, B08 | PQ-04 |
| URS-10 QC contra especificación | `src/lib/quality/evaluateSpec.ts`, `qc.recordResult`, notificaciones | `lib/quality/__tests__/evaluateSpec.test.ts`, `qc.test.ts`, `lib/notifications/__tests__/notify.test.ts` | B09 | PQ-05 |
| URS-11 Liberación final | `qc.release` / `qc.reject` | `qc.test.ts` | B10 | PQ-06 |
| URS-12 Desviaciones y CAPA | router `deviations` | `deviations.test.ts` | B11 | — |
| URS-13 Trazabilidad | router `traceability` | `traceability.test.ts` | B12 | PQ-08 |
| URS-14 Audit trail inmutable | `src/lib/audit.ts` (`withAuditLog`), auditoría explícita de User, Sop y Organization, `db/runtime-role.sql` (sin UPDATE/DELETE) | `lib/__tests__/audit.test.ts`, `audit.test.ts` (router), `users.test.ts`, `sops.test.ts`, `organization.test.ts`, `scripts/verify-db-security.sh` | B02, B11, B13 | PQ-09 |
| URS-15 Batch record PDF | `/api/pdf/batch/[id]`, `src/lib/batchRecord.ts`, `src/lib/pdf.ts` | `lib/__tests__/pdf.test.ts`, `lib/__tests__/batchRecord.test.ts` | B14 | PQ-07 |
| URS-16 Reporte BPM | `src/lib/reports/`, `/api/reports/produccion` | `lib/reports/__tests__/productionReport.test.ts`, `e2e/reportes.spec.ts` | B14 | PQ-13 |
| URS-17 Control de documentos (SOP) | `src/lib/sops/service.ts`, router `sops`, `/sops` | `sops.test.ts`, `e2e/sops.spec.ts` (aprobación sin reautenticación rechazada) | B15 | PQ-14 |
| URS-18 Administración de usuarios | `src/lib/users/admin.ts`, `/usuarios`, webhook de Clerk | `users.test.ts`, `api/webhooks/clerk/__tests__/route.test.ts`, `e2e/usuarios.spec.ts` | B02 | — |
| URS-19 Respaldos y restauración | `db/backup/` (servicio `backup`) | IQ-07 (`scripts/iq-evidencia.sh`) | B16 | PQ-11, PQ-12 |
| URS-20 Salud y monitoreo | `/api/health`, healthchecks de Docker | `api/health/__tests__/route.test.ts` | B17 | PQ-10 |
| URS-21 Uso en planta | Diseño mobile-first, botones ≥ 44 px | `e2e/navegacion.spec.ts` (proyecto celular, sin scroll horizontal) | B18 | — |
| URS-22 Catálogo y etiquetas | `/materias-primas/catalogo`, `src/lib/materials/catalog.ts`, `/api/pdf/lot-label/[id]`, `src/lib/labels.ts` | `lib/trpc/router/__tests__/materials.test.ts`, `lib/__tests__/labels.test.ts`, `e2e/api-materias-primas.spec.ts` | — | PQ-01 |
| URS-23 Pendientes y avisos | `src/lib/dashboard/pendingTasks.ts`, `src/lib/notifications/notify.ts` | `lib/dashboard/__tests__/pendingTasks.test.ts`, `lib/trpc/router/__tests__/production.sign.test.ts` | — | — |
| URS-24 Supervisión y revisión de accesos | `src/lib/roles/modules.ts`, `src/lib/roles/permissions.ts`, `/roles`, `/usuarios/revision`, `src/lib/users/accessReview.ts` | `lib/roles/__tests__/modules.test.ts`, `lib/users/__tests__/accessReview.test.ts`, `e2e/navegacion.spec.ts` | — | PQ-04 |

Contrato de la API REST (`docs/api/openapi.yaml`): `lib/__tests__/openapi.test.ts`
falla si una ruta pública no está documentada o si la documentación describe
una ruta que no existe.
