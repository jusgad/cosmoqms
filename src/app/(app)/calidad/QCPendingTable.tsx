"use client";

// Client Component: expanding a row to reveal QCResultForm requires
// interactive state (useState) — the data itself is fetched server-side in
// page.tsx via direct Prisma access and passed down as a plain prop, same
// pattern as materias-primas/LotsDataTable.tsx.

import { Fragment, useState } from "react";
import { QCResultForm } from "@/components/quality/QCResultForm";

export type PendingOrderRow = {
  id: string;
  orderNumber: string;
  formulaId: string;
  formulaName: string;
  plannedQuantity: number;
};

const headerCellClasses = "h-11 px-4 text-left font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase";

export function QCPendingTable({ data }: { data: PendingOrderRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={headerCellClasses}>Orden</th>
            <th className={headerCellClasses}>Fórmula</th>
            <th className={headerCellClasses}>Cantidad planeada</th>
            <th className={`${headerCellClasses} text-right`}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {data.map((order) => {
            const isExpanded = expandedId === order.id;
            return (
              <Fragment key={order.id}>
                <tr className="border-b border-border last:border-0 hover:bg-muted">
                  <td className="px-4 py-3 font-mono">{order.orderNumber}</td>
                  <td className="px-4 py-3">{order.formulaName}</td>
                  <td className="px-4 py-3 font-mono">{order.plannedQuantity}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-primary hover:underline"
                    >
                      {isExpanded ? "Cerrar" : "Registrar resultado"}
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-border last:border-0">
                    <td colSpan={4} className="bg-background px-4 py-4">
                      <QCResultForm productionOrderId={order.id} formulaId={order.formulaId} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                No hay órdenes pendientes de calidad.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
