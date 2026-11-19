import type { MonthOutcome } from "@/lib/dashboard/kpis";

const SERIES = [
  { field: "liberados", label: "liberados", legend: "Liberado", tone: "bg-success" },
  { field: "rechazados", label: "rechazados", legend: "Rechazado", tone: "bg-destructive" },
] as const;

// Presentational Server Component (same pattern as BatchStatusChart): paired
// bars per month, released in the success color and rejected in the
// destructive color, each with its number so color is never the only cue.
export function MonthlyOutcomeChart({ months }: { months: MonthOutcome[] }) {
  const max = Math.max(1, ...months.flatMap((month) => [month.liberados, month.rechazados]));
  const totalReleased = months.reduce((sum, month) => sum + month.liberados, 0);
  const totalRejected = months.reduce((sum, month) => sum + month.rechazados, 0);

  return (
    <section aria-labelledby="monthly-outcome-title" className="rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="monthly-outcome-title" className="text-sm text-muted-foreground">
          Lotes liberados vs. rechazados (últimos 6 meses)
        </h2>
        <p className="font-mono text-xs text-muted-foreground">
          {totalReleased} liberados · {totalRejected} rechazados
        </p>
      </div>

      <ol className="mt-4 grid h-48 grid-cols-6 items-end gap-2" aria-label="Lotes por mes">
        {months.map((month) => (
          <li key={month.key} className="flex h-full flex-col items-center justify-end gap-2">
            <div className="flex h-full w-full items-end justify-center gap-1">
              {SERIES.map((series) => {
                const value = month[series.field];
                const label = `${month.label}: ${value} ${series.label}`;
                return (
                  <div key={series.field} className="flex h-full w-1/2 max-w-6 flex-col items-center justify-end gap-1" title={label}>
                    <span className="font-mono text-[11px] text-foreground">{value}</span>
                    <div
                      role="img"
                      aria-label={label}
                      className={`w-full rounded-t ${series.tone} transition-[height] duration-300`}
                      style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? 4 : 0 }}
                    />
                  </div>
                );
              })}
            </div>
            <span className="font-sans text-xs text-muted-foreground capitalize">{month.label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {SERIES.map((series) => (
          <span key={series.field} className="flex items-center gap-2">
            <span className={`size-3 rounded-sm ${series.tone}`} aria-hidden /> {series.legend}
          </span>
        ))}
      </div>
    </section>
  );
}
