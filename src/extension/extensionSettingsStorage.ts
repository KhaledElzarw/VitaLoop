import { z } from "zod";
import { appSettingsSchema } from "../domain/schemas";
import { getDefaultAppSettings } from "../domain/settings";

export const EXTENSION_SETTINGS_STORAGE_KEY = "vitaloop.extension.settings";

export const extensionSettingsSchema = appSettingsSchema.extend({
  proactiveRemindersEnabled: z.boolean().default(false),
});

export type ExtensionSettings = z.infer<typeof extensionSettingsSchema>;

type ChromeRuntime = {
  lastError?: {
    message?: string;
  };
};

type ChromeStorageLocal = {
  get: (
    key: string,
    callback: (items: Record<string, unknown>) => void,
  ) => void;
  set: (items: Record<string, unknown>, callback?: () => void) => void;
};

type ChromeApi = {
  runtime?: ChromeRuntime;
  storage?: {
    local?: ChromeStorageLocal;
  };
};

function getChromeApi() {
  return (globalThis as typeof globalThis & { chrome?: ChromeApi }).chrome;
}

function getChromeStorageLocal() {
  return getChromeApi()?.storage?.local ?? null;
}

function getRuntimeErrorMessage() {
  return getChromeApi()?.runtime?.lastError?.message;
}

export function getDefaultExtensionSettings(): ExtensionSettings {
  return {
    ...getDefaultAppSettings(),
    proactiveRemindersEnabled: false,
  };
}

function cloneExtensionSettings(settings: ExtensionSettings): ExtensionSettings {
  return {
    ...settings,
    preferredReminderCategories: [...settings.preferredReminderCategories],
  };
}

function getStoredItems(storage: ChromeStorageLocal) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    try {
      storage.get(EXTENSION_SETTINGS_STORAGE_KEY, (items) => {
        const errorMessage = getRuntimeErrorMessage();

        if (errorMessage) {
          reject(new Error(errorMessage));
          return;
        }

        resolve(items);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function setStoredSettings(
  storage: ChromeStorageLocal,
  settings: ExtensionSettings,
) {
  return new Promise<void>((resolve, reject) => {
    try {
      storage.set(
        {
          [EXTENSION_SETTINGS_STORAGE_KEY]: cloneExtensionSettings(settings),
        },
        () => {
          const errorMessage = getRuntimeErrorMessage();

          if (errorMessage) {
            reject(new Error(errorMessage));
            return;
          }

          resolve();
        },
      );
    } catch (error) {
      reject(error);
    }
  });
}

export async function loadExtensionSettings(): Promise<ExtensionSettings> {
  const storage = getChromeStorageLocal();

  if (!storage) {
    return getDefaultExtensionSettings();
  }

  try {
    const items = await getStoredItems(storage);
    const result = extensionSettingsSchema.safeParse(
      items[EXTENSION_SETTINGS_STORAGE_KEY],
    );

    return result.success
      ? cloneExtensionSettings(result.data)
      : getDefaultExtensionSettings();
  } catch {
    return getDefaultExtensionSettings();
  }
}

export async function saveExtensionSettings(
  settings: ExtensionSettings,
): Promise<boolean> {
  const result = extensionSettingsSchema.safeParse(settings);
  const storage = getChromeStorageLocal();

  if (!result.success || !storage) {
    return false;
  }

  try {
    await setStoredSettings(storage, result.data);
    return true;
  } catch {
    return false;
  }
}

export const extensionSettingsStorage = {
  loadSettings: loadExtensionSettings,
  saveSettings: saveExtensionSettings,
};

export type ExtensionSettingsStorage = typeof extensionSettingsStorage;
