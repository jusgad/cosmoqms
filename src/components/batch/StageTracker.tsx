import type { BatchStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

// Pure presentational Server Component (no data fetching, no client-only
// hooks needed) — reads `status` alone. Color mapping per Task 1's design
// tokens as corrected by the Task 10 brief note: the brief's literal
// "accent (done), primary (active), border (pending)" is read as
// "success (done), primary (active), border (pending)" — `accent` is
// reserved for hover/subtle backgrounds (Task 1 rename), and `success` is
// the CosmoQMS status-green token (same rename Task 8's status badges use).
const STAGES: { status: BatchStatus; label: string }[] = [
  { status: "pesado", label: "Pesado" },
  { status: "mezclado", label: "Mezclado" },
  { status: "envasado", label: "Envasado" },
  { status: "calidad", label: "Calidad" },
  { status: "liberado", label: "Liberado/Rechazado" },
];

const SEQUENCE: BatchStatus[] = ["planificado", "pesado", "mezclado", "envasado", "calidad", "liberado"];

function segmentState(segmentStatus: BatchStatus, current: BatchStatus): "done" | "active" | "pending" {
  // "liberado" and "rechazado" both map onto the final segment.
  const currentIndex = current === "rechazado" ? SEQUENCE.indexOf("liberado") : SEQUENCE.indexOf(current);
  const segmentIndex = SEQUENCE.indexOf(segmentStatus);
  if (segmentIndex < currentIndex) return "done";
  if (segmentIndex === currentIndex) return "active";
  return "pending";
}

export function StageTracker({ status }: { status: BatchStatus }) {
  return (
    <ol className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-1" aria-label="Progreso del lote">
      {STAGES.map((stage, index) => {
        const state = segmentState(stage.status, status);
        return (
          <li key={stage.status} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "h-2 flex-1 rounded-full",
                state === "done" && "bg-success",
                state === "active" && "bg-primary",
                state === "pending" && "bg-border",
              )}
              aria-current={state === "active" ? "step" : undefined}
            />
            <span
              className={cn(
                "font-sans text-xs whitespace-nowrap",
                state === "pending" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {stage.label}
            </span>
            {index < STAGES.length - 1 && <span className="hidden text-border sm:inline">/</span>}
          </li>
        );
      })}
    </ol>
  );
}
