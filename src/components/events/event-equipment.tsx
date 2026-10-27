"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { EventEquipmentRecord } from "@/lib/supabase/database.types";

const equipmentSchema = z.object({
  name: z.string().trim().min(2, "Укажите название реквизита.").max(160),
  quantity: z.string().regex(/^\d+$/, "Укажите целое количество.").refine((value) => Number(value) > 0 && Number(value) <= 10000, "Количество должно быть от 1 до 10 000."),
  notes: z.string().trim().max(1000),
});

type EquipmentFormValues = z.infer<typeof equipmentSchema>;
const equipmentStatusLabels = { needed: "Нужно найти", acquired: "Подготовлено", rented: "Аренда", not_needed: "Не требуется" };

export function EventEquipment({
  eventId,
  initialEquipment,
  canManage,
}: {
  eventId: string;
  initialEquipment: EventEquipmentRecord[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: { name: "", quantity: "1", notes: "" },
  });

  async function createEquipment(values: EquipmentFormValues) {
    setFormError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Сессия истекла. Войдите в аккаунт и попробуйте ещё раз.");

      const { error } = await supabase.from("event_equipment").insert({
        event_id: eventId,
        created_by: user.id,
        name: values.name,
        quantity: Number(values.quantity),
        notes: values.notes,
      });
      if (error) throw new Error(`Не удалось добавить реквизит: ${error.message}`);

      reset({ name: "", quantity: "1", notes: "" });
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось добавить реквизит.");
    }
  }

  async function updateStatus(item: EventEquipmentRecord, status: EventEquipmentRecord["status"]) {
    setActionError("");
    setIsUpdating(item.id);
    try {
      const { error } = await createClient()
        .from("event_equipment")
        .update({ status })
        .eq("id", item.id);
      if (error) throw new Error(`Не удалось обновить статус: ${error.message}`);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить статус.");
    } finally {
      setIsUpdating(null);
    }
  }

  async function deleteItem(item: EventEquipmentRecord) {
    if (!window.confirm(`Удалить «${item.name}» из списка реквизита?`)) return;
    setActionError("");
    setIsUpdating(item.id);
    try {
      const { error } = await createClient().from("event_equipment").delete().eq("id", item.id);
      if (error) throw new Error(`Не удалось удалить реквизит: ${error.message}`);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось удалить реквизит.");
    } finally {
      setIsUpdating(null);
    }
  }

  return (
    <section className="planning-module">
      <header className="planning-module-heading">
        <div>
          <span className="section-kicker">ЧТО ПОДГОТОВИТЬ</span>
          <h2>Реквизит и оборудование</h2>
          <p>Соберите список необходимого для проведения мероприятия.</p>
        </div>
        <span className="planning-count">{initialEquipment.length} позиций</span>
      </header>

      {actionError && <p className="auth-message auth-message-error" role="alert">{actionError}</p>}

      {canManage && (
        <form className="planning-create-form equipment-create-form" onSubmit={handleSubmit(createEquipment)} noValidate>
          <label className="form-field">
            <span>Название</span>
            <input maxLength={160} {...register("name")} placeholder="Например, проектор" />
            {errors.name && <small>{errors.name.message}</small>}
          </label>
          <label className="form-field">
            <span>Количество</span>
            <input inputMode="numeric" max="10000" min="1" type="number" {...register("quantity")} />
            {errors.quantity && <small>{errors.quantity.message}</small>}
          </label>
          <label className="form-field planning-description">
            <span>Комментарий</span>
            <input maxLength={1000} {...register("notes")} placeholder="Размер, модель или источник" />
            {errors.notes && <small>{errors.notes.message}</small>}
          </label>
          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
            Добавить позицию
          </button>
          {formError && <p className="auth-message auth-message-error planning-form-error" role="alert">{formError}</p>}
        </form>
      )}

      {initialEquipment.length === 0 ? (
        <div className="planning-empty">
          <Plus size={20} />
          <strong>Список пока пуст</strong>
          <p>{canManage ? "Добавьте оборудование, которое понадобится на мероприятии." : "Организатор ещё не добавил реквизит."}</p>
        </div>
      ) : (
        <ul className="planning-list">
          {initialEquipment.map((item) => (
            <li className="planning-item equipment-item" key={item.id}>
              <div className="planning-item-content">
                <strong>{item.name}<span className="equipment-quantity">× {item.quantity}</span></strong>
                {item.notes && <p>{item.notes}</p>}
                <span className={`planning-status equipment-status-${item.status}`}>{equipmentStatusLabels[item.status]}</span>
              </div>
              {canManage && (
                <div className="equipment-actions">
                  <label>
                    <span className="sr-only">Статус: {item.name}</span>
                    <select disabled={isUpdating === item.id} onChange={(event) => void updateStatus(item, event.target.value as EventEquipmentRecord["status"])} value={item.status}>
                      {Object.entries(equipmentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <button aria-label={`Удалить ${item.name}`} className="planning-delete" disabled={isUpdating === item.id} onClick={() => void deleteItem(item)} type="button">
                    {isUpdating === item.id ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
