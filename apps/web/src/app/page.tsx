import { db } from "@NOBLEZA/db";
import { publicRoomSelect } from "@NOBLEZA/api/routers/rooms";
import { LandingPage, type Room } from "@/components/landing-page";

// Rooms change rarely; serve a cached page from the edge and refresh it in the background.
export const revalidate = 300;

async function getRooms(): Promise<Room[]> {
  try {
    return await db.room.findMany({
      where: { status: { in: ["Available", "Dirty", "Cleaning"] } },
      select: publicRoomSelect,
      orderBy: [{ price: "asc" }, { roomNumber: "asc" }],
    });
  } catch (error) {
    // The client falls back to a live query if this is empty.
    console.error("Could not load rooms for the landing page", error);
    return [];
  }
}

export default async function Home() {
  const rooms = await getRooms();
  return <LandingPage initialRooms={rooms} />;
}
