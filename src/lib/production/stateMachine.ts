import type { BatchStatus } from "@prisma/client";

// Non-negotiable (docs/04-manual-de-desarrollador.md §4): batch stage transitions are validated
// server-side as a strict state machine — the client's reported state is
// never trusted. This module is the single enforcement point, consumed by
// `advanceStageInternal` (Task 9) and, transitively, Tasks 10-13.
const SEQUENCE: BatchStatus[] = ["planificado", "pesado", "mezclado", "envasado", "calidad"];
const TERMINAL: BatchStatus[] = ["liberado", "rechazado"];

export function nextStage(current: BatchStatus): BatchStatus | null {
  const idx = SEQUENCE.indexOf(current);
  if (idx === -1 || idx === SEQUENCE.length - 1) return null;
  return SEQUENCE[idx + 1];
}

export function canTransition(from: BatchStatus, to: BatchStatus): boolean {
  if (TERMINAL.includes(from)) return false;
  if (from === "calidad") return to === "liberado" || to === "rechazado";
  return nextStage(from) === to;
}
