import type { Route } from "next";

export type HotelRole = "guest" | "receptionist" | "housekeeping" | "manager" | "admin";

export function dashboardPath(role?: string | null): Route {
  switch (role) {
    case "receptionist":
      return "/reception";
    case "housekeeping":
      return "/housekeeping";
    case "manager":
      return "/manager";
    case "admin":
      return "/admin";
    default:
      return "/guest";
  }
}

/** Only allow same-origin relative paths from the login `next` query. */
export function safeInternalPath(next: string | null | undefined, fallback: Route): Route {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) {
    return next as Route;
  }
  return fallback;
}
