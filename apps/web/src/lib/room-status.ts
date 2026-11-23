export function roomStatusClass(status: string) {
  switch (status) {
    case "Available":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "Occupied":
      return "border-hotel-blue/30 bg-hotel-blue text-hotel-cream";
    case "Dirty":
      return "border-rose-200 bg-rose-50 text-rose-900";
    case "Cleaning":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "Maintenance":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-hotel-gold-light bg-white";
  }
}
