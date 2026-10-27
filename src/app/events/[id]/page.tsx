import { CalendarDays, MapPin, Pencil, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DeleteEventButton } from "@/components/events/delete-event-button";
import { EventEquipment } from "@/components/events/event-equipment";
import { EventDocuments } from "@/components/events/event-documents";
import { EventTasks } from "@/components/events/event-tasks";
import { EventVenue } from "@/components/events/event-venue";
import { createClient } from "@/lib/supabase/server";
import type {
  EventBookingRecord,
  EventDocumentRecord,
  EventEquipmentRecord,
  EventRecord,
  EventTaskRecord,
  VenueRecord,
  VenueRoomRecord,
} from "@/lib/supabase/database.types";

const eventTabs = [
  { key: "overview", label: "Обзор" },
  { key: "equipment", label: "Реквизит" },
  { key: "venue", label: "Площадка" },
  { key: "documents", label: "Документы" },
  { key: "tasks", label: "Задачи" },
] as const;

const programSchema = z.array(
  z.object({
    startTime: z.string(),
    durationMinutes: z.number(),
    title: z.string(),
    description: z.string(),
  }),
);

type EventTab = (typeof eventTabs)[number]["key"];

function isEventTab(value: string | undefined): value is EventTab {
  return eventTabs.some((tab) => tab.key === value);
}

export default function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <Suspense fallback={<EventLoading />}>
      <EventDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EventDetailContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await connection();
  const [{ id }, { tab: requestedTab }] = await Promise.all([params, searchParams]);
  const activeTab = isEventTab(requestedTab) ? requestedTab : "overview";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!event && !error) {
    notFound();
  }

  if (error) {
    return (
      <main className="app-page">
        <div className="app-page-inner">
          <p className="auth-message auth-message-error" role="alert">
            Не удалось загрузить мероприятие: {error.message}
          </p>
        </div>
      </main>
    );
  }

  if (!event) {
    notFound();
  }

  let canManage = event.created_by === user.id;
  if (!canManage) {
    const { data: membership, error: membershipError } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", event.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      return <EventLoadError message={membershipError.message} />;
    }
    canManage = membership?.role === "organizer";
  }

  let tasks: EventTaskRecord[] = [];
  let equipment: EventEquipmentRecord[] = [];
  let venues: VenueRecord[] = [];
  let rooms: (VenueRoomRecord & { venueName: string; venueAddress: string })[] = [];
  let bookings: EventBookingRecord[] = [];
  let documents: EventDocumentRecord[] = [];

  if (activeTab === "tasks") {
    const { data, error: taskError } = await supabase
      .from("event_tasks")
      .select("*")
      .eq("event_id", event.id)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (taskError) {
      return <EventLoadError message={taskError.message} />;
    }
    tasks = data;
  } else if (activeTab === "equipment") {
    const { data, error: equipmentError } = await supabase
      .from("event_equipment")
      .select("*")
      .eq("event_id", event.id)
      .order("name", { ascending: true });

    if (equipmentError) {
      return <EventLoadError message={equipmentError.message} />;
    }
    equipment = data;
  } else if (activeTab === "venue") {
    const { data: venueData, error: venueError } = await supabase
      .from("venues")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true });

    if (venueError) {
      return <EventLoadError message={venueError.message} />;
    }
    venues = venueData;

    if (venues.length > 0) {
      const { data: roomData, error: roomError } = await supabase
        .from("venue_rooms")
        .select("*")
        .in("venue_id", venues.map((venue) => venue.id))
        .eq("active", true)
        .order("capacity", { ascending: true });

      if (roomError) {
        return <EventLoadError message={roomError.message} />;
      }

      const venueById = new Map(venues.map((venue) => [venue.id, venue]));
      rooms = roomData.flatMap((room) => {
        const venue = venueById.get(room.venue_id);
        return venue
          ? [{ ...room, venueName: venue.name, venueAddress: venue.address }]
          : [];
      });
    }

    const { data: bookingData, error: bookingError } = await supabase
      .from("event_bookings")
      .select("*")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false });

    if (bookingError) {
      return <EventLoadError message={bookingError.message} />;
    }
    bookings = bookingData;
  } else if (activeTab === "documents") {
    const { data, error: documentError } = await supabase
      .from("event_documents")
      .select("*")
      .eq("event_id", event.id)
      .order("updated_at", { ascending: false });

    if (documentError) {
      return <EventLoadError message={documentError.message} />;
    }
    documents = data;
  }

  return (
    <EventDetailView
      event={event}
      userId={user.id}
      canManage={canManage}
      activeTab={activeTab}
      tasks={tasks}
      equipment={equipment}
      venues={venues}
      rooms={rooms}
      bookings={bookings}
      documents={documents}
    />
  );
}

