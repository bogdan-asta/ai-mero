import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { VenueDirectory, type BookingView, type VenueRoomView } from "@/components/venues/venue-directory";
import { createClient } from "@/lib/supabase/server";
import type {
  VenueRoomRecord,
} from "@/lib/supabase/database.types";

export default function VenuesPage() {
  return (
    <Suspense fallback={<main className="app-page"><div className="app-page-inner"><p>Загружаем площадки…</p></div></main>}>
      <VenuesContent />
    </Suspense>
  );
}

async function VenuesContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return <DirectoryError message={profileError.message} />;
  }

  const isVenueAdmin = profile?.role === "venue_admin" || profile?.role === "super_admin";
  const venueQuery = supabase.from("venues").select("*");
  const { data: venues, error: venueError } = await (
    profile?.role === "venue_admin"
      ? venueQuery.eq("created_by", user.id)
      : venueQuery
  ).order("name", { ascending: true });

  if (venueError) {
    return <DirectoryError message={venueError.message} />;
  }

  const venueIds = venues.map((venue) => venue.id);
  let roomRows: VenueRoomRecord[] = [];
  if (venueIds.length > 0) {
    const { data, error: roomError } = await supabase
      .from("venue_rooms")
      .select("*")
      .in("venue_id", venueIds)
      .order("name", { ascending: true });
    if (roomError) {
      return <DirectoryError message={roomError.message} />;
    }
    roomRows = data;
  }

  const venueById = new Map(venues.map((venue) => [venue.id, venue]));
  const rooms: VenueRoomView[] = roomRows.flatMap((room) => {
    const venue = venueById.get(room.venue_id);
    return venue
      ? [{ ...room, venueName: venue.name, venueAddress: venue.address }]
      : [];
  });

  let pendingBookings: BookingView[] = [];
  if (isVenueAdmin) {
    const { data: bookings, error: bookingError } = await supabase
      .from("event_bookings")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (bookingError) {
      return <DirectoryError message={bookingError.message} />;
    }

    pendingBookings = bookings;
  }

  return (
    <VenueDirectory
      venues={venues}
      rooms={rooms}
      pendingBookings={pendingBookings}
      isVenueAdmin={isVenueAdmin}
    />
  );
}

function DirectoryError({ message }: { message: string }) {
  return (
    <main className="app-page">
      <div className="app-page-inner">
        <p className="auth-message auth-message-error" role="alert">
          Не удалось загрузить каталог площадок: {message}
        </p>
      </div>
    </main>
  );
}
