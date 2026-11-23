import { randomBytes } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { hashPassword } from "better-auth/crypto";
import { sendHotelEmail } from "@NOBLEZA/auth/mail";
import { env } from "@NOBLEZA/env/server";
import { adminProcedure, router } from "../index";

function newId() {
  return randomBytes(16).toString("hex");
}

const role = z.enum(["guest", "receptionist", "housekeeping", "manager", "admin"]);
const userStatus = z.enum(["active", "inactive"]);

export const adminRouter = router({
  users: adminProcedure.query(({ ctx }) =>
    ctx.db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        loyaltyPoints: true,
        forcePasswordChange: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ),

  createUser: adminProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        role: role.default("guest"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
      }
      const id = newId();
      const tempPassword = randomBytes(8).toString("hex");
      const password = await hashPassword(tempPassword);
      const user = await ctx.db.user.create({
        data: {
          id,
          name: input.name,
          email: input.email,
          emailVerified: true,
          role: input.role,
          status: "active",
          forcePasswordChange: true,
          accounts: {
            create: { id: newId(), accountId: id, providerId: "credential", password },
          },
        },
      });
      const emailed = await sendHotelEmail({
        to: user.email,
        subject: "Your Nobleza Hotel account",
        html: `<p>Hello ${user.name},</p>
<p>An administrator created a ${user.role} account for you at Nobleza Hotel.</p>
<p>Sign in at ${env.BETTER_AUTH_URL || env.CORS_ORIGIN} with this email and temporary password:</p>
<p><strong>${tempPassword}</strong></p>
<p>You will be asked to choose a new password on first sign-in.</p>`,
      });
      if (!emailed) {
        console.log(`[auth] Temporary password for ${user.email}: ${tempPassword}`);
      }
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.session.user.id,
          action: "USER_CREATE",
          details: `Created ${user.role} account for ${user.email}.`,
        },
      });
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailed,
        // Only returned once, so the admin can give it to the person if SMTP is not set.
        tempPassword: emailed ? undefined : tempPassword,
      };
    }),

  updateUser: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        role: role.optional(),
        status: userStatus.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.role && !input.status) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Provide a role or status to update." });
      }
      const target = await ctx.db.user.findUnique({ where: { id: input.id } });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

      if (target.id === ctx.session.user.id && (input.status === "inactive" || (input.role && input.role !== "admin"))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot deactivate or demote your own account." });
      }
      if (target.role === "admin" && (input.role !== "admin" || input.status === "inactive")) {
        const otherAdmins = await ctx.db.user.count({
          where: { role: "admin", status: "active", id: { not: target.id } },
        });
        if (otherAdmins === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change the last active admin." });
        }
      }

      const user = await ctx.db.user.update({
        where: { id: input.id },
        data: {
          ...(input.role ? { role: input.role } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
      });
      const changes = [
        ...(input.role ? [`role → ${input.role}`] : []),
        ...(input.status ? [`status → ${input.status}`] : []),
      ];
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.session.user.id,
          action: input.status ? "USER_STATUS_CHANGE" : "USER_ROLE_CHANGE",
          details: `Updated user ${user.name} (${user.email}): ${changes.join(", ")}.`,
        },
      });
      await ctx.db.notification.create({
        data: {
          userId: user.id,
          title: "Account Updated",
          message: `Your account has been updated by administration: ${changes.join(", ")}.`,
        },
      });
      return { ok: true, id: user.id, role: user.role, status: user.status };
    }),

  deleteUser: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete your own account." });
      }
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        include: { bookings: true, assignedTasks: true },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      if (user.role === "admin") {
        const otherAdmins = await ctx.db.user.count({
          where: { role: "admin", status: "active", id: { not: user.id } },
        });
        if (otherAdmins === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete the last active admin." });
        }
      }
      if (user.bookings.length > 0 || user.assignedTasks.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete a user who has bookings or assigned tasks.",
        });
      }
      await ctx.db.user.delete({ where: { id: input.id } });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.session.user.id,
          action: "USER_DELETE",
          details: `Deleted user ${user.name} (${user.email}).`,
        },
      });
      return { ok: true };
    }),

  auditLogs: adminProcedure.query(async ({ ctx }) => {
    const logs = await ctx.db.auditLog.findMany({
      include: { user: { select: { name: true, role: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.user?.name ?? "System",
      userRole: log.user?.role ?? "system",
      userEmail: log.user?.email ?? null,
      action: log.action,
      details: log.details,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    }));
  }),

  monitoring: adminProcedure.query(async ({ ctx }) => {
    const [users, rooms, bookings, payments, activeSessions] = await Promise.all([
      ctx.db.user.count(),
      ctx.db.room.count(),
      ctx.db.booking.count(),
      ctx.db.payment.count(),
      ctx.db.user.count({
        where: { bookings: { some: { status: { in: ["Booked", "CheckedIn"] } } } },
      }),
    ]);
    let dbSize = "N/A";
    try {
      const result = await ctx.db.$queryRaw<Array<{ size: string }>>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `;
      dbSize = result[0]?.size ?? "N/A";
    } catch {
      dbSize = "Query unavailable";
    }
    const mem = process.memoryUsage();
    return {
      databaseEngine: "PostgreSQL (Prisma)",
      dbSize,
      activeSessions,
      stats: { users, rooms, bookings, payments },
      instance: {
        note: "These figures describe the current serverless instance, not a long-lived server. They reset when the instance sleeps.",
        uptimeSeconds: Math.round(process.uptime()),
        memoryRssMb: Math.round(mem.rss / 1024 / 1024),
        memoryHeapMb: Math.round(mem.heapUsed / 1024 / 1024),
      },
    };
  }),
});
