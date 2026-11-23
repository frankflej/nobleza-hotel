import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, frontDeskProcedure, router } from "../index";

const category = z.enum(["General", "Complaint", "Compliment", "Suggestion"]);

export const feedbackRouter = router({
  submit: protectedProcedure
    .input(
      z.object({
        title: z.string().min(2),
        message: z.string().min(3),
        rating: z.number().int().min(1).max(5).default(5),
        category: category.default("General"),
        bookingId: z.number().int().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.feedback.create({
        data: {
          userId: ctx.session.user.id,
          title: input.title,
          message: input.message,
          rating: input.rating,
          category: input.category,
          bookingId: input.bookingId,
        },
      }),
    ),

  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db.feedback.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ),

  list: frontDeskProcedure.query(({ ctx }) =>
    ctx.db.feedback.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ),

  respond: frontDeskProcedure
    .input(z.object({ id: z.number().int(), staffResponse: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.feedback.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Feedback not found." });
      return ctx.db.feedback.update({
        where: { id: input.id },
        data: { staffResponse: input.staffResponse, status: "Reviewed" },
      });
    }),
});
