import { redirect } from "next/navigation";
import Link from "next/link";
import type { BatchStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { OrderColumn } from "@/components/production/OrderColumn";
import { cn } from "@/lib/utils";

// Kanban: one column per BatchStatus, except the two terminal states
// (liberado/rechazado) which share a column pair — per the brief's Step 9
// layout. Cards are display-only: `draggable={false}` everywhere (see
// OrderCard), since stage transitions only ever happen server-side via
// signing (Task 11), the state machine (src/lib/production/stateMachine.ts)
// never trusts a client-reported drag-and-drop move.
const COLUMNS: { status: BatchStatus; label: string }[] = [
  { status: "planificado", label: "Planificado" },
  { status: "pesado", label: "Pesado" },
  { status: "mezclado", label: "Mezclado" },
  { status: "envasado", label: "Envasado" },
  { status: "calidad", label: "Calidad" },
];

const TERMINAL_COLUMNS: { status: BatchStatus; label: string }[] = [
  { status: "liberado", label: "Liberado" },
  { status: "rechazado", label: "Rechazado" },
];

export default async function ProduccionPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const orders = await withTenant(user.tenantId, user.id, (tx) =>
    tx.productionOrder.findMany({ orderBy: { orderNumber: "asc" }, include: { formula: true } }),
  );

  const byStatus = (status: BatchStatus) => orders.filter((order) => order.status === status);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-sans text-2xl font-semibold text-foreground">Producción</h1>
        {user.role === "jefe_planta" && (
          <Button render={<Link href="/produccion/nueva">Nueva orden</Link>} />
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((column) => (
          <OrderColumn key={column.status} label={column.label} orders={byStatus(column.status)} />
        ))}
        <div className={cn("flex min-w-[240px] flex-1 flex-col gap-2")}>
          {TERMINAL_COLUMNS.map((column) => (
            <OrderColumn key={column.status} label={column.label} orders={byStatus(column.status)} />
          ))}
        </div>
      </div>
    </div>
  );
}
