"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Circle, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { EventTaskRecord } from "@/lib/supabase/database.types";

const taskSchema = z.object({
  title: z.string().trim().min(2, "Добавьте название задачи.").max(160),
  description: z.string().trim().max(2000),
  dueDate: z.string().refine(
    (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Укажите корректную дату.",
  ),
  priority: z.enum(["low", "medium", "high"]),
});

type TaskFormValues = z.infer<typeof taskSchema>;

const priorityLabels = { low: "Низкий", medium: "Обычный", high: "Высокий" };
const statusLabels = { todo: "К выполнению", in_progress: "В работе", done: "Готово" };

export function EventTasks({
  eventId,
  initialTasks,
  canManage,
}: {
  eventId: string;
  initialTasks: EventTaskRecord[];
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
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", dueDate: "", priority: "medium" },
  });

  async function createTask(values: TaskFormValues) {
    setFormError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Сессия истекла. Войдите в аккаунт и попробуйте ещё раз.");

      const { error } = await supabase.from("event_tasks").insert({
        event_id: eventId,
        created_by: user.id,
        title: values.title,
        description: values.description,
        due_date: values.dueDate || null,
        priority: values.priority,
      });
      if (error) throw new Error(`Не удалось добавить задачу: ${error.message}`);

      reset();
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось добавить задачу.");
    }
  }

  async function updateTask(task: EventTaskRecord, changes: Partial<Pick<EventTaskRecord, "status" | "priority">>) {
    setActionError("");
    setIsUpdating(task.id);
    try {
      const { error } = await createClient()
        .from("event_tasks")
        .update(changes)
        .eq("id", task.id);
      if (error) throw new Error(`Не удалось обновить задачу: ${error.message}`);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить задачу.");
    } finally {
      setIsUpdating(null);
    }
  }

  async function deleteTask(task: EventTaskRecord) {
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    setActionError("");
    setIsUpdating(task.id);
    try {
      const { error } = await createClient().from("event_tasks").delete().eq("id", task.id);
      if (error) throw new Error(`Не удалось удалить задачу: ${error.message}`);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось удалить задачу.");
    } finally {
      setIsUpdating(null);
    }
  }

  return (
    <section className="planning-module">
      <header className="planning-module-heading">
        <div>
          <span className="section-kicker">ПОДГОТОВКА</span>
          <h2>Задачи</h2>
          <p>Разбейте подготовку на понятные шаги и отмечайте прогресс.</p>
        </div>
        <span className="planning-count">{initialTasks.filter((task) => task.status !== "done").length} активных</span>
      </header>

      {actionError && <p className="auth-message auth-message-error" role="alert">{actionError}</p>}

      {canManage && (
        <form className="planning-create-form" onSubmit={handleSubmit(createTask)} noValidate>
          <label className="form-field">
            <span>Название задачи</span>
            <input maxLength={160} {...register("title")} placeholder="Например, согласовать программу" />
            {errors.title && <small>{errors.title.message}</small>}
          </label>
          <label className="form-field">
            <span>Срок</span>
            <input type="date" {...register("dueDate")} />
            {errors.dueDate && <small>{errors.dueDate.message}</small>}
          </label>
          <label className="form-field">
            <span>Приоритет</span>
            <select {...register("priority")}>
              {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="form-field planning-description">
            <span>Комментарий</span>
            <input maxLength={2000} {...register("description")} placeholder="Подробности или ожидаемый результат" />
          </label>
          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
            Добавить задачу
          </button>
          {formError && <p className="auth-message auth-message-error planning-form-error" role="alert">{formError}</p>}
        </form>
      )}

      {initialTasks.length === 0 ? (
        <div className="planning-empty">
          <Circle size={20} />
          <strong>Задач пока нет</strong>
          <p>{canManage ? "Добавьте первый шаг подготовки." : "Организатор ещё не добавил задачи."}</p>
        </div>
      ) : (
        <ul className="planning-list">
          {initialTasks.map((task) => (
            <li className={`planning-item ${task.status === "done" ? "planning-item-done" : ""}`} key={task.id}>
              <button
                aria-label={task.status === "done" ? "Вернуть задачу в работу" : "Отметить задачу выполненной"}
                className="planning-check"
                disabled={!canManage || isUpdating === task.id}
                onClick={() => void updateTask(task, { status: task.status === "done" ? "todo" : "done" })}
                type="button"
              >
                {isUpdating === task.id ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
              </button>
              <div className="planning-item-content">
                <strong>{task.title}</strong>
                {task.description && <p>{task.description}</p>}
                <div className="planning-item-meta">
                  <span className={`planning-status planning-status-${task.status}`}>{statusLabels[task.status]}</span>
                  <span>Приоритет: {priorityLabels[task.priority]}</span>
                  {task.due_date && <time dateTime={task.due_date}>{new Date(`${task.due_date}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</time>}
                </div>
              </div>
              {canManage && (
                <button aria-label={`Удалить задачу ${task.title}`} className="planning-delete" disabled={isUpdating === task.id} onClick={() => void deleteTask(task)} type="button">
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