function EventDetailView({
  event,
  userId,
  canManage,
  activeTab,
  tasks,
  equipment,
  venues,
  rooms,
  bookings,
  documents,
}: {
  event: EventRecord;
  userId: string;
  canManage: boolean;
  activeTab: EventTab;
  tasks: EventTaskRecord[];
  equipment: EventEquipmentRecord[];
  venues: VenueRecord[];
  rooms: (VenueRoomRecord & { venueName: string; venueAddress: string })[];
  bookings: EventBookingRecord[];
  documents: EventDocumentRecord[];
}) {
  const isOwner = event.created_by === userId;
  const parsedProgram = programSchema.safeParse(event.program);

  return (
    <main className="app-page">
      <div className="app-page-inner">
        <Link className="back-link" href="/events">← Все мероприятия</Link>
        <header className="event-detail-header">
          <div>
            <span className={`event-status status-${event.status}`}><span />{event.status === "ready" ? "Готово" : event.status === "cancelled" ? "Отменено" : "Подготовка"}</span>
            <h1>{event.title}</h1>
            <p>{event.format || "Мероприятие"}{event.event_date ? ` · ${new Date(`${event.event_date}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}` : ""}</p>
          </div>
          <div className="event-detail-actions">
            <Link className="button button-primary" href={`/events/${event.id}/assistant`}>
              <Sparkles size={15} /> Спросить ИИ
            </Link>
            {isOwner && (
              <>
                <Link className="button button-outline" href={`/events/${event.id}/edit`}><Pencil size={15} /> Редактировать</Link>
                <DeleteEventButton eventId={event.id} />
              </>
            )}
          </div>
        </header>

        <nav aria-label="Разделы мероприятия" className="event-tabs">
          {eventTabs.map(({ key, label }) => (
            <Link
              aria-current={activeTab === key ? "page" : undefined}
              className={activeTab === key ? "event-tab-active" : ""}
              href={`/events/${event.id}?tab=${key}`}
              key={key}
            >
              {label}
            </Link>
          ))}
        </nav>

        {activeTab === "overview" ? (
          <div className="event-overview">
            <section className="event-overview-main">
              <span className="section-kicker">ИДЕЯ</span>
              <p className="event-idea">{event.idea}</p>
              {event.description && <p className="event-description">{event.description}</p>}
              {(event.goal || event.target_audience) && (
                <div className="event-plan-summary">
                  {event.goal && <p><strong>Цель:</strong> {event.goal}</p>}
                  {event.target_audience && <p><strong>Аудитория:</strong> {event.target_audience}</p>}
                </div>
              )}
              {parsedProgram.success && parsedProgram.data.length > 0 && (
                <div className="event-program">
                  <h2>Программа</h2>
                  <ol>
                    {parsedProgram.data.map((item, index) => (
                      <li key={`${item.startTime}-${index}`}>
                        <span>{item.startTime} · {item.durationMinutes} мин.</span>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {Array.isArray(event.risks) && event.risks.length > 0 && (
                <div className="event-plan-summary">
                  <h2>Риски и меры</h2>
                  {event.risks.map((risk, index) => {
                    if (typeof risk !== "object" || risk === null || !("title" in risk) || !("mitigation" in risk)) {
                      return null;
                    }
                    return (
                      <p key={index}>
                        <strong>{String(risk.title)}:</strong> {String(risk.mitigation)}
                      </p>
                    );
                  })}
                </div>
              )}
            </section>
            <aside className="event-overview-aside">
              <h2>Детали</h2>
              <dl className="event-details-list">
                <div><dt><CalendarDays size={15} />Дата</dt><dd>{event.event_date ? new Date(`${event.event_date}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "Пока не выбрана"}</dd></div>
                <div><dt><Users size={15} />Гости</dt><dd>{event.guests_count ? `${event.guests_count} человек` : "Не указано"}</dd></div>
                <div><dt><MapPin size={15} />Площадка</dt><dd>{event.venue_name || "Не выбрана"}</dd></div>
                <div><dt>Бюджет</dt><dd>{event.budget !== null ? `${new Intl.NumberFormat("ru-RU").format(event.budget)} ₽` : "Не указан"}</dd></div>
              </dl>
            </aside>
          </div>
        ) : activeTab === "tasks" ? (
          <EventTasks eventId={event.id} initialTasks={tasks} canManage={canManage} />
        ) : activeTab === "equipment" ? (
          <EventEquipment eventId={event.id} initialEquipment={equipment} canManage={canManage} />
        ) : activeTab === "venue" ? (
          <EventVenue
            eventId={event.id}
            eventDate={event.event_date}
            guestCount={event.guests_count}
            venues={venues}
            rooms={rooms}
            bookings={bookings}
            canManage={canManage}
          />
        ) : activeTab === "documents" ? (
          <EventDocuments event={event} documents={documents} canManage={canManage} />
        ) : (
          <section className="event-module-placeholder">
            <span className="section-kicker">РАЗДЕЛ МЕРОПРИЯТИЯ</span>
            <h2>{eventTabs.find((item) => item.key === activeTab)?.label}</h2>
            <p>Раздел подключается на следующем этапе. Данные мероприятия уже сохранены.</p>
          </section>
        )}
      </div>
    </main>
  );
}

function EventLoadError({ message }: { message: string }) {
  return (
    <main className="app-page">
      <div className="app-page-inner">
        <p className="auth-message auth-message-error" role="alert">
          Не удалось загрузить данные мероприятия: {message}
        </p>
      </div>
    </main>
  );
}

function EventLoading() {
  return (
    <main className="app-page">
      <div className="app-page-inner"><p>Загружаем мероприятие…</p></div>
    </main>
  );
}
