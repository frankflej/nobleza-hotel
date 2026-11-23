/**
 * Demo seed for local development only.
 *
 * PLACEHOLDER CONTENT: room inventory, prices, descriptions, and photos
 * are copied from the previous demo dataset so the app is runnable. Frank
 * must replace these with Nobleza Hotel's real rooms, rates, and images
 * (see PLACEHOLDERS.md).
 *
 * Demo passwords are "password123" — never use these in production.
 */
import { PrismaClient, type Role } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "node:crypto";

const db = new PrismaClient();

function newId() {
  return randomBytes(16).toString("hex");
}

async function upsertUser(opts: {
  name: string;
  email: string;
  role: Role;
  loyaltyPoints?: number;
}) {
  const existing = await db.user.findUnique({ where: { email: opts.email } });
  const password = await hashPassword("password123");
  if (existing) {
    await db.account.updateMany({
      where: { userId: existing.id, providerId: "credential" },
      data: { password },
    });
    return db.user.update({
      where: { id: existing.id },
      data: {
        name: opts.name,
        role: opts.role,
        loyaltyPoints: opts.loyaltyPoints ?? existing.loyaltyPoints,
        status: "active",
        emailVerified: true,
      },
    });
  }
  const id = newId();
  const user = await db.user.create({
    data: {
      id,
      name: opts.name,
      email: opts.email,
      emailVerified: true,
      role: opts.role,
      status: "active",
      loyaltyPoints: opts.loyaltyPoints ?? 0,
      accounts: {
        create: {
          id: newId(),
          accountId: id,
          providerId: "credential",
          password,
        },
      },
    },
  });
  return user;
}

