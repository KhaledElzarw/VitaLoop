import { type AppSettings } from "./schemas";

export const defaultAppSettings: AppSettings = {
  timezone: "UTC",
  quietHoursEnabled: true,
  quietHoursStart: "21:30",
  quietHoursEnd: "07:00",
  reminderIntensity: "balanced",
  workdayStart: "08:30",
  workdayEnd: "18:00",
  preferredReminderCategories: [
    "hydration",
    "eye-strain",
    "stretch",
    "stand-walk",
  ],
  customReminders: [],
};

export function getDefaultAppSettings(): AppSettings {
  return {
    ...defaultAppSettings,
    preferredReminderCategories: [
      ...defaultAppSettings.preferredReminderCategories,
    ],
    customReminders: [],
  };
}
