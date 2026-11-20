import { TRPCError } from "@trpc/server";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import { updateOrganizationInput } from "@/lib/validation/organization";

const FIELDS = { name: true, nit: true, invimaRegistration: true } as const;

// Company settings (/configuracion), admin only. The data appears on the
// regulatory reports, so every change is audited with before/after.
export const organizationRouter = router({
  get: roleProcedure("admin").query(({ ctx }) =>
    tenantTx(ctx, (tx) => tx.organization.findFirstOrThrow({ where: { id: ctx.user.tenantId }, select: FIELDS })),
  ),
  update: roleProcedure("admin")
    .input(updateOrganizationInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const before = await tx.organization.findFirst({ where: { id: ctx.user.tenantId }, select: FIELDS });
        if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Organización no encontrada" });
        const after = await tx.organization.update({ where: { id: ctx.user.tenantId }, data: input, select: FIELDS });
        await tx.auditLog.create({
          data: {
            tenantId: ctx.user.tenantId,
            tableName: "Organization",
            recordId: ctx.user.tenantId,
            action: "update",
            beforeData: before,
            afterData: after,
            actorUserId: ctx.user.id,
            occurredAt: new Date(),
          },
        });
        return after;
      }),
    ),
});
