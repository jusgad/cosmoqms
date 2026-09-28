import { z } from "zod";
import { randomUUID } from "crypto";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";

export const receiveLotInput = z.object({
  rawMaterialId: z.string().uuid(),
  supplierLotCode: z.string().min(1),
  supplierProvidedCode: z.string().optional(),
  quantityReceived: z.number().positive(),
  expiryDate: z.string(),
  coaDocumentUrl: z.string().url().optional(),
});

export const materialsRouter = router({
  list: roleProcedure("bodega", "jefe_planta", "calidad", "director_tecnico", "admin").query(
    ({ ctx }) => tenantTx(ctx, (tx) => tx.rawMaterial.findMany({ orderBy: { name: "asc" } })),
  ),
  getById: roleProcedure("bodega", "jefe_planta", "calidad", "director_tecnico", "admin")
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) =>
      tenantTx(ctx, (tx) => tx.rawMaterial.findUniqueOrThrow({ where: { id: input.id } })),
    ),
  create: roleProcedure("bodega", "admin")
    .input(z.object({ code: z.string(), name: z.string(), unit: z.string(), category: z.string().optional() }))
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, (tx) => tx.rawMaterial.create({ data: { ...input, tenantId: ctx.user.tenantId } })),
    ),
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
  setStatus: roleProcedure("bodega", "calidad")
    .input(z.object({ id: z.string().uuid(), status: z.enum(["liberado", "rechazado"]) }))
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, (tx) => tx.rawMaterialLot.update({ where: { id: input.id }, data: { status: input.status } })),
    ),
  listLots: roleProcedure("bodega", "jefe_planta", "calidad", "director_tecnico", "admin").query(
    ({ ctx }) =>
      tenantTx(ctx, (tx) =>
        tx.rawMaterialLot.findMany({
          orderBy: { receivedAt: "desc" },
          include: { rawMaterial: true },
        }),
      ),
  ),
});
