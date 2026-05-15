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
});
