import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";

// Shape written by Task 10's `recordWeighing` into `batch_events.payload`
// for `eventType: "weighing"` rows. `payload` is untyped `Json` at the
// Prisma level, so this is the narrow, local contract this router relies on
// rather than trusting `Prisma.JsonValue` shape-lessly (zero-`any`
// constraint — no `(e: any) => ...` casts as in the brief's literal code).
type WeighingPayload = { rawMaterialLotId?: string };
function weighingLotId(payload: Prisma.JsonValue): string | undefined {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const id = (payload as WeighingPayload).rawMaterialLotId;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

// Discrepancy correction (see task-16-report.md): the brief's own note
// claims `byRawMaterialLot`'s `batchEvent.findMany` doesn't need an explicit
// `tenantId` filter because it's "already implicit via tenantTx's SET
// LOCAL + RLS". That contradicts the established convention in every prior
// router (qc.ts, deviations.ts, production.ts, materials.ts) of always
// including an explicit `tenantId` in `where` as defense-in-depth — a
// convention Task 9's review explicitly called out, and one that matters
// more, not less, while Task 3's RLS policies remain blocked with no live
// DB to enforce them at all. Both procedures below filter by `tenantId`
// explicitly, matching the rest of the codebase.
//
// Real-gap resolution (see task-16-report.md): the brief's procedures took
// a raw `*LotId: string().uuid()` input, but a calidad/director_tecnico user
// doing a traceability search types a human-readable LOT CODE, never a UUID
// they'd never know. Rather than pushing a separate lookup step onto the
// client (option b in the report — the page would need a UUID-resolution
// round trip via an endpoint that, for finished-product lots, doesn't even
// exist yet), the lookup is done here, server-side, in the same
// `tenantTx` as the genealogy query: each procedure accepts a `*Code`
// string and resolves it to the lot's id via `findFirstOrThrow` before
// running the same query logic the brief specified.
//
// Review round 1 (Important finding): the brief's literal return shape was a
// bare list of ids (`productionOrderId[]` / `rawMaterialLotId[]`), which
// resolved the search-*input* half of "human code, not UUID" but left the
// *output* rendering a wall of UUIDs — inconsistent with the rest of the app
// (e.g. `calidad/page.tsx`'s table shows `orderNumber`, never
// `ProductionOrder.id`). Both procedures now return `{ id, <human field> }[]`
// instead of a bare `string[]`, fetched via one small additional
// tenant-scoped query over the distinct ids already collected.
export const traceabilityRouter = router({
  byRawMaterialLot: roleProcedure("calidad", "director_tecnico")
    .input(z.object({ rawMaterialLotCode: z.string().min(1) }))
    .query(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        // A raw material lot's human-readable identifier may be the
        // supplier's own lot code (on the COA/physical label — what a
        // calidad user would realistically type), the supplier-provided
        // code, or the internally generated `qrCode` (`MP-<uuid>`, Task 7)
        // when scanned/copied from a printed label. Matching all three
        // mirrors WeighingForm.tsx's existing scan-match lookup.
        const lot = await tx.rawMaterialLot.findFirstOrThrow({
          where: {
            tenantId: ctx.user.tenantId,
            OR: [
              { supplierLotCode: input.rawMaterialLotCode },
              { supplierProvidedCode: input.rawMaterialLotCode },
              { qrCode: input.rawMaterialLotCode },
            ],
          },
        });
        const events = await tx.batchEvent.findMany({
          where: { tenantId: ctx.user.tenantId, eventType: "weighing" },
        });
        const matches = events.filter((e) => weighingLotId(e.payload) === lot.id);
        const productionOrderIds = [...new Set(matches.map((e) => e.productionOrderId))];
        if (productionOrderIds.length === 0) return [];

        // Human-readable label: `ProductionOrder.orderNumber` (e.g.
        // "OP-2026-001"), already used everywhere else in the app
        // (calidad/page.tsx's table, etc.) instead of the raw id.
        const orders = await tx.productionOrder.findMany({
          where: { tenantId: ctx.user.tenantId, id: { in: productionOrderIds } },
          select: { id: true, orderNumber: true },
        });
        return orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber }));
      }),
    ),
  byFinishedLot: roleProcedure("calidad", "director_tecnico")
    .input(z.object({ finishedProductLotCode: z.string().min(1) }))
    .query(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const finished = await tx.finishedProductLot.findFirstOrThrow({
          where: { tenantId: ctx.user.tenantId, code: input.finishedProductLotCode },
        });
        const events = await tx.batchEvent.findMany({
          where: {
            tenantId: ctx.user.tenantId,
            productionOrderId: finished.productionOrderId,
            eventType: "weighing",
          },
        });
        const rawMaterialLotIds = [
          ...new Set(events.map((e) => weighingLotId(e.payload)).filter((id): id is string => Boolean(id))),
        ];
        if (rawMaterialLotIds.length === 0) return [];

        // Human-readable label: the raw material lot's `supplierLotCode`
        // (same field calidad reads off the COA/physical label elsewhere in
        // the app — LotManualSearch.tsx, WeighingForm.tsx) instead of the
        // raw id.
        const lots = await tx.rawMaterialLot.findMany({
          where: { tenantId: ctx.user.tenantId, id: { in: rawMaterialLotIds } },
          select: { id: true, supplierLotCode: true },
        });
        return lots.map((l) => ({ id: l.id, supplierLotCode: l.supplierLotCode }));
      }),
    ),
});
