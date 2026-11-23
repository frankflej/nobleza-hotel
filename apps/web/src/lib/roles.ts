export type HotelRole = "guest" | "receptionist" | "housekeeping" | "manager" | "admin";

export function dashboardPath(role?: string | null) {
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
