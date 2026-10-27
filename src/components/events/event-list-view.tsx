import { ArrowUpRight, CalendarDays, MapPin, Users } from "lucide-react";
import Link from "next/link";
import type { EventRecord } from "@/lib/supabase/database.types";

const statusNames: Record<EventRecord["status"], string> = {
  draft: "Черновик",
  planning: "Подготовка",
  ready: "Готово",
  cancelled: "Отменено",
};

function formatDate(date: string | null) {
  if (!date) return "Дата не выбрана";
  return new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function EventListView({ events }: { events: EventRecord[] }) {
  if (events.length === 0) {
    return (
      <div className="event-list-empty">
        <span className="event-empty-icon"><CalendarDays size={21} /></span>
        <h2>Пока нет мероприятий</h2>
        <p>Начните с идеи — детали можно будет заполнить по ходу подготовки.</p>
        <Link className="button button-primary" href="/events/new">Создать мероприятие</Link>
      </div>
    );
  }

  return (
    <div className="event-grid">
      {events.map((event) => (
        <Link className="event-list-card" href={`/events/${event.id}`} key={event.id}>
          <div className="event-list-card-top">
            <span className={`event-status status-${event.status}`}>
              <span /> {statusNames[event.status]}
            </span>
            <ArrowUpRight aria-hidden="true" size={16} />
          </div>
          <h2>{event.title}</h2>
          <p className="event-list-description">{event.idea}</p>
          <div className="event-list-meta">
            <span><CalendarDays size={14} />{formatDate(event.event_date)}</span>
            {event.venue_name && <span><MapPin size={14} />{event.venue_name}</span>}
            {event.guests_count && <span><Users size={14} />{event.guests_count} гостей</span>}
          </div>
          {event.format && <span className="event-format">{event.format}</span>}
        </Link>
      ))}
    </div>
  );
}
