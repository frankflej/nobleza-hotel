import { z } from "zod";
import { protectedProcedure, router } from "../index";

export const notificationsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.notification.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ),
  markRead: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ ctx, input }) =>
      ctx.db.notification.updateMany({
        where: { id: input.id, userId: ctx.session.user.id },
        data: { read: true },
      }),
    ),
  markAllRead: protectedProcedure.mutation(({ ctx }) =>
    ctx.db.notification.updateMany({
      where: { userId: ctx.session.user.id },
      data: { read: true },
    }),
  ),
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ ctx, input }) =>
      ctx.db.notification.deleteMany({
        where: { id: input.id, userId: ctx.session.user.id },
      }),
    ),
});
