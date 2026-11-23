import { publicProcedure, router } from "../index";
import { roomsRouter } from "./rooms";
import { bookingsRouter } from "./bookings";
import { userRouter } from "./user";
import { feedbackRouter } from "./feedback";
import { notificationsRouter } from "./notifications";
import { guestsRouter } from "./guests";
import { housekeepingRouter } from "./housekeeping";
import { analyticsRouter } from "./analytics";
import { paymentsRouter } from "./payments";
import { reportsRouter } from "./reports";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  rooms: roomsRouter,
  bookings: bookingsRouter,
  user: userRouter,
  feedback: feedbackRouter,
  notifications: notificationsRouter,
  guests: guestsRouter,
  housekeeping: housekeepingRouter,
  analytics: analyticsRouter,
  payments: paymentsRouter,
  reports: reportsRouter,
});

export type AppRouter = typeof appRouter;
