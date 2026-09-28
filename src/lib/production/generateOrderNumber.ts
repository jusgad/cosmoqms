import { prisma } from "@/lib/db";

// Consumed only by production.create. Format: OP-YYYY-NNN, consecutive per
// tenant per year. See task-9-report.md for the concurrency disclosure on
// the count-then-create race window.
export async function generateOrderNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.productionOrder.count({
    where: { tenantId, orderNumber: { startsWith: `OP-${year}-` } },
  });
  return `OP-${year}-${String(count + 1).padStart(3, "0")}`;
}