async function main() {
  console.log("Seeding Nobleza Hotel demo database...\n");

  const admin = await upsertUser({
    name: "Ada Okonkwo",
    email: "admin@nobleza.hotel",
    role: "admin",
  });
  const manager = await upsertUser({
    name: "Sofia Alvarez",
    email: "manager@nobleza.hotel",
    role: "manager",
  });
  const receptionist = await upsertUser({
    name: "Daniel Moreau",
    email: "receptionist@nobleza.hotel",
    role: "receptionist",
  });
  const housekeeper = await upsertUser({
    name: "Grace Amani",
    email: "housekeeping@nobleza.hotel",
    role: "housekeeping",
  });
  const guest = await upsertUser({
    name: "Alice Mukamana",
    email: "guest@nobleza.hotel",
    role: "guest",
    loyaltyPoints: 150,
  });
  const guest2 = await upsertUser({
    name: "David Mwangi",
    email: "david.guest@nobleza.hotel",
    role: "guest",
    loyaltyPoints: 85,
  });
  const guest3 = await upsertUser({
    name: "Sarah Ndayisaba",
    email: "sarah.guest@nobleza.hotel",
    role: "guest",
    loyaltyPoints: 220,
  });
  console.log("Users seeded (7 demo accounts)\n");

  // PLACEHOLDER inventory — counts, prices, copy, and photos are temporary.
  const roomsData: Array<{
    roomNumber: string;
    type: "Presidential" | "Suite" | "Deluxe" | "Standard";
    price: number;
    capacity: number;
    status: "Available";
    description: string;
    amenities: string;
    imageUrl: string;
  }> = [];

  roomsData.push({
    roomNumber: "401",
    type: "Presidential",
    price: 500,
    capacity: 4,
    status: "Available",
    description:
      "PLACEHOLDER: Replace with Nobleza Hotel's presidential suite description, views, and services.",
    amenities: "PLACEHOLDER amenities: Lounge,Dining Room,Jacuzzi,WiFi,Premium Bar",
    imageUrl: "/rooms/presidential.png",
  });

  for (let i = 1; i <= 8; i++) {
    roomsData.push({
      roomNumber: `30${i}`,
      type: "Suite",
      price: 280,
      capacity: 3,
      status: "Available",
      description:
        "PLACEHOLDER: Replace with Nobleza Hotel's suite description.",
      amenities: "PLACEHOLDER amenities: Terrace,Living Room,King Bed,WiFi,Mini Bar",
      imageUrl: "/rooms/suite.png",
    });
  }

  for (let i = 1; i <= 30; i++) {
    const num = i < 10 ? `0${i}` : String(i);
    roomsData.push({
      roomNumber: `2${num}`,
      type: "Deluxe",
      price: 150,
      capacity: 2,
      status: "Available",
      description:
        "PLACEHOLDER: Replace with Nobleza Hotel's deluxe room description.",
      amenities: "PLACEHOLDER amenities: King Bed,Rain Shower,WiFi,Mini Bar,Air Conditioning",
      imageUrl: "/rooms/deluxe.png",
    });
  }

  for (let i = 1; i <= 40; i++) {
    const num = i < 10 ? `0${i}` : String(i);
    roomsData.push({
      roomNumber: `1${num}`,
      type: "Standard",
      price: 95,
      capacity: 2,
      status: "Available",
      description:
        "PLACEHOLDER: Replace with Nobleza Hotel's standard room description.",
      amenities: "PLACEHOLDER amenities: Double Bed,WiFi,Air Conditioning,Desk",
      imageUrl: "/rooms/standard.png",
    });
  }

  for (const room of roomsData) {
    await db.room.upsert({
      where: { roomNumber: room.roomNumber },
      update: {},
      create: room,
    });
  }
  console.log(`Rooms seeded (${roomsData.length} placeholder rooms)\n`);

  const bookingCountExisting = await db.booking.count();
  if (bookingCountExisting > 0) {
    console.log("Bookings already present — skipping history/tasks/seed extras.\n");
    return;
  }

  const allRooms = await db.room.findMany();
  const guests = [guest, guest2, guest3];
  const now = new Date();
  let bookingCount = 0;

  for (let daysAgo = 90; daysAgo >= 0; daysAgo -= Math.floor(Math.random() * 3) + 1) {
    const checkIn = new Date(now);
    checkIn.setDate(checkIn.getDate() - daysAgo);
    checkIn.setHours(0, 0, 0, 0);
    const stayDays = Math.floor(Math.random() * 4) + 1;
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + stayDays);
    const randomRoom = allRooms[Math.floor(Math.random() * allRooms.length)]!;
    const randomGuest = guests[Math.floor(Math.random() * guests.length)]!;
    const totalPrice = randomRoom.price * stayDays;

    let status: "Booked" | "CheckedIn" | "CheckedOut";
    if (daysAgo > 10) status = "CheckedOut";
    else if (daysAgo > 3) status = Math.random() > 0.3 ? "CheckedOut" : "CheckedIn";
    else if (daysAgo > 0) status = Math.random() > 0.5 ? "Booked" : "CheckedIn";
    else status = "Booked";

    const loyaltyDiscount = Math.random() > 0.7 ? 50 : 0;
    const booking = await db.booking.create({
      data: {
        userId: randomGuest.id,
        roomId: randomRoom.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        status,
        totalPrice: totalPrice - loyaltyDiscount,
        loyaltyDiscount,
      },
    });

    if (status === "CheckedOut") {
      const serviceCharges = Math.random() > 0.5 ? Math.floor(Math.random() * 80) + 10 : 0;
      const roomCharges = totalPrice - loyaltyDiscount;
      const tax = (roomCharges + serviceCharges) * 0.15;
      await db.payment.create({
        data: {
          bookingId: booking.id,
          roomCharges,
          serviceCharges,
          tax: parseFloat(tax.toFixed(2)),
          totalAmount: parseFloat((roomCharges + serviceCharges + tax).toFixed(2)),
          paymentMethod: (["Card", "Cash", "MobileMoney"] as const)[Math.floor(Math.random() * 3)]!,
          status: "Paid",
        },
      });
    }
    bookingCount++;
  }

  const activeBookings = await db.booking.findMany({
    where: { status: "CheckedIn" },
    select: { roomId: true },
  });
  for (const ab of activeBookings) {
    await db.room.update({
      where: { id: ab.roomId },
      data: { status: "Occupied" },
    });
  }
  console.log(`Bookings seeded (${bookingCount})\n`);

  const availableRooms = await db.room.findMany({ where: { status: "Available" }, take: 2 });
  for (const room of availableRooms) {
    await db.room.update({ where: { id: room.id }, data: { status: "Dirty" } });
    await db.housekeepingTask.create({
      data: {
        roomId: room.id,
        assignedTo: housekeeper.id,
        reportedBy: receptionist.id,
        description: `Post-checkout cleaning required for Room ${room.roomNumber}.`,
        status: "Pending",
      },
    });
  }
  const maintenanceRoom = await db.room.findFirst({ where: { status: "Available" } });
  if (maintenanceRoom) {
    await db.room.update({ where: { id: maintenanceRoom.id }, data: { status: "Maintenance" } });
    await db.housekeepingTask.create({
      data: {
        roomId: maintenanceRoom.id,
        reportedBy: housekeeper.id,
        description: `Maintenance required in Room ${maintenanceRoom.roomNumber}. PLACEHOLDER issue details.`,
        status: "InProgress",
      },
    });
  }
  console.log("Housekeeping tasks seeded\n");

  await db.notification.createMany({
    data: [
      { userId: manager.id, title: "Arrivals tomorrow", message: "Review tomorrow's check-ins and occupancy on the front desk board.", read: false },
      { userId: receptionist.id, title: "Arrivals today", message: "Review today's check-ins on the front desk board.", read: false },
      { userId: housekeeper.id, title: "Cleaning queue", message: "Priority rooms are waiting on the cleaning board.", read: false },
      { userId: guest.id, title: "Welcome to Nobleza Hotel", message: "Thank you for joining the loyalty programme.", read: true },
      { userId: admin.id, title: "System ready", message: "Demo data is loaded. Replace placeholders before going live.", read: true },
    ],
  });
  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "SYSTEM_SEED",
      details: "Demo database seeded for local development.",
      ipAddress: "127.0.0.1",
    },
  });
  console.log("Notifications and audit log seeded\n");
  console.log("Nobleza Hotel seed complete.\n");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
