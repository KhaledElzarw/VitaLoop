import { z } from "zod";

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
  message: "Use 24-hour HH:MM time.",
});

export const builtinReminderIdSchema = z.enum([
  "hydration",
  "eye-strain",
  "stretch",
  "stand-walk",
  "posture",
  "breathing-reset",
  "sleep-routine",
  "mood-energy",
]);
export const customReminderIdSchema = z
  .string()
  .regex(/^custom-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
export const reminderIdSchema = z.union([
  builtinReminderIdSchema,
  customReminderIdSchema,
]);

export const reminderDefinitionSchema = z.object({
  id: reminderIdSchema,
  title: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  suggestedFrequency: z.string().min(1),
  enabledByDefault: z.boolean(),
  wellnessIntent: z.string().min(1),
  displayPriority: z.number().int().positive(),
  customFrequencyMinutes: z.number().int().min(5).max(1440).optional(),
});

export const customReminderDefinitionSchema = reminderDefinitionSchema.extend({
  id: customReminderIdSchema,
  customFrequencyMinutes: z.number().int().min(5).max(1440),
});

export const appSettingsSchema = z.object({
  timezone: z.string().min(1),
  quietHoursEnabled: z.boolean(),
  quietHoursStart: timeOfDaySchema,
  quietHoursEnd: timeOfDaySchema,
  reminderIntensity: z.enum(["gentle", "balanced", "active"]),
  workdayStart: timeOfDaySchema,
  workdayEnd: timeOfDaySchema,
  preferredReminderCategories: z.array(reminderIdSchema).min(1),
  customReminders: customReminderDefinitionSchema.array().default([]),
});

export type ReminderDefinition = z.infer<typeof reminderDefinitionSchema>;
export type CustomReminderDefinition = z.infer<
  typeof customReminderDefinitionSchema
>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type BuiltinReminderId = z.infer<typeof builtinReminderIdSchema>;
