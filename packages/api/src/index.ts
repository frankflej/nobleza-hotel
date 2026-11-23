import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import type { Role } from "@NOBLEZA/db";

export const t = initTRPC.context<Context>().create();
export const router = t.router;
export const publicProcedure = t.procedure;

function roleOf(ctx: Context): Role | undefined {
  return ctx.session?.user?.role;
}

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in." });
  }
  if (ctx.session.user.status !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account has been deactivated.",
    });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export function roleProcedure(...roles: Role[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    const role = roleOf(ctx);
    if (!role || !roles.includes(role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Role '${role ?? "unknown"}' is not allowed to do this.`,
      });
    }
    return next({ ctx });
  });
}

export const staffProcedure = roleProcedure(
  "receptionist",
  "housekeeping",
  "manager",
  "admin",
);
export const frontDeskProcedure = roleProcedure("receptionist", "manager", "admin");
export const housekeepingProcedure = roleProcedure(
  "housekeeping",
  "manager",
  "admin",
);
export const managerProcedure = roleProcedure("manager", "admin");
export const adminProcedure = roleProcedure("admin");
