import type { BatchStatus, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { advanceStageInternal } from "@/lib/production/advanceStage";

// Final-review fix (Important 7c + Critical 2): the single server-side
// implementation of "record one weighing", shared by BOTH write paths that
// append a `weighing` BatchEvent — `production.recordWeighing` (tRPC) and
// `/api/sync/events` (offline sync). Before this, both trusted the client
// completely: any `rawMaterialLotId` (quarantined, rejected, expired, another
// tenant's, or a material not even in the formula) and any `theoreticalQty`
// were accepted, and `RawMaterialLot.quantityAvailable` was never decremented
// anywhere in the codebase.
//
// Everything below runs inside the caller's `withTenant` transaction, so the
// stock decrement, the event insert and the stage advance commit or roll
// back together.

export type WeighingInput = {
  tenantId: string;
  actorUserId: string;
  productionOrderId: string;
  rawMaterialLotId: string;
  actualQty: number;
  clientEventId: string;
  occurredAt: Date;
  deviceId?: string;
};

// A weighing is only meaningful while the batch is still in its weighing
// phase: `planificado` (first weighing — advances to `pesado`) or `pesado`
// (the remaining ingredients of a multi-ingredient formula, before the
// `pesado` stage is signed off). Once the `pesado` signature moved the order
// on to `mezclado`, the weighing record is closed — `production.sign` only
// accepts that signature once EVERY formula ingredient has a weighing — so a
// later weighing is an anomaly to surface (and, if real, raise a deviation
// for), never something to append silently. That also covers the terminal
// `liberado`/`rechazado` states (Important 7a: weighings were previously
// appended to already-released, closed batch records).
const WEIGHABLE_STATUSES: readonly BatchStatus[] = ["planificado", "pesado"];

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function reject(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export async function applyWeighing(tx: Prisma.TransactionClient, input: WeighingInput) {
  const { tenantId } = input;

  const order = await tx.productionOrder.findFirst({
    where: { id: input.productionOrderId, tenantId },
    include: { formula: { include: { ingredients: true } } },
  });
  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Orden de producción no encontrada" });
  }
  if (!WEIGHABLE_STATUSES.includes(order.status)) {
    reject(`La orden está en '${order.status}' — ya no admite pesajes`);
  }

  const lot = await tx.rawMaterialLot.findFirst({ where: { id: input.rawMaterialLotId, tenantId } });
  if (!lot) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Lote de materia prima no encontrado" });
  }
  if (lot.status !== "liberado") {
    reject(`El lote está en '${lot.status}' — solo lotes liberados pueden pesarse`);
  }
  // `expiryDate` is a `@db.Date` (midnight UTC). A lot is usable through its
  // expiry date, so it's expired only once that date is strictly before
  // today (UTC) — judged by the server clock, never the device's.
  if (lot.expiryDate < startOfUtcDay(new Date())) {
    reject("El lote está vencido");
  }

  const ingredient = order.formula.ingredients.find((item) => item.rawMaterialId === lot.rawMaterialId);
  if (!ingredient) {
    reject("El lote no corresponde a ningún ingrediente de la fórmula de esta orden");
  }

  // Server-side recomputation of `theoreticalQty` — the same formula
  // `WeighingForm.tsx` uses client-side (`percentage / 100 * plannedQuantity`),
  // but from the server's own formula/order rows. The persisted value is
  // always this one; any client-sent `theoreticalQty` is ignored, since it is
  // exactly the kind of client state CLAUDE.md says never to trust.
  const theoreticalQty = (Number(ingredient.percentage) / 100) * Number(order.plannedQuantity);

  // Atomic, TOCTOU-safe stock decrement: the `where` re-checks the lot is
  // still `liberado` and still has enough stock at write time, so two
  // concurrent weighings can never drive `quantityAvailable` negative.
  const { count } = await tx.rawMaterialLot.updateMany({
    where: { id: lot.id, tenantId, status: "liberado", quantityAvailable: { gte: input.actualQty } },
    data: { quantityAvailable: { decrement: input.actualQty } },
  });
  if (count === 0) {
    reject("Cantidad disponible insuficiente en el lote para este pesaje");
  }

  const event = await tx.batchEvent.create({
    data: {
      tenantId,
      productionOrderId: order.id,
      eventType: "weighing",
      payload: { rawMaterialLotId: lot.id, theoreticalQty, actualQty: input.actualQty },
      actorUserId: input.actorUserId,
      occurredAt: input.occurredAt,
      clientEventId: input.clientEventId,
      deviceId: input.deviceId,
    },
  });

  // Only the FIRST weighing is a real `planificado -> pesado` transition;
  // later ones (order already `pesado`) have nothing to advance.
  if (order.status === "planificado") {
    try {
      await advanceStageInternal(tx, tenantId, order.id, "pesado");
    } catch (err) {
      // A concurrent weighing for another ingredient of the same order won
      // the race and already advanced it to `pesado` — that's the outcome
      // this call wanted, not a failure. Anything else is re-thrown.
      if (!(err instanceof TRPCError && err.code === "CONFLICT")) throw err;
      const current = await tx.productionOrder.findFirst({ where: { id: order.id, tenantId } });
      if (current?.status !== "pesado") throw err;
    }
  }

  return event;
}

// `batch_events.payload` is untyped `Json`; this is the narrow contract for
// `weighing` rows written by `applyWeighing` above.
export function weighingLotId(payload: Prisma.JsonValue): string | undefined {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const id = (payload as { rawMaterialLotId?: unknown }).rawMaterialLotId;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

// Final-review fix (Important 6): signing the `pesado` stage attests that the
// whole formula was weighed. Before this, one weighing of one ingredient was
// enough to sign `pesado` for a multi-ingredient formula. Coverage is judged
// per RAW MATERIAL (via each weighed lot's `rawMaterialId`), not by counting
// distinct lots — two lots of the same ingredient (a split weighing) must not
// stand in for a different, never-weighed ingredient.
export async function assertAllIngredientsWeighed(
  tx: Prisma.TransactionClient,
  tenantId: string,
  order: { id: string; formulaId: string },
): Promise<void> {
  const ingredients = await tx.formulaIngredient.findMany({
    where: { formulaId: order.formulaId, formula: { tenantId } },
    select: { rawMaterialId: true },
  });
  const weighings = await tx.batchEvent.findMany({
    where: { tenantId, productionOrderId: order.id, eventType: "weighing" },
    select: { payload: true },
  });
  const lotIds = [
    ...new Set(weighings.map((w) => weighingLotId(w.payload)).filter((id): id is string => id !== undefined)),
  ];
  const lots =
    lotIds.length === 0
      ? []
      : await tx.rawMaterialLot.findMany({ where: { id: { in: lotIds }, tenantId }, select: { rawMaterialId: true } });
  const weighedMaterials = new Set(lots.map((lot) => lot.rawMaterialId));
  const missing = ingredients.filter((ingredient) => !weighedMaterials.has(ingredient.rawMaterialId));

  if (ingredients.length === 0 || missing.length > 0) {
    reject(
      `Faltan ${missing.length === 0 ? "ingredientes" : `${missing.length} ingrediente(s)`} por pesar antes de firmar el pesaje`,
    );
  }
}
