import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { formatRange } from "@/lib/quality/formatSpec";
import type { BatchRecordOrder } from "@/lib/pdf";

// Gathers everything the batch-record PDF prints for one production order:
// organization header, formula, weighings with the raw-material lot used,
// electronic signatures, QC results against their specification, deviations
// and the event trail — with user ids resolved to names. Runs inside the
// caller's `withTenant` transaction and filters every query by `tenantId`
// explicitly (defense in depth on top of RLS).

const EVENT_LABELS: Record<string, string> = {
  weighing: "Pesaje",
  signature: "Firma electrónica",
};

type WeighingPayload = { rawMaterialLotId?: unknown; theoreticalQty?: unknown; actualQty?: unknown };

function asWeighing(payload: Prisma.JsonValue): { lotId: string; theoretical: number; actual: number } | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = payload as WeighingPayload;
  if (typeof data.rawMaterialLotId !== "string") return null;
  return { lotId: data.rawMaterialLotId, theoretical: Number(data.theoreticalQty ?? 0), actual: Number(data.actualQty ?? 0) };
}

export async function loadBatchRecord(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  generatedBy: string,
): Promise<BatchRecordOrder> {
  const order = await tx.productionOrder.findFirst({
    where: { id: orderId, tenantId },
    include: {
      formula: { include: { qcSpecifications: true } },
      signatures: { orderBy: { signedAt: "asc" } },
      qcResults: { orderBy: { recordedAt: "asc" } },
      deviations: true,
      events: { orderBy: { occurredAt: "asc" } },
      finishedLot: true,
    },
  });
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada" });

  const weighingEvents = order.events
    .filter((event) => event.eventType === "weighing")
    .map((event) => ({ event, data: asWeighing(event.payload) }))
    .filter((item): item is { event: (typeof order.events)[number]; data: NonNullable<ReturnType<typeof asWeighing>> } =>
      item.data !== null,
    );

  const [organization, lots, users] = await Promise.all([
    tx.organization.findUnique({ where: { id: tenantId } }),
    tx.rawMaterialLot.findMany({
      where: { tenantId, id: { in: weighingEvents.map((item) => item.data.lotId) } },
      include: { rawMaterial: true },
    }),
    tx.user.findMany({ where: { tenantId }, select: { id: true, fullName: true } }),
  ]);
  const lotById = new Map(lots.map((lot) => [lot.id, lot]));
  const nameOf = (id: string | null | undefined): string => (id ? (users.find((user) => user.id === id)?.fullName ?? id) : "—");

  const specs = order.formula.qcSpecifications;
  const specFor = (parameter: string): string | undefined => {
    const spec = specs.find((item) => item.parameter.trim().toLowerCase() === parameter.trim().toLowerCase());
    return spec
      ? formatRange({
          minValue: spec.minValue === null ? null : Number(spec.minValue),
          maxValue: spec.maxValue === null ? null : Number(spec.maxValue),
          unit: spec.unit,
        })
      : undefined;
  };

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    organization: organization
      ? { name: organization.name, nit: organization.nit, invimaRegistration: organization.invimaRegistration }
      : undefined,
    formula: { code: order.formula.code, name: order.formula.name, version: order.formulaVersion },
    plannedQuantity: Number(order.plannedQuantity),
    plannedStart: order.plannedStart?.toISOString(),
    finishedLotCode: order.finishedLot?.code ?? null,
    generatedAt: new Date().toISOString(),
    generatedBy: nameOf(generatedBy),
    weighings: weighingEvents.map(({ event, data }) => {
      const lot = lotById.get(data.lotId);
      return {
        material: lot ? `${lot.rawMaterial.code} — ${lot.rawMaterial.name}` : data.lotId,
        supplierLot: lot?.supplierLotCode ?? "—",
        theoreticalQty: data.theoretical,
        actualQty: data.actual,
        unit: lot?.rawMaterial.unit ?? "",
        weighedBy: nameOf(event.actorUserId),
        weighedAt: event.occurredAt.toISOString(),
      };
    }),
    signatures: order.signatures.map((signature) => ({
      stage: signature.stage,
      signedBy: nameOf(signature.signedBy),
      meaningStatement: signature.meaningStatement,
      signedAt: signature.signedAt.toISOString(),
    })),
    qcResults: order.qcResults.map((result) => ({
      parameter: result.parameter,
      measuredValue: Number(result.measuredValue),
      result: result.result,
      specification: specFor(result.parameter),
      recordedBy: nameOf(result.recordedBy),
    })),
    deviations: order.deviations.map((deviation) => ({
      description: deviation.description,
      status: deviation.status,
      investigation: deviation.investigation,
      correctiveAction: deviation.correctiveAction,
      raisedBy: nameOf(deviation.raisedBy),
      approvedBy: deviation.approvedBy ? nameOf(deviation.approvedBy) : null,
    })),
    events: order.events.map((event) => ({
      eventType: EVENT_LABELS[event.eventType] ?? event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      actorUserId: nameOf(event.actorUserId),
    })),
  };
}
