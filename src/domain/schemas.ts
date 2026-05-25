import { z } from "zod";

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
  message: "Use 24-hour HH:MM time.",
});
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Use YYYY-MM-DD date.",
});
const weekdaySchema = z.enum([
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]);

export const customReminderScheduleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("interval"),
    intervalMinutes: z.number().int().min(5).max(1440),
  }),
  z.object({
    type: z.literal("dailyInterval"),
    dayIntervalDays: z.number().int().min(1).max(365),
    timeOfDay: timeOfDaySchema,
    startDate: dateOnlySchema,
  }),
  z.object({
    type: z.literal("weekdayInterval"),
    weekdays: weekdaySchema.array().min(1).max(7),
    timeOfDay: timeOfDaySchema,
  }),
  z.object({
    type: z.literal("oneTime"),
    date: dateOnlySchema,
    timeOfDay: timeOfDaySchema,
  }),
]);

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
  schedule: customReminderScheduleSchema.optional(),
  respectReminderWindows: z.boolean().optional(),
});

const currentCustomReminderDefinitionSchema = reminderDefinitionSchema.extend({
  id: customReminderIdSchema,
  schedule: customReminderScheduleSchema,
  respectReminderWindows: z.boolean(),
  customFrequencyMinutes: z.never().optional(),
});

export const customReminderDefinitionSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const reminder = value as Record<string, unknown>;

  if (!reminder.schedule && typeof reminder.customFrequencyMinutes === "number") {
    const { customFrequencyMinutes, ...currentReminder } = reminder;

    return {
      ...currentReminder,
      schedule: {
        type: "interval",
        intervalMinutes: customFrequencyMinutes,
      },
      respectReminderWindows: true,
    };
  }

  if (reminder.schedule && reminder.respectReminderWindows === undefined) {
    return {
      ...reminder,
      respectReminderWindows: true,
    };
  }

  return value;
}, currentCustomReminderDefinitionSchema);

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
export type CustomReminderSchedule = z.infer<
  typeof customReminderScheduleSchema
>;
export type Weekday = z.infer<typeof weekdaySchema>;
