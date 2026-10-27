import { z } from "zod";

export const eventUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    event_date: z.string().date().optional(),
    format: z.string().trim().max(80).optional(),
    guests_count: z.number().int().positive().nullable().optional(),
    budget: z.number().nonnegative().nullable().optional(),
    venue_name: z.string().trim().max(160).optional(),
    goal: z.string().trim().max(1000).optional(),
    target_audience: z.string().trim().max(1000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one event field must be provided",
  });

export const eventUpdateProposalSchema = z.object({
  proposal: eventUpdateSchema,
  requiresUserConfirmation: z.literal(true),
  saved: z.literal(false),
});

export const eventPlanSchema = z.object({
  goal: z.string().min(10).max(1000).describe("Цель мероприятия, сформулированная на русском языке."),
  targetAudience: z.string().min(5).max(1000).describe("Описание целевой аудитории на русском языке."),
  format: z.string().min(2).max(80).describe("Формат мероприятия на русском языке."),
  program: z
    .array(
      z.object({
        startTime: z.string().max(30).describe("Время начала, например 10:00."),
        durationMinutes: z.number().int().positive().max(720).describe("Длительность пункта в минутах."),
        title: z.string().min(2).max(120).describe("Название пункта программы на русском языке."),
        description: z.string().min(2).max(500).describe("Краткое описание пункта программы на русском языке."),
      }),
    )
    .min(1)
    .max(16),
  risks: z
    .array(
      z.object({
        title: z.string().min(2).max(120).describe("Название риска на русском языке."),
        mitigation: z.string().min(2).max(400).describe("Мера снижения риска на русском языке."),
        likelihood: z.enum(["low", "medium", "high"]).describe("Вероятность риска: low, medium или high."),
      }),
    )
    .max(8),
});

export type EventPlan = z.infer<typeof eventPlanSchema>;
