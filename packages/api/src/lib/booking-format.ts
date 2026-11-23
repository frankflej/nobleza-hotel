export function nightsBetween(checkIn: Date, checkOut: Date) {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function formatBooking<
  T extends {
    id: number;
    userId: string;
    roomId: number;
    checkInDate: Date;
    checkOutDate: Date;
    status: string;
    totalPrice: number;
    loyaltyDiscount: number;
    createdAt: Date;
    user: { id: string; name: string; email: string };
    room: { roomNumber: string; type: string; price: number };
    payment: { id: number; status: string } | null;
  },
>(b: T) {
  return {
    id: b.id,
    userId: b.userId,
    guestName: b.user.name,
    guestEmail: b.user.email,
    roomId: b.roomId,
    roomNumber: b.room.roomNumber,
    roomType: b.room.type,
    roomPrice: b.room.price,
    checkInDate: b.checkInDate.toISOString().slice(0, 10),
    checkOutDate: b.checkOutDate.toISOString().slice(0, 10),
    status: b.status,
    totalPrice: b.totalPrice,
    loyaltyDiscount: b.loyaltyDiscount,
    billId: b.payment?.id ?? null,
    billStatus: b.payment?.status ?? null,
    createdAt: b.createdAt,
  };
}
