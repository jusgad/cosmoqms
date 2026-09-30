"use client";

// Client Component: the filter form (table/user/date-range inputs) and the
// "Exportar CSV" button need real interactivity (state, a client-side Blob
// download) — same reasoning as every other client component in this
// codebase (TraceabilitySearch.tsx, DeviationForm.tsx, etc.).
//
// Bundle-safety (Task 7/16 lesson, reapplied here): this file imports only
// `@/lib/trpc/client`'s React hooks and the schema-only
// `@/lib/validation/audit` module — never `@/lib/trpc/router/audit` itself,
// which would drag `PrismaClient`/`@/lib/db` into the browser bundle.
import { useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import type { AuditSearchValues } from "@/lib/validation/audit";

const REGULATED_TABLES = ["ProductionOrder", "BatchEvent", "QcResult", "Deviation", "FinishedProductLot"];

function toDateTimeIso(dateOnly: string, endOfDay: boolean): string | undefined {
  if (!dateOnly) return undefined;
  return endOfDay ? `${dateOnly}T23:59:59.999Z` : `${dateOnly}T00:00:00.000Z`;
}

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AuditLogView() {
  const [tableName, setTableName] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filters, setFilters] = useState<AuditSearchValues>({});
  const [isExporting, setIsExporting] = useState(false);

  const searchQuery = trpc.audit.search.useQuery(filters);
  const exportQuery = trpc.audit.export.useQuery(filters, { enabled: false });

  function buildFilters(): AuditSearchValues {
    return {
      tableName: tableName || undefined,
      actorUserId: actorUserId.trim() || undefined,
      dateFrom: toDateTimeIso(dateFrom, false),
      dateTo: toDateTimeIso(dateTo, true),
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters(buildFilters());
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const { data } = await exportQuery.refetch();
      if (data) downloadCsv(data);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="audit-table" className="text-sm font-medium text-foreground">
            Tabla
          </label>
          <select
            id="audit-table"
            value={tableName}
            onChange={(event) => setTableName(event.target.value)}
            className="h-11 min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Todas</option>
            {REGULATED_TABLES.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="audit-actor" className="text-sm font-medium text-foreground">
            ID de usuario
          </label>
          <input
            id="audit-actor"
            type="text"
            value={actorUserId}
            onChange={(event) => setActorUserId(event.target.value)}
            placeholder="actorUserId"
            className="h-11 min-h-[44px] w-44 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="audit-from" className="text-sm font-medium text-foreground">
            Desde
          </label>
          <input
            id="audit-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-11 min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="audit-to" className="text-sm font-medium text-foreground">
            Hasta
          </label>
          <input
            id="audit-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-11 min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <Button type="submit">Filtrar</Button>
        <Button type="button" variant="outline" onClick={handleExport} disabled={isExporting}>
          <Download className="size-4" aria-hidden />
          {isExporting ? "Exportando..." : "Exportar CSV"}
        </Button>
      </form>

      {searchQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando registros...</p>}
      {searchQuery.isError && (
        <p className="text-sm text-destructive">No se pudo cargar el registro de auditoría.</p>
      )}

      {searchQuery.isSuccess && (
        <div className="overflow-x-auto rounded-card border border-border bg-card">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Fecha", "Tabla", "Registro", "Acción", "Usuario"].map((header) => (
                  <th
                    key={header}
                    className="h-11 px-4 text-left font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {searchQuery.data.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">
                    {new Date(row.occurredAt).toLocaleString("es-CO")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{row.tableName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{row.recordId}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{row.action}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{row.actorUserId}</td>
                </tr>
              ))}
              {searchQuery.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Sin registros de auditoría para estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
