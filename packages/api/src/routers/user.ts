import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { protectedProcedure, router } from "../index";

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => ctx.session.user),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.account.findFirst({
        where: { userId: ctx.session.user.id, providerId: "credential" },
      });
      if (!account?.password) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This account cannot change password this way." });
      }
      const ok = await verifyPassword({ hash: account.password, password: input.currentPassword });
      if (!ok) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
      }
      const password = await hashPassword(input.newPassword);
      await ctx.db.account.update({ where: { id: account.id }, data: { password } });
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { forcePasswordChange: false },
      });
      return { ok: true };
    }),
});
