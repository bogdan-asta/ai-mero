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
  goal: z.string().min(10).max(1000),
  targetAudience: z.string().min(5).max(1000),
  format: z.string().min(2).max(80),
  program: z
    .array(
      z.object({
        startTime: z.string().max(30),
        durationMinutes: z.number().int().positive().max(720),
        title: z.string().min(2).max(120),
        description: z.string().min(2).max(500),
      }),
    )
    .min(1)
    .max(16),
  risks: z
    .array(
      z.object({
        title: z.string().min(2).max(120),
        mitigation: z.string().min(2).max(400),
        likelihood: z.enum(["low", "medium", "high"]),
      }),
    )
    .max(8),
});

export type EventPlan = z.infer<typeof eventPlanSchema>;
