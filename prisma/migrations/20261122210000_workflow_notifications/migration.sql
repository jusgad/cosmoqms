-- Workflow notifications: tell each role when it is their turn to act.
-- Lot received in quarantine (calidad), order ready for QC (calidad) and
-- batch ready for release (director_tecnico).
ALTER TYPE "NotificationKind" ADD VALUE 'lote_recibido_cuarentena';
ALTER TYPE "NotificationKind" ADD VALUE 'orden_lista_para_calidad';
ALTER TYPE "NotificationKind" ADD VALUE 'lote_listo_para_liberar';
