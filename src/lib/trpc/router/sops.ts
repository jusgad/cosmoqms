import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import { assertReverified } from "@/lib/reauth";
import { approveSopInput, createSopInput, sopIdInput } from "@/lib/validation/sops";
import { acknowledgeSop, approveSop, createSopDraft, getSopDetail, listSops } from "@/lib/sops/service";

// SOP document control. Viewing and "leído y entendido" are for every floor
// role (admin does not operate on the floor, same as the menu); drafting is
// the quality unit's job; approval is the director técnico's electronic
// signature and requires a fresh Clerk re-verification.
const viewers = roleProcedure("jefe_planta", "calidad", "director_tecnico", "bodega");
// The administrator reads SOPs in supervision mode but never acknowledges
// them: "leído y entendido" is a floor-staff training record.
const readers = roleProcedure("jefe_planta", "calidad", "director_tecnico", "bodega", "admin");

export const sopsRouter = router({
  list: readers.query(({ ctx }) => tenantTx(ctx, (tx) => listSops(tx, ctx.user.tenantId, ctx.user.id))),
  getById: readers
    .input(sopIdInput)
    .query(({ ctx, input }) => tenantTx(ctx, (tx) => getSopDetail(tx, ctx.user.tenantId, input.id, ctx.user.id))),
  create: roleProcedure("calidad", "director_tecnico")
    .input(createSopInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, (tx) => createSopDraft(tx, { tenantId: ctx.user.tenantId, actorUserId: ctx.user.id, input })),
    ),
  approve: roleProcedure("director_tecnico")
    .input(approveSopInput)
    .mutation(async ({ ctx, input }) => {
      await assertReverified("aprobar el procedimiento");
      return tenantTx(ctx, (tx) => approveSop(tx, { tenantId: ctx.user.tenantId, actorUserId: ctx.user.id, input }));
    }),
  acknowledge: viewers
    .input(sopIdInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, (tx) => acknowledgeSop(tx, { tenantId: ctx.user.tenantId, userId: ctx.user.id, id: input.id })),
    ),
});
