import { z } from "zod";

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
  message: "Use 24-hour HH:MM time.",
});

export const reminderIdSchema = z.enum([
  "hydration",
  "eye-strain",
  "stretch",
  "stand-walk",
  "posture",
  "breathing-reset",
  "sleep-routine",
  "mood-energy",
]);

export const reminderDefinitionSchema = z.object({
  id: reminderIdSchema,
  title: z.string().min(1),
  cadenceMinutes: z.number().int().positive(),
  prompt: z.string().min(1),
  enabledByDefault: z.boolean(),
});

export const appSettingsSchema = z.object({
  quietHours: z.object({
    enabled: z.boolean(),
    start: timeOfDaySchema,
    end: timeOfDaySchema,
  }),
  workdayWindow: z.object({
    start: timeOfDaySchema,
    end: timeOfDaySchema,
  }),
  reminderIntensity: z.enum(["light", "balanced", "steady"]),
  enabledReminderIds: z.array(reminderIdSchema).min(1),
});

export type ReminderDefinition = z.infer<typeof reminderDefinitionSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
