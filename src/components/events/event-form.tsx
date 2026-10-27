"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { EventRecord } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";

const eventFormSchema = z.object({
  title: z.string().trim().min(3, "Название должно содержать не менее 3 символов.").max(120),
  idea: z.string().trim().min(5, "Опишите задумку чуть подробнее.").max(4000),
  eventDate: z.string().refine(
    (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Укажите корректную дату.",
  ),
  format: z.string().trim().max(80, "Не более 80 символов."),
  guestsCount: z.string().refine(
    (value) => !value || (/^\d+$/.test(value) && Number(value) > 0),
    "Укажите целое число гостей больше нуля.",
  ),
  budget: z.string().refine(
    (value) => !value || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) >= 0),
    "Укажите сумму неотрицательным числом, максимум два знака после запятой.",
  ),
  venueName: z.string().trim().max(160, "Не более 160 символов."),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

export function EventForm({ event }: { event?: EventRecord }) {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const isEditing = Boolean(event);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: event?.title ?? "",
      idea: event?.idea ?? "",
      eventDate: event?.event_date ?? "",
      format: event?.format ?? "",
      guestsCount: event?.guests_count?.toString() ?? "",
      budget: event?.budget?.toString() ?? "",
      venueName: event?.venue_name ?? "",
    },
  });

  async function onSubmit(values: EventFormValues) {
    setFormError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setFormError("Сессия истекла. Войдите в аккаунт и попробуйте ещё раз.");
        return;
      }

      const eventData = {
        title: values.title,
        idea: values.idea,
        description: "",
        event_date: values.eventDate || null,
        format: values.format,
        guests_count: values.guestsCount ? Number(values.guestsCount) : null,
        budget: values.budget ? Number(values.budget) : null,
        venue_name: values.venueName,
      };

      if (event) {
        const { error } = await supabase
          .from("events")
          .update(eventData)
          .eq("id", event.id);

        if (error) {
          setFormError(`Не удалось сохранить мероприятие: ${error.message}`);
          return;
        }

        router.replace(`/events/${event.id}`);
        router.refresh();
        return;
      }

      const { data: createdEvent, error } = await supabase
        .from("events")
        .insert({ ...eventData, created_by: user.id })
        .select("id")
        .single();

      if (error) {
        setFormError(`Не удалось создать мероприятие: ${error.message}`);
        return;
      }

      router.replace(`/events/${createdEvent.id}`);
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? `Не удалось сохранить мероприятие: ${error.message}`
          : "Не удалось сохранить мероприятие.",
      );
    }
  }

  return (
    <main className="app-page">
      <div className="app-page-inner">
        <Link className="back-link" href={isEditing && event ? `/events/${event.id}` : "/events"}>
          <ArrowLeft size={15} /> Назад
        </Link>

        <div className="page-heading">
          <span className="section-kicker">{isEditing ? "ИЗМЕНЕНИЕ ДЕТАЛЕЙ" : "НОВОЕ СОБЫТИЕ"}</span>
          <h1>{isEditing ? "Редактировать мероприятие" : "Расскажите о задумке"}</h1>
          <p>
            {isEditing
              ? "Поля можно будет дополнить позже."
              : "Сохраните идею сейчас — план и подробности можно будет добавить позже."}
          </p>
        </div>

        {formError && <p className="auth-message auth-message-error" role="alert">{formError}</p>}

        <form className="event-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className="form-field">
            <span>Название мероприятия *</span>
            <input {...register("title")} placeholder="Например, День идей и технологий" />
            {errors.title && <small>{errors.title.message}</small>}
          </label>

          <label className="form-field">
            <span>Идея мероприятия *</span>
            <textarea
              {...register("idea")}
              placeholder="Что хотите провести? Для кого? Каким вы представляете это событие?"
              rows={5}
            />
            {errors.idea && <small>{errors.idea.message}</small>}
          </label>

          <div className="form-grid">
            <label className="form-field">
              <span>Дата</span>
              <input type="date" {...register("eventDate")} />
              {errors.eventDate && <small>{errors.eventDate.message}</small>}
            </label>
            <label className="form-field">
              <span>Формат</span>
              <input {...register("format")} placeholder="Конференция, хакатон…" />
              {errors.format && <small>{errors.format.message}</small>}
            </label>
            <label className="form-field">
              <span>Количество гостей</span>
              <input inputMode="numeric" min="1" type="number" {...register("guestsCount")} placeholder="80" />
              {errors.guestsCount && <small>{errors.guestsCount.message}</small>}
            </label>
            <label className="form-field">
              <span>Бюджет, ₽</span>
              <input inputMode="decimal" min="0" step="0.01" type="number" {...register("budget")} placeholder="50000" />
              {errors.budget && <small>{errors.budget.message}</small>}
            </label>
          </div>

          <label className="form-field">
            <span>Площадка (если уже выбрана)</span>
            <input {...register("venueName")} placeholder="Название площадки или корпуса" />
            {errors.venueName && <small>{errors.venueName.message}</small>}
          </label>

          <div className="event-form-actions">
            <Link className="button button-outline" href={isEditing && event ? `/events/${event.id}` : "/events"}>
              Отмена
            </Link>
            <button className="button button-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? <LoaderCircle className="spin" size={16} /> : null}
              {isEditing ? "Сохранить" : "Создать мероприятие"}
              {!isSubmitting && <ArrowRight size={16} />}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
