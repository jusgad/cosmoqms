import type { CurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { weighingLotId } from "@/lib/production/weighing";
import { buildReportRows, type ReportHeader, type ReportRow } from "@/lib/reports/productionReport";

// "Activity in the period" = any batch event (weighing, signature event...),
// any signature, or a planned start inside [from, to]. That way a batch made
// in one month and released in the next shows up in both reports.
export async function loadProductionReport(
  user: CurrentUser,
  from: Date,
  to: Date,
): Promise<{ header: ReportHeader; rows: ReportRow[] }> {
  const tenantId = user.tenantId;
  const range = { gte: from, lte: to };

  return withTenant(tenantId, user.id, async (tx) => {
    const [organization, generatedBy, orders] = await Promise.all([
      tx.organization.findUnique({ where: { id: tenantId }, select: { name: true, nit: true, invimaRegistration: true } }),
      tx.user.findFirst({ where: { id: user.id, tenantId }, select: { fullName: true } }),
      tx.productionOrder.findMany({
        where: {
          tenantId,
          OR: [
            { events: { some: { occurredAt: range } } },
            { signatures: { some: { signedAt: range } } },
            { plannedStart: range },
          ],
        },
        orderBy: { orderNumber: "asc" },
        include: {
          formula: { select: { code: true, name: true } },
          signatures: { select: { stage: true, signedAt: true, signedBy: true } },
          qcResults: { select: { parameter: true, result: true } },
          deviations: { select: { status: true } },
          events: {
            where: { eventType: "weighing" },
            orderBy: { occurredAt: "asc" },
            select: { occurredAt: true, payload: true },
          },
        },
      }),
    ]);

    const lotIds = [
      ...new Set(
        orders.flatMap((order) => order.events.map((event) => weighingLotId(event.payload))).filter((id): id is string => !!id),
      ),
    ];
    const signerIds = [...new Set(orders.flatMap((order) => order.signatures.map((signature) => signature.signedBy)))];

    const [lots, signers] = await Promise.all([
      lotIds.length === 0
        ? []
        : tx.rawMaterialLot.findMany({
            where: { tenantId, id: { in: lotIds } },
            select: { id: true, supplierLotCode: true, rawMaterial: { select: { code: true } } },
          }),
      signerIds.length === 0
        ? []
        : tx.user.findMany({ where: { tenantId, id: { in: signerIds } }, select: { id: true, fullName: true } }),
    ]);

    const lotLabel = new Map(lots.map((lot) => [lot.id, `${lot.rawMaterial.code} lote ${lot.supplierLotCode}`]));
    const userNames = new Map(signers.map((signer) => [signer.id, signer.fullName]));

    const rows = buildReportRows(
      orders.map((order) => ({
        orderNumber: order.orderNumber,
        formulaCode: order.formula.code,
        formulaName: order.formula.name,
        formulaVersion: order.formulaVersion,
        plannedQuantity: Number(order.plannedQuantity),
        status: order.status,
        firstWeighingAt: order.events[0]?.occurredAt ?? null,
        signatures: order.signatures,
        qcResults: order.qcResults,
        deviations: order.deviations,
        rawMaterialLots: [
          ...new Set(
            order.events.flatMap((event) => {
              const id = weighingLotId(event.payload);
              const label = id ? lotLabel.get(id) : undefined;
              return label ? [label] : [];
            }),
          ),
        ],
      })),
      userNames,
    );

    return {
      header: {
        orgName: organization?.name ?? "CosmoQMS",
        nit: organization?.nit ?? null,
        invimaRegistration: organization?.invimaRegistration ?? null,
        from,
        to,
        generatedAt: new Date(),
        generatedBy: generatedBy?.fullName ?? user.id,
      },
      rows,
    };
  });
}
