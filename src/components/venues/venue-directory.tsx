"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, LoaderCircle, MapPin, Plus, X } from "lucide-react";
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

const venueSchema = z.object({
  name: z.string().trim().min(2, "Укажите название площадки.").max(160),
  address: z.string().trim().min(2, "Укажите адрес.").max(300),
  description: z.string().trim().max(2000),
});

const roomSchema = z.object({
  venueId: z.string().uuid("Выберите площадку."),
  name: z.string().trim().min(2, "Укажите название зала.").max(120),
  capacity: z.string().regex(/^\d+$/, "Укажите целое число.").refine((value) => Number(value) > 0 && Number(value) <= 100000, "Вместимость должна быть от 1 до 100 000."),
  hourlyRate: z.string().refine(
    (value) => !value || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) >= 0),
    "Укажите неотрицательную цену, максимум два знака после запятой.",
  ),
  equipment: z.string().max(500),
});

type VenueFormValues = z.infer<typeof venueSchema>;
type RoomFormValues = z.infer<typeof roomSchema>;
export type VenueRoomView = VenueRoomRecord & { venueName: string; venueAddress: string };
export type BookingView = EventBookingRecord;

export function VenueDirectory({
  venues,
  rooms,
  pendingBookings,
  isVenueAdmin,
}: {
  venues: VenueRecord[];
  rooms: VenueRoomView[];
  pendingBookings: BookingView[];
  isVenueAdmin: boolean;
}) {
  const router = useRouter();
  const [venueError, setVenueError] = useState("");
  const [roomError, setRoomError] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const venueForm = useForm<VenueFormValues>({
    resolver: zodResolver(venueSchema),
    defaultValues: { name: "", address: "", description: "" },
  });
  const roomForm = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: { venueId: "", name: "", capacity: "", hourlyRate: "", equipment: "" },
  });

  async function createVenue(values: VenueFormValues) {
    setVenueError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Сессия истекла. Войдите в аккаунт и попробуйте ещё раз.");

      const { error } = await supabase.from("venues").insert({
        created_by: user.id,
        name: values.name,
        address: values.address,
        description: values.description,
      });
      if (error) throw new Error(`Не удалось создать площадку: ${error.message}`);

      venueForm.reset();
      router.refresh();
    } catch (error) {
      setVenueError(error instanceof Error ? error.message : "Не удалось создать площадку.");
    }
  }

  async function createRoom(values: RoomFormValues) {
    setRoomError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("venue_rooms").insert({
        venue_id: values.venueId,
        name: values.name,
        capacity: Number(values.capacity),
        hourly_rate: values.hourlyRate ? Number(values.hourlyRate) : null,
        equipment: values.equipment.split(",").map((item) => item.trim()).filter(Boolean),
      });
      if (error) throw new Error(`Не удалось добавить зал: ${error.message}`);

      roomForm.reset({ venueId: values.venueId, name: "", capacity: "", hourlyRate: "", equipment: "" });
      router.refresh();
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Не удалось добавить зал.");
    }
  }

  async function toggleVenue(venue: VenueRecord) {
    setBusyId(venue.id);
    setVenueError("");
    try {
      const { error } = await createClient()
        .from("venues")
        .update({ active: !venue.active })
        .eq("id", venue.id);
      if (error) throw new Error(`Не удалось изменить доступность площадки: ${error.message}`);
      router.refresh();
    } catch (error) {
      setVenueError(error instanceof Error ? error.message : "Не удалось изменить доступность площадки.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleRoom(room: VenueRoomView) {
    setBusyId(room.id);
    setRoomError("");
    try {
      const { error } = await createClient()
        .from("venue_rooms")
        .update({ active: !room.active })
        .eq("id", room.id);
      if (error) throw new Error(`Не удалось изменить доступность зала: ${error.message}`);
      router.refresh();
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Не удалось изменить доступность зала.");
    } finally {
      setBusyId(null);
    }
  }

  async function reviewBooking(booking: BookingView, decision: "approved" | "rejected") {
    setBusyId(booking.id);
    setBookingError("");
    try {
      const { error } = await createClient().rpc("review_event_booking", {
        target_booking_id: booking.id,
        decision,
        response_note: "",
      });
      if (error) throw new Error(`Не удалось обработать заявку: ${error.message}`);
      router.refresh();
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : "Не удалось обработать заявку.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="app-page">
      <div className="app-page-inner">
        <div className="page-heading venue-page-heading">
          <span className="section-kicker">ПЛОЩАДКИ EVENTAI</span>
          <h1>Пространства для событий</h1>
          <p>Выберите зал по адресу и вместимости, затем отправьте запрос на бронирование.</p>
        </div>

        {isVenueAdmin && (
          <section aria-label="Управление площадками" className="venue-admin-panel">
            <header><span className="section-kicker">УПРАВЛЕНИЕ КАТАЛОГОМ</span><h2>Площадка и залы</h2></header>
            <div className="venue-admin-forms">
              <form className="venue-admin-form" onSubmit={venueForm.handleSubmit(createVenue)} noValidate>
                <h3>Добавить площадку</h3>
                <label className="form-field"><span>Название</span><input maxLength={160} {...venueForm.register("name")} placeholder="Культурный центр" />{venueForm.formState.errors.name && <small>{venueForm.formState.errors.name.message}</small>}</label>
                <label className="form-field"><span>Адрес</span><input maxLength={300} {...venueForm.register("address")} placeholder="Город, улица, дом" />{venueForm.formState.errors.address && <small>{venueForm.formState.errors.address.message}</small>}</label>
                <label className="form-field"><span>Описание</span><textarea maxLength={2000} rows={3} {...venueForm.register("description")} placeholder="Кратко о площадке" /></label>
                {venueError && <p className="auth-message auth-message-error" role="alert">{venueError}</p>}
                <button className="button button-primary" disabled={venueForm.formState.isSubmitting} type="submit">
                  {venueForm.formState.isSubmitting ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}Создать площадку
                </button>
              </form>

              <form className="venue-admin-form" onSubmit={roomForm.handleSubmit(createRoom)} noValidate>
                <h3>Добавить зал</h3>
                <label className="form-field"><span>Площадка</span><select {...roomForm.register("venueId")}><option value="">Выберите площадку</option>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select>{roomForm.formState.errors.venueId && <small>{roomForm.formState.errors.venueId.message}</small>}</label>
                <div className="venue-form-grid">
                  <label className="form-field"><span>Название зала</span><input maxLength={120} {...roomForm.register("name")} placeholder="Большой зал" />{roomForm.formState.errors.name && <small>{roomForm.formState.errors.name.message}</small>}</label>
                  <label className="form-field"><span>Вместимость</span><input inputMode="numeric" min="1" type="number" {...roomForm.register("capacity")} placeholder="100" />{roomForm.formState.errors.capacity && <small>{roomForm.formState.errors.capacity.message}</small>}</label>
                </div>
                <label className="form-field"><span>Ставка, ₽/час (если платно)</span><input inputMode="decimal" min="0" step="0.01" type="number" {...roomForm.register("hourlyRate")} placeholder="Необязательно" />{roomForm.formState.errors.hourlyRate && <small>{roomForm.formState.errors.hourlyRate.message}</small>}</label>
                <label className="form-field"><span>Оснащение, через запятую</span><input maxLength={500} {...roomForm.register("equipment")} placeholder="Проектор, микрофоны, Wi-Fi" /></label>
                {roomError && <p className="auth-message auth-message-error" role="alert">{roomError}</p>}
                <button className="button button-primary" disabled={roomForm.formState.isSubmitting || venues.length === 0} type="submit">
                  {roomForm.formState.isSubmitting ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}Добавить зал
                </button>
              </form>
            </div>
          </section>
        )}

        {isVenueAdmin && pendingBookings.length > 0 && (
          <section className="venue-admin-panel">
            <header><span className="section-kicker">ВХОДЯЩИЕ ЗАПРОСЫ</span><h2>Бронирования на рассмотрении</h2></header>
            {bookingError && <p className="auth-message auth-message-error" role="alert">{bookingError}</p>}
            <ul className="venue-booking-list">
              {pendingBookings.map((booking) => (
                <li className="venue-booking-item" key={booking.id}>
                  <div><strong>{booking.event_title}</strong><p>{booking.venue_name} · {booking.room_name}</p>{booking.guest_count !== null && <p>{booking.guest_count} гостей</p>}<time dateTime={booking.starts_at}>{new Date(booking.starts_at).toLocaleString("ru-RU")}</time><span> — </span><time dateTime={booking.ends_at}>{new Date(booking.ends_at).toLocaleString("ru-RU")}</time>{booking.organizer_note && <p>{booking.organizer_note}</p>}</div>
                  <div className="venue-booking-actions">
                    <button className="button button-primary" disabled={busyId === booking.id} onClick={() => void reviewBooking(booking, "approved")} type="button">{busyId === booking.id ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}Подтвердить</button>
                    <button className="button button-outline" disabled={busyId === booking.id} onClick={() => void reviewBooking(booking, "rejected")} type="button"><X size={14} />Отклонить</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="venue-directory">
          {venues.length === 0 ? (
            <div className="planning-empty">
              <MapPin size={22} />
              <strong>Каталог пока пуст</strong>
              <p>{isVenueAdmin ? "Добавьте площадку и залы, чтобы они появились для организаторов." : "Площадки появятся после добавления каталога администраторами."}</p>
            </div>
          ) : (
            venues.map((venue) => {
              const venueRooms = rooms.filter((room) => room.venue_id === venue.id);
              return (
                <article className={`venue-card ${venue.active ? "" : "venue-card-inactive"}`} key={venue.id}>
                  <header className="venue-card-heading">
                    <div><span className="section-kicker">{venue.active ? "ДОСТУПНАЯ ПЛОЩАДКА" : "НЕАКТИВНАЯ ПЛОЩАДКА"}</span><h2>{venue.name}</h2><p><MapPin size={13} />{venue.address}</p></div>
                    {isVenueAdmin && <button className="button button-outline venue-toggle" disabled={busyId === venue.id} onClick={() => void toggleVenue(venue)} type="button">{busyId === venue.id ? <LoaderCircle className="spin" size={14} /> : null}{venue.active ? "Скрыть" : "Опубликовать"}</button>}
                  </header>
                  {venue.description && <p className="venue-description">{venue.description}</p>}
                  {venueRooms.length === 0 ? <p className="venue-no-rooms">Залы пока не добавлены.</p> : (
                    <ul className="venue-room-list">
                      {venueRooms.map((room) => (
                        <li className={room.active ? "" : "venue-room-inactive"} key={room.id}>
                          <div><strong>{room.name}</strong><span>До {room.capacity} гостей</span>{room.hourly_rate !== null && <span>{new Intl.NumberFormat("ru-RU").format(room.hourly_rate)} ₽/час</span>}{room.equipment.length > 0 && <p>{room.equipment.join(" · ")}</p>}</div>
                          {isVenueAdmin && <button className="venue-room-toggle" disabled={busyId === room.id} onClick={() => void toggleRoom(room)} type="button">{busyId === room.id ? <LoaderCircle className="spin" size={14} /> : null}{room.active ? "Скрыть зал" : "Опубликовать зал"}</button>}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
