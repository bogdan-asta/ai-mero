"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lightbulb, LoaderCircle, ThumbsUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { EventIdeaSummary } from "@/lib/supabase/database.types";

const ideaSchema = z.object({
  title: z.string().trim().min(2, "Добавьте название идеи.").max(160),
  description: z.string().trim().max(2000),
});

type IdeaFormValues = z.infer<typeof ideaSchema>;

export function EventIdeas({
  eventId,
  userId,
  ideas,
  canManage,
}: {
  eventId: string;
  userId: string;
  ideas: EventIdeaSummary[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyIdeaId, setBusyIdeaId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IdeaFormValues>({
    resolver: zodResolver(ideaSchema),
    defaultValues: { title: "", description: "" },
  });

  async function addIdea(values: IdeaFormValues) {
    setFormError("");
    try {
      const { error } = await createClient().from("event_ideas").insert({
        event_id: eventId,
        created_by: userId,
        title: values.title,
        description: values.description,
      });
      if (error) throw new Error(`Не удалось добавить идею: ${error.message}`);
      reset();
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось добавить идею.");
    }
  }

  async function toggleVote(idea: EventIdeaSummary) {
    setActionError("");
    setBusyIdeaId(idea.id);
    try {
      const supabase = createClient();
      const result = idea.voted_by_me
        ? await supabase
            .from("event_idea_votes")
            .delete()
            .eq("event_idea_id", idea.id)
            .eq("user_id", userId)
        : await supabase.from("event_idea_votes").insert({
            event_idea_id: idea.id,
            event_id: eventId,
            user_id: userId,
          });
      if (result.error) throw new Error(`Не удалось сохранить голос: ${result.error.message}`);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось сохранить голос.");
    } finally {
      setBusyIdeaId(null);
    }
  }

  async function deleteIdea(idea: EventIdeaSummary) {
    if (!window.confirm(`Удалить идею «${idea.title}»?`)) return;
    setActionError("");
    setBusyIdeaId(idea.id);
    try {
      const { error } = await createClient().from("event_ideas").delete().eq("id", idea.id);
      if (error) throw new Error(`Не удалось удалить идею: ${error.message}`);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось удалить идею.");
    } finally {
      setBusyIdeaId(null);
    }
  }

  return (
    <section className="planning-module ideas-module">
      <header className="planning-module-heading">
        <div>
          <span className="section-kicker">СОВМЕСТНОЕ ПЛАНИРОВАНИЕ</span>
          <h2>Идеи команды</h2>
          <p>Добавляйте варианты и голосуйте за те, которые стоит развить.</p>
        </div>
        <Lightbulb className="ideas-module-icon" size={20} />
      </header>

      <form className="idea-create-form" onSubmit={handleSubmit(addIdea)} noValidate>
        <label className="form-field">
          <span>Короткое название идеи</span>
          <input maxLength={160} {...register("title")} placeholder="Например, интерактивная зона" />
          {errors.title && <small>{errors.title.message}</small>}
        </label>
        <label className="form-field">
          <span>Описание</span>
          <textarea maxLength={2000} rows={3} {...register("description")} placeholder="Как это будет работать?" />
          {errors.description && <small>{errors.description.message}</small>}
        </label>
        {formError && <p className="auth-message auth-message-error idea-form-error" role="alert">{formError}</p>}
        <button className="button button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? <LoaderCircle className="spin" size={15} /> : <Lightbulb size={15} />}Добавить идею
        </button>
      </form>

      {actionError && <p className="auth-message auth-message-error" role="alert">{actionError}</p>}
      {ideas.length === 0 ? (
        <div className="planning-empty">
          <Lightbulb size={21} />
          <strong>Идей пока нет</strong>
          <p>Добавьте первую идею и пригласите команду к обсуждению.</p>
        </div>
      ) : (
        <ul className="idea-list">
          {ideas.map((idea) => (
            <li className="idea-card" key={idea.id}>
              <div className="idea-card-content">
                <h3>{idea.title}</h3>
                {idea.description && <p>{idea.description}</p>}
                <time dateTime={idea.created_at}>Добавлена {new Date(idea.created_at).toLocaleDateString("ru-RU")}</time>
              </div>
              <div className="idea-card-actions">
                <button aria-pressed={idea.voted_by_me} className={`idea-vote ${idea.voted_by_me ? "idea-vote-active" : ""}`} disabled={busyIdeaId === idea.id} onClick={() => void toggleVote(idea)} type="button">
                  {busyIdeaId === idea.id ? <LoaderCircle className="spin" size={15} /> : <ThumbsUp size={15} />}
                  <span>{idea.vote_count}</span>
                </button>
                {(idea.created_by === userId || canManage) && (
                  <button aria-label={`Удалить идею ${idea.title}`} className="planning-delete" disabled={busyIdeaId === idea.id} onClick={() => void deleteIdea(idea)} type="button">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
