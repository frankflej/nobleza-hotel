import { publicProcedure, router } from "../index";
import { roomsRouter } from "./rooms";
import { bookingsRouter } from "./bookings";
import { userRouter } from "./user";
import { feedbackRouter } from "./feedback";
import { notificationsRouter } from "./notifications";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  rooms: roomsRouter,
  bookings: bookingsRouter,
  user: userRouter,
  feedback: feedbackRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
