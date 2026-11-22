import { FileSpreadsheet, FileText } from "lucide-react";
import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { Button } from "@/components/ui/button";

const inputClasses =
  "h-11 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// A plain GET form straight to the report route: the browser downloads the
// file itself, so this page needs no client JavaScript.
export default async function ReportesPage() {
  await requirePageRole(MODULE_ROLES.reportes);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-sans text-2xl font-semibold text-foreground">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Reporte consolidado de producción y calidad (BPM) para inspecciones y auditorías del INVIMA.
        </p>
      </div>

      <form
        action="/api/reports/produccion"
        method="get"
        className="flex flex-col gap-4 rounded-card border border-border bg-card p-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="from" className="text-sm font-medium text-foreground">
              Desde
            </label>
            <input id="from" name="from" type="date" required defaultValue={isoDay(monthStart)} className={inputClasses} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="to" className="text-sm font-medium text-foreground">
              Hasta
            </label>
            <input id="to" name="to" type="date" required defaultValue={isoDay(today)} className={inputClasses} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" name="format" value="pdf">
            <FileText data-icon="inline-start" />
            Descargar PDF
          </Button>
          <Button type="submit" name="format" value="csv" variant="outline">
            <FileSpreadsheet data-icon="inline-start" />
            Descargar Excel (CSV)
          </Button>
        </div>
      </form>

      <section aria-labelledby="report-contents" className="flex flex-col gap-2 text-sm text-foreground">
        <h2 id="report-contents" className="font-sans text-lg font-semibold">
          Qué incluye
        </h2>
        <p>
          Una fila por cada orden de producción con actividad en el período: fórmula y versión, cantidad
          planificada, inicio de producción, resultados de QC y parámetros no conformes, desviaciones (abiertas y
          totales), decisión final de liberación o rechazo con quien la firmó, y los lotes de materia prima
          consumidos (trazabilidad).
        </p>
        <p className="text-muted-foreground">
          El encabezado lleva el NIT y el registro INVIMA de la organización, y el PDF deja un espacio para la firma
          de revisión del Director Técnico. INVIMA no publica una plantilla única de exportación: esta estructura
          sigue el contenido del registro de lote de las BPM para cosméticos y conviene validarla con el Director
          Técnico antes de presentarla.
        </p>
      </section>
    </div>
  );
}
