import type { BatchStatus } from "@prisma/client";

// Pure presentational Server Component — takes pre-computed counts as props
// (same pattern as `KPICard`), no data fetching of its own. The `groupBy`
// query lives in `(app)/dashboard/page.tsx` alongside the other KPI queries,
// same as every other dashboard number. Labels reuse `StageTracker`'s
// Spanish naming for the `BatchStatus` enum for consistency across the app.
const LABELS: Record<BatchStatus, string> = {
  planificado: "Planificado",
  pesado: "Pesado",
  mezclado: "Mezclado",
  envasado: "Envasado",
  calidad: "Calidad",
  liberado: "Liberado",
  rechazado: "Rechazado",
};

const ORDER: BatchStatus[] = ["planificado", "pesado", "mezclado", "envasado", "calidad", "liberado", "rechazado"];

export interface BatchStatusCount {
  status: BatchStatus;
  count: number;
}

export function BatchStatusChart({ counts }: { counts: BatchStatusCount[] }) {
  const byStatus = new Map(counts.map((c) => [c.status, c.count]));
  const max = Math.max(1, ...counts.map((c) => c.count));

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">Lotes por etapa</p>
      <ul className="mt-4 flex flex-col gap-3">
        {ORDER.map((status) => {
          const count = byStatus.get(status) ?? 0;
          return (
            <li key={status} className="flex items-center gap-3">
              <span className="w-24 shrink-0 font-sans text-xs text-muted-foreground">{LABELS[status]}</span>
              <div className="h-[10px] min-h-[10px] flex-1 rounded-full bg-border" role="presentation">
                <div
                  className="h-[10px] rounded-full bg-primary"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right font-mono text-sm text-foreground">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
