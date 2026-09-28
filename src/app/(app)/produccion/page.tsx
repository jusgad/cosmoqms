import { redirect } from "next/navigation";
import Link from "next/link";
import type { BatchStatus, MasterFormula, ProductionOrder } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OrderWithFormula = ProductionOrder & { formula: MasterFormula };

// Kanban: one column per BatchStatus, except the two terminal states
// (liberado/rechazado) which share a column pair — per the brief's Step 9
// layout. Cards are display-only: `draggable={false}` everywhere, since
// stage transitions only ever happen server-side via signing (Task 11), the
// state machine (src/lib/production/stateMachine.ts) never trusts a
// client-reported drag-and-drop move.
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

function OrderCard({ order }: { order: OrderWithFormula }) {
  // No detail page exists yet (Tasks 10-13 build order actions/detail); the
  // card is a static, non-draggable display element for now.
  return (
    <div
      draggable={false}
      className="flex min-h-[44px] flex-col gap-1 rounded-card border border-border bg-card p-3 text-sm"
    >
      <span className="font-mono font-semibold text-foreground">{order.orderNumber}</span>
      <span className="text-muted-foreground">{order.formula.name}</span>
    </div>
  );
}

function Column({ label, orders }: { label: string; orders: OrderWithFormula[] }) {
  return (
    <div className="flex min-w-[240px] flex-1 flex-col gap-2 rounded-card border border-border bg-background p-3">
      <h2 className="font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label} <span className="font-mono text-muted-foreground">({orders.length})</span>
      </h2>
      <div className="flex flex-col gap-2">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
        {orders.length === 0 && <p className="text-xs text-muted-foreground">Sin órdenes.</p>}
      </div>
    </div>
  );
}

export default async function ProduccionPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const orders = await withTenant(user.tenantId, (tx) =>
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
          <Column key={column.status} label={column.label} orders={byStatus(column.status)} />
        ))}
        <div className={cn("flex min-w-[240px] flex-1 flex-col gap-2")}>
          {TERMINAL_COLUMNS.map((column) => (
            <Column key={column.status} label={column.label} orders={byStatus(column.status)} />
          ))}
        </div>
      </div>
    </div>
  );
}
