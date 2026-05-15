import { appSettingsSchema, type AppSettings } from "../domain/schemas";
import { getDefaultAppSettings } from "../domain/settings";

export const SETTINGS_STORAGE_KEY = "vitaloop.settings";

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

export type SettingsService = {
  loadSettings: () => AppSettings;
  saveSettings: (settings: AppSettings) => boolean;
};

function getBrowserStorage(storage?: SettingsStorage) {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

export function loadSettings(storage?: SettingsStorage): AppSettings {
  const fallbackSettings = getDefaultAppSettings();
  const availableStorage = getBrowserStorage(storage);

  if (!availableStorage) {
    return fallbackSettings;
  }

  try {
    const rawSettings = availableStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!rawSettings) {
      return fallbackSettings;
    }

    const parsedSettings: unknown = JSON.parse(rawSettings);
    const result = appSettingsSchema.safeParse(parsedSettings);

    return result.success ? result.data : fallbackSettings;
  } catch {
    return fallbackSettings;
  }
}

export function saveSettings(
  settings: AppSettings,
  storage?: SettingsStorage,
): boolean {
  const result = appSettingsSchema.safeParse(settings);

  if (!result.success) {
    return false;
  }

  const availableStorage = getBrowserStorage(storage);

  if (!availableStorage) {
    return false;
  }

  try {
    availableStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(result.data),
    );
    return true;
  } catch {
    return false;
  }
}

export const settingsService: SettingsService = {
  loadSettings,
  saveSettings,
};
