import { z } from "zod";
import { router, protectedProcedure, tenantTx } from "@/lib/trpc/trpc";

// Every role has an inbox, and each procedure is scoped to the caller's own
// notifications (`recipientUserId`) inside the caller's tenant — nobody can
// read or mark another person's notifications.
export const notificationsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    tenantTx(ctx, (tx) =>
      tx.notification.findMany({
        where: { tenantId: ctx.user.tenantId, recipientUserId: ctx.user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ),
  ),

  unreadCount: protectedProcedure.query(({ ctx }) =>
    tenantTx(ctx, (tx) =>
      tx.notification.count({
        where: { tenantId: ctx.user.tenantId, recipientUserId: ctx.user.id, readAt: null },
      }),
    ),
  ),

  markRead: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(({ ctx, input }) =>
    tenantTx(ctx, async (tx) => {
      const { count } = await tx.notification.updateMany({
        where: { id: input.id, tenantId: ctx.user.tenantId, recipientUserId: ctx.user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return { updated: count };
    }),
  ),

  markAllRead: protectedProcedure.mutation(({ ctx }) =>
    tenantTx(ctx, async (tx) => {
      const { count } = await tx.notification.updateMany({
        where: { tenantId: ctx.user.tenantId, recipientUserId: ctx.user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return { updated: count };
    }),
  ),
});
