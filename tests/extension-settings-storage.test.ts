import { afterEach, describe, expect, it, vi } from "vitest";
import { getDefaultAppSettings } from "../src/domain/settings";
import {
  EXTENSION_SETTINGS_STORAGE_KEY,
  getDefaultExtensionSettings,
  loadExtensionSettings,
  saveExtensionSettings,
} from "../src/extension/extensionSettingsStorage";

function createChromeStorageMock(initialValue?: unknown) {
  let storedValue = initialValue;
  const storage = {
    get: vi.fn(
      (
        _key: string,
        callback: (items: Record<string, unknown>) => void,
      ) => {
        callback({ [EXTENSION_SETTINGS_STORAGE_KEY]: storedValue });
      },
    ),
    set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
      storedValue = items[EXTENSION_SETTINGS_STORAGE_KEY];
      callback?.();
    }),
  };

  return {
    runtime: {},
    storage: {
      local: storage,
    },
    getStoredValue: () => storedValue,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extension settings storage", () => {
  it("returns defaults when Chrome storage is unavailable", async () => {
    vi.stubGlobal("chrome", undefined);

    await expect(loadExtensionSettings()).resolves.toEqual(
      getDefaultExtensionSettings(),
    );
  });

  it("returns defaults when stored data is invalid", async () => {
    vi.stubGlobal(
      "chrome",
      createChromeStorageMock({
        ...getDefaultAppSettings(),
        reminderIntensity: "constant",
      }),
    );

    await expect(loadExtensionSettings()).resolves.toEqual(
      getDefaultExtensionSettings(),
    );
  });

  it("saves and loads valid settings using chrome.storage.local", async () => {
    const chromeMock = createChromeStorageMock();
    const settings = getDefaultExtensionSettings();

    settings.reminderIntensity = "active";
    settings.workdayStart = "09:00";
    settings.preferredReminderCategories = ["hydration", "stretch"];
    settings.proactiveRemindersEnabled = true;
    vi.stubGlobal("chrome", chromeMock);

    await expect(saveExtensionSettings(settings)).resolves.toBe(true);
    await expect(loadExtensionSettings()).resolves.toEqual(settings);
    expect(chromeMock.storage.local.set).toHaveBeenCalledTimes(1);
    expect(chromeMock.getStoredValue()).toEqual(settings);
  });

  it("loads legacy extension settings with proactive reminders off", async () => {
    const legacySettings = { ...getDefaultAppSettings() };

    delete (legacySettings as Partial<typeof legacySettings>).customReminders;

    vi.stubGlobal("chrome", createChromeStorageMock(legacySettings));

    await expect(loadExtensionSettings()).resolves.toEqual({
      ...legacySettings,
      proactiveRemindersEnabled: false,
      snoozedUntilByReminderId: {},
      customReminders: [],
      reminderHistory: [],
    });
  });

  it("saves and loads transient snoozed reminder timestamps", async () => {
    const chromeMock = createChromeStorageMock();
    const settings = getDefaultExtensionSettings();
    const snoozedUntil = new Date(2026, 4, 15, 11, 0);

    settings.snoozedUntilByReminderId = {
      "eye-strain": snoozedUntil,
    };
    vi.stubGlobal("chrome", chromeMock);

    await expect(saveExtensionSettings(settings)).resolves.toBe(true);
    expect(chromeMock.getStoredValue()).toMatchObject({
      snoozedUntilByReminderId: {
        "eye-strain": snoozedUntil.toISOString(),
      },
    });
    await expect(loadExtensionSettings()).resolves.toMatchObject({
      snoozedUntilByReminderId: {
        "eye-strain": snoozedUntil,
      },
    });
  });

  it("saves and loads reminder history entries", async () => {
    const chromeMock = createChromeStorageMock();
    const settings = getDefaultExtensionSettings();
    const occurredAt = new Date(2026, 4, 15, 10, 0);
    const snoozedUntil = new Date(2026, 4, 15, 11, 0);

    settings.reminderHistory = [
      {
        id: `${occurredAt.toISOString()}-eye-strain-snooze`,
        reminderId: "eye-strain",
        reminderTitle: "Eye strain",
        actionType: "snooze",
        occurredAt,
        snoozedUntil,
      },
    ];
    vi.stubGlobal("chrome", chromeMock);

    await expect(saveExtensionSettings(settings)).resolves.toBe(true);
    expect(chromeMock.getStoredValue()).toMatchObject({
      reminderHistory: [
        {
          occurredAt: occurredAt.toISOString(),
          snoozedUntil: snoozedUntil.toISOString(),
        },
      ],
    });
    await expect(loadExtensionSettings()).resolves.toMatchObject({
      reminderHistory: [
        {
          occurredAt,
          snoozedUntil,
        },
      ],
    });
  });

  it("saves and loads custom reminders", async () => {
    const chromeMock = createChromeStorageMock();
    const settings = getDefaultExtensionSettings();
    const customReminder = {
      id: "custom-123e4567-e89b-42d3-a456-426614174000",
      title: "Desk reset",
      category: "Custom",
      description: "Reset your desk and posture.",
      suggestedFrequency: "Every 25 minutes",
      enabledByDefault: true,
      wellnessIntent: "Reset your desk and posture.",
      displayPriority: 9,
      customFrequencyMinutes: 25,
    } as const;

    settings.preferredReminderCategories = [customReminder.id];
    settings.customReminders = [customReminder];
    vi.stubGlobal("chrome", chromeMock);

    await expect(saveExtensionSettings(settings)).resolves.toBe(true);
    await expect(loadExtensionSettings()).resolves.toMatchObject({
      preferredReminderCategories: [customReminder.id],
      customReminders: [customReminder],
    });
  });
});
