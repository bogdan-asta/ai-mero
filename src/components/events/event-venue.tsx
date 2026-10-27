"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, LoaderCircle, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type {
  EventBookingRecord,
  VenueRecord,
  VenueRoomRecord,
} from "@/lib/supabase/database.types";

const bookingSchema = z.object({
  roomId: z.string().uuid("Выберите зал."),
  startsAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Укажите время начала."),
  endsAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Укажите время окончания."),
  note: z.string().trim().max(1000),
}).refine(
  (value) => new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(),
  { path: ["endsAt"], message: "Окончание должно быть позже начала." },
);

type BookingFormValues = z.infer<typeof bookingSchema>;
type VenueRoomOption = VenueRoomRecord & { venueName: string; venueAddress: string };

const statusLabels: Record<EventBookingRecord["status"], string> = {
  pending: "Ожидает подтверждения",
  approved: "Подтверждена",
  rejected: "Отклонена",
  cancelled: "Отменена",
};

export function EventVenue({
  eventId,
  eventDate,
  guestCount,
  venues,
  rooms,
  bookings,
  canManage,
}: {
  eventId: string;
  eventDate: string | null;
  guestCount: number | null;
  venues: VenueRecord[];
  rooms: VenueRoomOption[];
  bookings: EventBookingRecord[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const suitableRoomCount = rooms.filter(
    (room) => guestCount === null || room.capacity >= guestCount,
  ).length;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      roomId: "",
      startsAt: eventDate ? `${eventDate}T09:00` : "",
      endsAt: eventDate ? `${eventDate}T17:00` : "",
      note: "",
    },
  });

  async function submitBooking(values: BookingFormValues) {
    setFormError("");
    try {
      const { error } = await createClient().rpc("book_event_room", {
        target_event_id: eventId,
        target_room_id: values.roomId,
        target_starts_at: new Date(values.startsAt).toISOString(),
        target_ends_at: new Date(values.endsAt).toISOString(),
        target_organizer_note: values.note,
      });

      if (error) {
        const message = error.message.includes("already requested or booked")
          ? "Этот зал уже запрошен или забронирован на выбранное время."
          : error.message.includes("capacity is below")
            ? "Вместимость зала меньше числа гостей мероприятия."
            : `Не удалось отправить запрос: ${error.message}`;
        throw new Error(message);
      }

      reset();
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось отправить запрос на бронирование.");
    }
  }

  async function cancelBooking(booking: EventBookingRecord) {
    if (!window.confirm("Отменить запрос на бронирование?")) return;
    setActionError("");
    setBusyBookingId(booking.id);
    try {
      const { error } = await createClient().rpc("cancel_event_booking", {
        target_booking_id: booking.id,
      });
      if (error) throw new Error(`Не удалось отменить бронирование: ${error.message}`);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось отменить бронирование.");
    } finally {
      setBusyBookingId(null);
    }
  }

  return (
    <section className="planning-module venue-event-module">
      <header className="planning-module-heading">
        <div>
          <span className="section-kicker">ПЛОЩАДКА</span>
          <h2>Залы и бронирование</h2>
          <p>Проверьте вместимость и отправьте организаторам площадки запрос на выбранное время.</p>
        </div>
        <Link className="text-link venue-catalog-link" href="/venues">Каталог площадок <MapPin size={14} /></Link>
      </header>

      {canManage && (
        <form className="venue-booking-form" onSubmit={handleSubmit(submitBooking)} noValidate>
          <label className="form-field venue-room-select">
            <span>Зал</span>
            <select {...register("roomId")}>
              <option value="">Выберите зал</option>
              {rooms.map((room) => {
                const hasCapacity = guestCount === null || room.capacity >= guestCount;
                return (
                  <option disabled={!hasCapacity} key={room.id} value={room.id}>
                    {room.venueName} — {room.name} · до {room.capacity} гостей{!hasCapacity ? " (мало мест)" : ""}
                  </option>
                );
              })}
            </select>
            {errors.roomId && <small>{errors.roomId.message}</small>}
          </label>
          <label className="form-field">
            <span>Начало</span>
            <input type="datetime-local" {...register("startsAt")} />
            {errors.startsAt && <small>{errors.startsAt.message}</small>}
          </label>
          <label className="form-field">
            <span>Окончание</span>
            <input type="datetime-local" {...register("endsAt")} />
            {errors.endsAt && <small>{errors.endsAt.message}</small>}
          </label>
          <label className="form-field venue-note-field">
            <span>Комментарий к запросу</span>
            <input maxLength={1000} {...register("note")} placeholder="Например, нужен доступ для монтажа за час" />
          </label>
          <button className="button button-primary" disabled={isSubmitting || suitableRoomCount === 0} type="submit">
            {isSubmitting ? <LoaderCircle className="spin" size={15} /> : <CalendarClock size={15} />}
            Отправить запрос
          </button>
          {formError && <p className="auth-message auth-message-error venue-form-error" role="alert">{formError}</p>}
          {suitableRoomCount === 0 && <p className="venue-booking-hint">В каталоге пока нет залов подходящей вместимости.</p>}
          <p className="venue-booking-hint">Запрос будет подтверждён только после решения администрации площадки. Конфликты по времени проверяются при отправке.</p>
        </form>
      )}

      {!canManage && (
        <p className="venue-readonly-note">Запросить бронирование может организатор мероприятия.</p>
      )}

      {actionError && <p className="auth-message auth-message-error" role="alert">{actionError}</p>}
      <div className="venue-event-content">
        <section>
          <h3>Каталог залов</h3>
          {rooms.length === 0 ? (
            <p className="venue-no-rooms">Нет доступных залов. Попробуйте позже или уточните у администратора площадки.</p>
          ) : (
            <ul className="venue-room-list venue-event-room-list">
              {rooms.map((room) => (
                <li key={room.id}>
                  <div><strong>{room.venueName} · {room.name}</strong><span><MapPin size={12} />{room.venueAddress}</span><span>Вместимость: до {room.capacity} гостей</span>{room.hourly_rate !== null && <span>{new Intl.NumberFormat("ru-RU").format(room.hourly_rate)} ₽/час</span>}{room.equipment.length > 0 && <p>{room.equipment.join(" · ")}</p>}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3>Запросы мероприятия</h3>
          {bookings.length === 0 ? (
            <p className="venue-no-rooms">Заявок на бронирование пока нет.</p>
          ) : (
            <ul className="venue-booking-list">
              {bookings.map((booking) => (
                <li className="venue-booking-item" key={booking.id}>
                  <div><strong>{booking.venue_name} · {booking.room_name}</strong><span className={`planning-status booking-status-${booking.status}`}>{statusLabels[booking.status]}</span><p>{new Date(booking.starts_at).toLocaleString("ru-RU")} — {new Date(booking.ends_at).toLocaleString("ru-RU")}</p>{booking.organizer_note && <p>{booking.organizer_note}</p>}{booking.admin_note && <p className="venue-response-note">Ответ площадки: {booking.admin_note}</p>}</div>
                  {canManage && (booking.status === "pending" || booking.status === "approved") && (
                    <button className="venue-cancel-booking" disabled={busyBookingId === booking.id} onClick={() => void cancelBooking(booking)} type="button">
                      {busyBookingId === booking.id ? <LoaderCircle className="spin" size={14} /> : <X size={14} />}Отменить
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {eventDate && <p className="venue-event-date">Дата мероприятия: {new Date(`${eventDate}T12:00:00`).toLocaleDateString("ru-RU")}</p>}
      {venues.length === 0 && <p className="venue-readonly-note">Каталог площадок скоро появится.</p>}
    </section>
  );
}
