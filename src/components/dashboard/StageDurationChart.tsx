import { formatDuration, type StageDuration, type TimedStage } from "@/lib/dashboard/kpis";

const LABELS: Record<TimedStage, string> = {
  pesado: "Pesado",
  mezclado: "Mezclado",
  envasado: "Envasado",
  calidad: "Calidad",
};

export function StageDurationChart({ durations }: { durations: StageDuration[] }) {
  const max = Math.max(1, ...durations.map((duration) => duration.averageHours ?? 0));
  const hasData = durations.some((duration) => duration.samples > 0);

  return (
    <section aria-labelledby="stage-duration-title" className="rounded-card border border-border bg-card p-4">
      <h2 id="stage-duration-title" className="text-sm text-muted-foreground">
        Tiempo promedio por etapa (últimos 6 meses)
      </h2>
      {!hasData ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Aún no hay lotes con etapas firmadas en este período.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {durations.map((duration) => (
            <li key={duration.stage} className="flex items-center gap-3">
              <span className="w-24 shrink-0 font-sans text-xs text-muted-foreground">{LABELS[duration.stage]}</span>
              <div className="h-[10px] flex-1 rounded-full bg-border" role="presentation">
                <div
                  className="h-[10px] rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${((duration.averageHours ?? 0) / max) * 100}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right font-mono text-sm text-foreground">
                {duration.averageHours === null ? "—" : formatDuration(duration.averageHours)}
                <span className="ml-1 text-xs text-muted-foreground">({duration.samples})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Entre paréntesis: lotes con la etapa completada.</p>
    </section>
  );
}
