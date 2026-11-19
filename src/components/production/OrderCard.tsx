import Link from "next/link";
import type { MasterFormula, ProductionOrder } from "@prisma/client";

export type OrderWithFormula = ProductionOrder & { formula: MasterFormula };

// Opens the order's detail page (weighing, signatures, QC, timeline). Found
// by the E2E suite: the card used to be a static block, leaving no way to
// reach an order from the board. Non-negotiable (CLAUDE.md): stage
// transitions only ever happen server-side via signing — `draggable={false}`
// ensures the Kanban never offers a client-side drag gesture the server
// state machine would have to reject.
export function OrderCard({ order }: { order: OrderWithFormula }) {
  return (
    <Link
      href={`/produccion/${order.id}`}
      draggable={false}
      className="flex min-h-[44px] flex-col gap-1 rounded-card border border-border bg-card p-3 text-sm transition-colors hover:border-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="font-mono font-semibold text-foreground">{order.orderNumber}</span>
      <span className="text-muted-foreground">{order.formula.name}</span>
    </Link>
  );
}
