import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import { updateUserInput } from "@/lib/validation/users";
import { listUsers, updateUser } from "@/lib/users/admin";

// Only `admin` manages users (same gate as the /usuarios page and the
// Sidebar entry; the page gate is never the only enforcement).
export const usersRouter = router({
  list: roleProcedure("admin").query(({ ctx }) => tenantTx(ctx, (tx) => listUsers(tx, ctx.user.tenantId))),
  update: roleProcedure("admin")
    .input(updateUserInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, (tx) => updateUser(tx, { tenantId: ctx.user.tenantId, actorUserId: ctx.user.id, input })),
    ),
});
