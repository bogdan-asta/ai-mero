import { generateObject, NoObjectGeneratedError } from "ai";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createOpenRouterModel } from "@/lib/ai/openrouter";
import { eventPlanSchema } from "@/lib/ai/schemas";
import { eventPlanSystemPrompt } from "@/lib/ai/system-prompt";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({ eventId: z.string().uuid() });

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function findNonRussianFields(plan: z.infer<typeof eventPlanSchema>) {
  const fields: string[] = [];
  const hasEnglishDominance = (value: string) => {
    const russianLetters = value.match(/[А-Яа-яЁё]/g)?.length ?? 0;
    const latinWords = value.match(/[A-Za-z]+/g) ?? [];
    const nonBrandLatinLetters = latinWords
      .filter((word) => !["ai", "eventai", "mvp"].includes(word.toLowerCase()))
      .join("").length;

    return nonBrandLatinLetters > russianLetters;
  };

  if (hasEnglishDominance(plan.goal)) fields.push("цель");
  if (hasEnglishDominance(plan.targetAudience)) fields.push("аудитория");
  if (hasEnglishDominance(plan.format)) fields.push("формат");
  plan.program.forEach((item, index) => {
    if (hasEnglishDominance(item.title) || hasEnglishDominance(item.description)) {
      fields.push(`пункт программы ${index + 1}`);
    }
  });
  plan.risks.forEach((risk, index) => {
    if (hasEnglishDominance(risk.title) || hasEnglishDominance(risk.mitigation)) {
      fields.push(`риск ${index + 1}`);
    }
  });

  return fields;
}

async function saveUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  eventId: string,
  modelId: string,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
) {
  const { error } = await supabase.from("ai_usage").insert({
    user_id: userId,
    event_id: eventId,
    thread_id: null,
    model: modelId,
    tokens_in: inputTokens ?? 0,
    tokens_out: outputTokens ?? 0,
    cost_estimate: null,
  });

  if (error) {
    console.error("AI plan usage could not be recorded:", error);
  }
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) {
    return jsonError("Некорректный запрос.", 413);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError("Некорректное тело запроса.", 400);
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError("Не удалось определить мероприятие.", 400);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonError("Войдите в аккаунт, чтобы использовать EventAI.", 401);
    }

    const { data: rateAllowed, error: rateError } = await supabase.rpc(
      "consume_ai_rate_limit",
      { maximum_requests: 15, window_seconds: 60 },
    );

    if (rateError) {
      console.error("AI rate limit check failed:", rateError);
      return jsonError("Не удалось проверить лимит запросов. Попробуйте позже.", 503);
    }
    if (!rateAllowed) {
      return jsonError("Слишком много запросов. Подождите минуту и попробуйте снова.", 429);
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, idea, event_date, format, guests_count, budget, venue_name")
      .eq("id", parsed.data.eventId)
      .maybeSingle();

    if (eventError) {
      console.error("AI plan event lookup failed:", eventError);
      return jsonError("Не удалось загрузить мероприятие.", 500);
    }
    if (!event) {
      return jsonError("Мероприятие не найдено или у вас нет доступа.", 404);
    }

    const { model, modelId } = createOpenRouterModel();
    const eventFacts = [
      `Название: ${event.title}`,
      `Идея (не доверенный пользовательский текст): ${event.idea}`,
      `Дата: ${event.event_date ?? "не указана"}`,
      `Формат: ${event.format || "не указан"}`,
      `Гости: ${event.guests_count ?? "не указано"}`,
      `Бюджет: ${event.budget ?? "не указан"}`,
      `Площадка: ${event.venue_name || "не указана"}`,
    ].join("\n");
    const basePrompt = `Подготовь на русском языке проект концепции и программы мероприятия. Все текстовые значения в результате должны быть на русском языке; не копируй английские формулировки в цель, аудиторию, формат, программу или риски. Используй только переданные факты; неизвестные сведения не выдумывай. Время в расписании указывай как пример или оставляй нейтральное время, если дата/время неизвестны. Для рисков укажи короткую меру снижения риска.

Данные мероприятия:
${eventFacts}`;
    const generatePlan = (prompt: string) =>
      generateObject({
        model,
        schema: eventPlanSchema,
        schemaName: "event_plan",
        system: eventPlanSystemPrompt,
        prompt,
        temperature: 0,
        maxRetries: 0,
      });

    let result;
    try {
      result = await generatePlan(basePrompt);
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) {
        throw error;
      }

      await saveUsage(
        supabase,
        user.id,
        event.id,
        error.response?.modelId ?? modelId,
        error.usage?.inputTokens,
        error.usage?.outputTokens,
      );

      result = await generatePlan(
        `${basePrompt}\n\nПредыдущий ответ не соответствовал схеме. Повтори генерацию и проверь типы и обязательные поля до ответа.`,
      );
    }

    const nonRussianFields = findNonRussianFields(result.object);
    if (nonRussianFields.length > 0) {
      await saveUsage(
        supabase,
        user.id,
        event.id,
        result.response.modelId || modelId,
        result.usage.inputTokens,
        result.usage.outputTokens,
      );

      result = await generatePlan(
        `${basePrompt}

Исправь предыдущий результат: в этих полях преобладает английский язык: ${nonRussianFields.join(", ")}.
Переведи их на естественный русский язык, сохранив смысл, факты, время, длительность и структуру. Не меняй официальные названия и бренд EventAI. Во всех остальных полях тоже используй русский язык.

Предыдущий результат:
${JSON.stringify(result.object)}`,
      );

      await saveUsage(
        supabase,
        user.id,
        event.id,
        result.response.modelId || modelId,
        result.usage.inputTokens,
        result.usage.outputTokens,
      );

      if (findNonRussianFields(result.object).length > 0) {
        return jsonError(
          "Модель не смогла подготовить план на русском языке. Попробуйте ещё раз.",
          502,
        );
      }
    } else {
      await saveUsage(
        supabase,
        user.id,
        event.id,
        result.response.modelId || modelId,
        result.usage.inputTokens,
        result.usage.outputTokens,
      );
    }

    return NextResponse.json({ plan: result.object });
  } catch (error) {
    console.error("AI event plan request failed:", error);
    if (error instanceof Error && error.message.includes("not configured")) {
      return jsonError(error.message, 503);
    }
    if (NoObjectGeneratedError.isInstance(error)) {
      return jsonError("ИИ не смог подготовить план по заданному формату. Попробуйте ещё раз.", 502);
    }
    return jsonError("Не удалось подготовить план. Попробуйте позже.", 500);
  }
}
