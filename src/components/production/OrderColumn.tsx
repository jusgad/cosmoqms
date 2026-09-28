import { OrderCard, type OrderWithFormula } from "@/components/production/OrderCard";

export function OrderColumn({ label, orders }: { label: string; orders: OrderWithFormula[] }) {
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
