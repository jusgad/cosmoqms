import type { BatchStatus, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { canTransition } from "@/lib/production/stateMachine";

// The single server-side enforcement point for batch stage transitions
// (CLAUDE.md rule 7: never trust the client's reported state). Called from
// inside the caller's own `withTenant`/`tenantTx` transaction, right after it
// writes its own regulated row (weighing event, signature, QC decision), so
// both commit or roll back together.
//
// History:
// - Task 9: introduced in `production.ts`.
// - Task 11 review round 1 (TOCTOU race): the read-check-write is pinned by
//   folding the just-read `from` status into the `updateMany`'s own `where`;
//   if another transaction moved the order first, `count` is 0 and this
//   throws `CONFLICT` instead of silently overwriting.
// - Final review (Critical 2): moved out of the router file into
//   `lib/production/` (so `lib/production/weighing.ts` can use it without a
//   circular import through `production.ts`), and it now takes `tenantId`
//   and filters every query by it explicitly — defense in depth, since RLS
//   policies are not yet applied to any live database (Task 3 blocked) and
//   the app-level filter is the only tenant isolation that actually runs.
//   A cross-tenant `orderId` resolves to NOT_FOUND, never to another tenant's
//   order.
export async function advanceStageInternal(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  to: BatchStatus,
) {
  const order = await tx.productionOrder.findFirst({ where: { id: orderId, tenantId } });
  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Orden de producción no encontrada" });
  }
  if (!canTransition(order.status, to)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `No se puede pasar de ${order.status} a ${to}` });
  }
  const { count } = await tx.productionOrder.updateMany({
    where: { id: orderId, tenantId, status: order.status },
    data: { status: to },
  });
  if (count === 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `La orden ya no está en '${order.status}' — otra operación cambió su etapa`,
    });
  }
  const updated = await tx.productionOrder.findFirst({ where: { id: orderId, tenantId } });
  if (!updated) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Orden de producción no encontrada" });
  }
  return updated;
}
