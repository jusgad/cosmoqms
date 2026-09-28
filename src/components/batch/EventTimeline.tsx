import type { BatchEvent } from "@prisma/client";

// Pure presentational Server Component — read-only, reverse-chronological.
// Reused as-is by Task 14 for offline-synced events (per this task's brief
// interface note), so it must not assume anything beyond the `BatchEvent`
// shape already on the wire.
//
// `payload` is a Prisma `Json` column, so its shape isn't statically known.
// Each `case` below narrows it with a small local type guard instead of
// `any`, per the zero-`any` constraint.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function summarize(eventType: string, payload: unknown): string {
  const data = isRecord(payload) ? payload : {};
  switch (eventType) {
    case "weighing": {
      const theoretical = typeof data.theoreticalQty === "number" ? data.theoreticalQty : "?";
      const actual = typeof data.actualQty === "number" ? data.actualQty : "?";
      return `Pesaje: ${actual} (teórico ${theoretical})`;
    }
    case "mixing":
      return "Mezcla registrada";
    case "packaging":
      return "Envasado registrado";
    case "qc_check": {
      const result = typeof data.result === "string" ? data.result : "resultado registrado";
      return `Control de calidad: ${result}`;
    }
    case "deviation": {
      const description = typeof data.description === "string" ? data.description : "desviación registrada";
      return `Desviación: ${description}`;
    }
    case "signature": {
      const stage = typeof data.stage === "string" ? data.stage : "";
      return `Firma electrónica${stage ? ` (${stage})` : ""}`;
    }
    case "release": {
      const outcome = typeof data.outcome === "string" ? data.outcome : "resuelto";
      return `Lote ${outcome}`;
    }
    default:
      return eventType;
  }
}

export function EventTimeline({ events }: { events: BatchEvent[] }) {
  const sorted = [...events].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay eventos registrados.</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {sorted.map((event) => (
        <li
          key={event.id}
          className="flex flex-col gap-1 rounded-card border border-border bg-card p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">{summarize(event.eventType, event.payload)}</span>
            <span className="text-xs text-muted-foreground">Registrado por {event.actorUserId}</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {new Date(event.occurredAt).toLocaleString("es-CO")}
          </span>
        </li>
      ))}
    </ol>
  );
}
