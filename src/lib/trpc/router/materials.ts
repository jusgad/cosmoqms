import { z } from "zod";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import { receiveLotInput } from "@/lib/validation/materials";

export const materialsRouter = router({
  list: roleProcedure("bodega", "jefe_planta", "calidad", "director_tecnico", "admin").query(
    ({ ctx }) => tenantTx(ctx, (tx) => tx.rawMaterial.findMany({ orderBy: { name: "asc" } })),
  ),
  getById: roleProcedure("bodega", "jefe_planta", "calidad", "director_tecnico", "admin")
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) =>
      tenantTx(ctx, (tx) => tx.rawMaterial.findUniqueOrThrow({ where: { id: input.id } })),
    ),
  // TODO(Task 17): audit_log write via Prisma extension — `create` writes to
  // a regulated table (raw_materials) and per CLAUDE.md rule 2 must record
  // an audit_log row in the same transaction. Deferred until the shared
  // Prisma audit middleware/extension lands in Task 17; not silently missed.
  create: roleProcedure("bodega", "admin")
    .input(z.object({ code: z.string(), name: z.string(), unit: z.string(), category: z.string().optional() }))
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, (tx) => tx.rawMaterial.create({ data: { ...input, tenantId: ctx.user.tenantId } })),
    ),
  // TODO(Task 17): audit_log write via Prisma extension — `receiveLot`
  // writes to a regulated table (raw_material_lots); same deferral as above.
  receiveLot: roleProcedure("bodega")
    .input(receiveLotInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, (tx) =>
        tx.rawMaterialLot.create({
          data: {
            tenantId: ctx.user.tenantId,
            rawMaterialId: input.rawMaterialId,
            supplierLotCode: input.supplierLotCode,
            supplierProvidedCode: input.supplierProvidedCode,
            coaDocumentUrl: input.coaDocumentUrl,
            quantityReceived: input.quantityReceived,
            quantityAvailable: input.quantityReceived,
            expiryDate: new Date(input.expiryDate),
            status: "cuarentena",
            // Generated unconditionally regardless of supplierProvidedCode —
            // receipt must never depend on the supplier providing a code.
            qrCode: `MP-${randomUUID()}`,
          },
        }),
      ),
    ),
  // TODO(Task 17): audit_log write via Prisma extension — `setStatus`
  // writes to a regulated table (raw_material_lots); same deferral as above.
  //
  // Server-side state machine (CLAUDE.md rule 7 — never trust client state):
  // a lot may only move out of `cuarentena`. The `updateMany` below folds the
  // current-status check into the `where` clause so the read and the guarded
  // write happen atomically inside the same transaction; if zero rows match,
  // the lot either doesn't exist or already left `cuarentena`, and either way
  // the transition is rejected.
  setStatus: roleProcedure("bodega", "calidad")
    .input(z.object({ id: z.string().uuid(), status: z.enum(["liberado", "rechazado"]) }))
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const { count } = await tx.rawMaterialLot.updateMany({
          where: { id: input.id, status: "cuarentena" },
          data: { status: input.status },
        });
        if (count === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "El lote no existe o ya no está en cuarentena.",
          });
        }
        return tx.rawMaterialLot.findUniqueOrThrow({ where: { id: input.id } });
      }),
    ),
  // `operario` included (task-10 review round 1 fix): the weighing screen
  // (WeighingForm.tsx) is used by `operario` to select a lot to weigh
  // against, so it needs read access to this listing. Read-only, scoped to
  // lot data already filtered client-side to `status === "liberado"` — no
  // separation-of-duties rule is affected.
  listLots: roleProcedure("bodega", "jefe_planta", "calidad", "director_tecnico", "admin", "operario").query(
    ({ ctx }) =>
      tenantTx(ctx, (tx) =>
        tx.rawMaterialLot.findMany({
          orderBy: { receivedAt: "desc" },
          include: { rawMaterial: true },
        }),
      ),
  ),
});
