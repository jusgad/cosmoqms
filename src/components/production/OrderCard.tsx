import type { MasterFormula, ProductionOrder } from "@prisma/client";

export type OrderWithFormula = ProductionOrder & { formula: MasterFormula };

// No detail page exists yet (Tasks 10-13 build order actions/detail); the
// card is a static, non-draggable display element for now. Non-negotiable
// (CLAUDE.md): stage transitions only ever happen server-side via signing
// (Task 11+) — `draggable={false}` ensures the Kanban never offers a
// client-side drag gesture the server state machine would have to reject.
export function OrderCard({ order }: { order: OrderWithFormula }) {
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
