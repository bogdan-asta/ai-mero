"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { ArrowLeft, ArrowUp, Check, LoaderCircle, Sparkles, Square } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  eventPlanSchema,
  eventUpdateProposalSchema,
  type EventPlan,
} from "@/lib/ai/schemas";
import { createClient } from "@/lib/supabase/client";

const eventFieldLabels: Record<string, string> = {
  title: "Название",
  event_date: "Дата",
  format: "Формат",
  guests_count: "Количество гостей",
  budget: "Бюджет",
  venue_name: "Площадка",
  goal: "Цель",
  target_audience: "Аудитория",
};

export function EventAssistant({
  eventId,
  eventTitle,
  canApplyPlan,
  initialThreadId,
  initialMessages,
}: {
  eventId: string;
  eventTitle: string;
  canApplyPlan: boolean;
  initialThreadId: string | null;
  initialMessages: UIMessage[];
}) {
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState(initialThreadId);
  const [plan, setPlan] = useState<EventPlan | null>(null);
  const [planError, setPlanError] = useState("");
  const [planNotice, setPlanNotice] = useState("");
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isApplyingPlan, setIsApplyingPlan] = useState(false);
  const [planApplied, setPlanApplied] = useState(false);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: () => ({
          eventId,
          threadId: threadId ?? undefined,
        }),
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          const responseThreadId = response.headers.get("X-Thread-Id");
          if (responseThreadId) {
            setThreadId(responseThreadId);
          }
          return response;
        },
      }),
    [eventId, threadId],
  );
  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    messages: initialMessages,
    transport,
  });
  const isGenerating = status === "submitted" || status === "streaming";

  function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isGenerating) return;
    setInput("");
    void sendMessage({ text });
  }

  async function generatePlan() {
    setPlanError("");
    setPlanNotice("");
    setPlanApplied(false);
    setIsGeneratingPlan(true);

    try {
      const response = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "Не удалось подготовить план.";
        throw new Error(message);
      }

      const parsed = eventPlanSchema.safeParse(
        typeof payload === "object" && payload !== null && "plan" in payload
          ? payload.plan
          : null,
      );
      if (!parsed.success) {
        throw new Error("ИИ вернул план в неизвестном формате. Попробуйте ещё раз.");
      }
      setPlan(parsed.data);
    } catch (error) {
      setPlanError(
        error instanceof Error ? error.message : "Не удалось подготовить план.",
      );
    } finally {
      setIsGeneratingPlan(false);
    }
  }

  async function applyPlan() {
    if (!plan) return;
    setPlanError("");
    setPlanNotice("");
    setIsApplyingPlan(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Сессия истекла. Войдите в аккаунт и попробуйте ещё раз.");
      }

      const { error } = await supabase
        .from("events")
        .update({
          goal: plan.goal,
          target_audience: plan.targetAudience,
          format: plan.format,
          program: plan.program,
          risks: plan.risks,
        })
        .eq("id", eventId);

      if (error) {
        throw new Error(`Не удалось сохранить план: ${error.message}`);
      }

      setPlanApplied(true);
      setPlanNotice("План добавлен в мероприятие. Проверьте детали на странице обзора.");
    } catch (error) {
      setPlanError(
        error instanceof Error ? error.message : "Не удалось сохранить план.",
      );
    } finally {
      setIsApplyingPlan(false);
    }
  }

  return (
    <main className="assistant-page">
      <header className="assistant-header">
        <Link className="back-link" href={`/events/${eventId}`}> <ArrowLeft size={15} /> К мероприятию</Link>
        <div className="assistant-event-title">
          <span className="assistant-brand-icon"><Sparkles size={16} /></span>
          <span><strong>EventAI</strong><small>{eventTitle}</small></span>
        </div>
        <button className="button button-primary assistant-plan-button" disabled={isGeneratingPlan} onClick={generatePlan} type="button">
          {isGeneratingPlan ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}
          Составить план
        </button>
      </header>

      <section aria-label={`Чат EventAI для мероприятия «${eventTitle}»`} className="assistant-chat">
        {planError && <p className="auth-message auth-message-error assistant-plan-message" role="alert">{planError}</p>}
        {planNotice && <p className="auth-message auth-message-success assistant-plan-message" role="status">{planNotice}</p>}
        {plan && (
          <section aria-label="Предложенный план мероприятия" className="assistant-plan">
            <div className="assistant-plan-heading">
              <div><span className="section-kicker">ЧЕРНОВИК, НУЖНА ПРОВЕРКА</span><h2>План мероприятия</h2></div>
              <Link className="text-link" href={`/events/${eventId}`}>Обзор <ArrowLeft size={14} /></Link>
            </div>
            <p><strong>Цель:</strong> {plan.goal}</p>
            <p><strong>Аудитория:</strong> {plan.targetAudience}</p>
            <h3>Программа</h3>
            <ol className="assistant-plan-program">
              {plan.program.map((item, index) => (
                <li key={`${item.startTime}-${index}`}>
                  <span>{item.startTime} · {item.durationMinutes} мин.</span>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </li>
              ))}
            </ol>
            <h3>Риски и меры</h3>
            <ul className="assistant-plan-risks">
              {plan.risks.map((risk, index) => (
                <li key={`${risk.title}-${index}`}>
                  <strong>{risk.title}</strong> — {risk.mitigation}
                </li>
              ))}
            </ul>
            {canApplyPlan ? (
              <button className="button button-primary assistant-apply-plan" disabled={isApplyingPlan || planApplied} onClick={applyPlan} type="button">
                {isApplyingPlan ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
                {planApplied ? "План применён" : "Проверил(а), применить к мероприятию"}
              </button>
            ) : (
              <p className="assistant-plan-readonly">Применить план может только организатор мероприятия.</p>
            )}
          </section>
        )}
        <div aria-live="polite" className="assistant-messages">
          {messages.length === 0 && (
            <div className="assistant-welcome">
              <span className="assistant-welcome-icon"><Sparkles size={20} /></span>
              <h1>Давайте спланируем событие</h1>
              <p>Расскажите, что уже известно, или задайте вопрос. EventAI поможет уточнить детали и предложит план.</p>
              <div className="assistant-prompts">
                <button onClick={() => setInput("Помоги составить программу мероприятия")} type="button">Составить программу</button>
                <button onClick={() => setInput("Какие детали нужно уточнить?")} type="button">Уточнить детали</button>
                <button onClick={() => setInput("Предложи идеи для активностей")} type="button">Придумать активности</button>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <article
              className={`assistant-message ${message.role === "user" ? "assistant-message-user" : "assistant-message-model"}`}
              key={message.id}
            >
              <span className="assistant-message-label">
                {message.role === "user" ? "Вы" : "EventAI"}
              </span>
              {message.parts.map((part, index) =>
                part.type === "text" ? (
                  <p className="assistant-message-text" key={`${message.id}-${index}`}>
                    {part.text}
                  </p>
                ) : isToolUIPart(part) &&
                  part.state === "output-available" &&
                  (part.type === "tool-update_event_card" ||
                    (part.type === "dynamic-tool" &&
                      part.toolName === "update_event_card")) ? (
                  <ProposalCard key={`${message.id}-${index}`} output={part.output} />
                ) : null,
              )}
            </article>
          ))}

          {isGenerating && (
            <div className="assistant-typing" role="status">
              <LoaderCircle className="spin" size={15} /> EventAI готовит ответ…
            </div>
          )}
          {error && (
            <div className="assistant-error" role="alert">
              Не удалось получить ответ: {error.message}
              <button onClick={clearError} type="button">Закрыть</button>
            </div>
          )}
        </div>

        <form className="assistant-composer" onSubmit={submitMessage}>
          <label className="sr-only" htmlFor="assistant-input">Сообщение EventAI</label>
          <textarea
            id="assistant-input"
            maxLength={5000}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Напишите сообщение…"
            rows={2}
            value={input}
          />
          {isGenerating ? (
            <button aria-label="Остановить генерацию" className="assistant-send" onClick={stop} type="button">
              <Square size={15} />
            </button>
          ) : (
            <button aria-label="Отправить сообщение" className="assistant-send" disabled={!input.trim()} type="submit">
              <ArrowUp size={18} />
            </button>
          )}
          <span className="assistant-disclaimer">ИИ может ошибаться. Проверяйте данные перед использованием.</span>
        </form>
      </section>
    </main>
  );
}

function ProposalCard({ output }: { output: unknown }) {
  const parsed = eventUpdateProposalSchema.safeParse(output);
  if (!parsed.success) return null;

  return (
    <div className="assistant-tool-proposal">
      <strong>Предложение для карточки мероприятия</strong>
      <ul>
        {Object.entries(parsed.data.proposal).map(([field, value]) => (
          <li key={field}>
            <span>{eventFieldLabels[field] ?? field}:</span>{" "}
            {value === null ? "не указано" : String(value)}
          </li>
        ))}
      </ul>
      <p>Пока не сохранено. Проверьте предложение и внесите изменения в карточке мероприятия.</p>
    </div>
  );
}
