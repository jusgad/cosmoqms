import { ROLE_LABELS } from "@/lib/validation/users";

type CoverageRow = { id: string; fullName: string; role: keyof typeof ROLE_LABELS; ackAt: Date | null };

// Who on the floor has confirmed reading the vigente version (quality unit
// view): the training evidence an inspector asks for.
export function SopCoverage({ rows }: { rows: CoverageRow[] }) {
  const done = rows.filter((row) => row.ackAt).length;
  return (
    <section aria-labelledby="coverage-title" className="flex flex-col gap-3">
      <h2 id="coverage-title" className="font-sans text-lg font-semibold text-foreground">
        Lectura del personal ({done} de {rows.length})
      </h2>
      <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <span className="text-foreground">
              {row.fullName} <span className="text-muted-foreground">· {ROLE_LABELS[row.role]}</span>
            </span>
            {row.ackAt ? (
              <time className="font-mono text-xs text-success" dateTime={row.ackAt.toISOString()}>
                Leído {row.ackAt.toLocaleString("es-CO")}
              </time>
            ) : (
              <span className="text-xs font-medium text-pending">Pendiente</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
