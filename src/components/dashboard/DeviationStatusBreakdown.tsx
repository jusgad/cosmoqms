import Link from "next/link";
import type { DeviationStatus } from "@prisma/client";

const ROWS: { status: DeviationStatus; label: string; tone: string }[] = [
  { status: "abierta", label: "Abiertas", tone: "bg-destructive" },
  { status: "en_investigacion", label: "En investigación", tone: "bg-pending" },
  { status: "pendiente_aprobacion", label: "Pendientes de aprobación", tone: "bg-primary" },
  { status: "cerrada", label: "Cerradas", tone: "bg-success" },
];

export function DeviationStatusBreakdown({ counts }: { counts: Partial<Record<DeviationStatus, number>> }) {
  const open = ROWS.filter((row) => row.status !== "cerrada").reduce((sum, row) => sum + (counts[row.status] ?? 0), 0);

  return (
    <section aria-labelledby="deviation-status-title" className="rounded-card border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="deviation-status-title" className="text-sm text-muted-foreground">
          Desviaciones por estado
        </h2>
        <Link href="/calidad/desviaciones" className="text-xs font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </div>
      <p className="mt-2 font-mono text-3xl font-semibold text-foreground">{open}</p>
      <p className="text-xs text-muted-foreground">sin cerrar</p>
      <ul className="mt-4 flex flex-col gap-2">
        {ROWS.map((row) => (
          <li key={row.status} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <span className={`size-3 rounded-sm ${row.tone}`} aria-hidden />
              {row.label}
            </span>
            <span className="font-mono text-foreground">{counts[row.status] ?? 0}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
