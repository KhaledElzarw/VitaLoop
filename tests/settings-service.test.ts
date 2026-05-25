import { describe, expect, it, vi } from "vitest";
import { getDefaultAppSettings } from "../src/domain/settings";
import {
  loadSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
} from "../src/services/settingsService";

function createMemoryStorage(initialValue?: string) {
  const values = new Map<string, string>();

  if (initialValue !== undefined) {
    values.set(SETTINGS_STORAGE_KEY, initialValue);
  }

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

describe("settings service", () => {
  it("returns defaults when storage is empty", () => {
    expect(loadSettings(createMemoryStorage())).toEqual(getDefaultAppSettings());
  });

  it("returns defaults when stored data is invalid", () => {
    const storage = createMemoryStorage(
      JSON.stringify({
        ...getDefaultAppSettings(),
        reminderIntensity: "constant",
      }),
    );

    expect(loadSettings(storage)).toEqual(getDefaultAppSettings());
  });

  it("saves and reloads valid settings", () => {
    const storage = createMemoryStorage();
    const settings = getDefaultAppSettings();

    settings.reminderIntensity = "active";
    settings.quietHoursStart = "22:00";
    settings.preferredReminderCategories = ["hydration", "stretch"];

    expect(saveSettings(settings, storage)).toBe(true);
    expect(loadSettings(storage)).toEqual(settings);
  });

  it("saves and reloads custom reminders", () => {
    const storage = createMemoryStorage();
    const customReminder = {
      id: "custom-123e4567-e89b-42d3-a456-426614174000",
      title: "Desk reset",
      category: "Custom",
      description: "Reset your desk and posture.",
      suggestedFrequency: "Every 25 minutes",
      enabledByDefault: true,
      wellnessIntent: "Reset your desk and posture.",
      displayPriority: 9,
      schedule: {
        type: "interval",
        intervalMinutes: 25,
      },
      respectReminderWindows: true,
    } as const;
    const settings = {
      ...getDefaultAppSettings(),
      preferredReminderCategories: [customReminder.id],
      customReminders: [customReminder],
    };

    expect(saveSettings(settings, storage)).toBe(true);
    expect(loadSettings(storage)).toEqual(settings);
  });
});
