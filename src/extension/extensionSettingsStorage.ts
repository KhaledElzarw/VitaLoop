import { z } from "zod";
import {
  cloneReminderHistory,
  reminderHistoryEntrySchema,
  type ReminderHistoryEntry,
} from "../domain/reminderHistory";
import { type ReminderActionState } from "../domain/reminderActions";
import { appSettingsSchema, reminderIdSchema } from "../domain/schemas";
import { getDefaultAppSettings } from "../domain/settings";

export const EXTENSION_SETTINGS_STORAGE_KEY = "vitaloop.extension.settings";

const snoozedUntilByReminderIdSchema = z.partialRecord(
  reminderIdSchema,
  z.coerce.date(),
);

export const extensionSettingsSchema = appSettingsSchema.extend({
  proactiveRemindersEnabled: z.boolean().default(false),
  snoozedUntilByReminderId: snoozedUntilByReminderIdSchema.default({}),
  reminderHistory: reminderHistoryEntrySchema.array().default([]),
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
    snoozedUntilByReminderId: {},
    reminderHistory: [],
  };
}

function cloneExtensionSettings(settings: ExtensionSettings): ExtensionSettings {
  return {
    ...settings,
    preferredReminderCategories: [...settings.preferredReminderCategories],
    customReminders: settings.customReminders.map((reminder) => ({
      ...reminder,
    })),
    snoozedUntilByReminderId: cloneSnoozedReminders(
      settings.snoozedUntilByReminderId,
    ),
    reminderHistory: cloneReminderHistory(settings.reminderHistory),
  };
}

function cloneSnoozedReminders(
  snoozedUntilByReminderId: ExtensionSettings["snoozedUntilByReminderId"],
) {
  const clonedSnoozes: ExtensionSettings["snoozedUntilByReminderId"] = {};

  for (const [reminderId, snoozedUntil] of Object.entries(
    snoozedUntilByReminderId,
  )) {
    if (snoozedUntil) {
      const typedReminderId =
        reminderId as keyof ExtensionSettings["snoozedUntilByReminderId"];

      clonedSnoozes[typedReminderId] = new Date(snoozedUntil);
    }
  }

  return clonedSnoozes;
}

function serializeSnoozedReminders(
  snoozedUntilByReminderId: ExtensionSettings["snoozedUntilByReminderId"],
) {
  const serializedSnoozes: Record<string, string> = {};

  for (const [reminderId, snoozedUntil] of Object.entries(
    snoozedUntilByReminderId,
  )) {
    if (snoozedUntil) {
      serializedSnoozes[reminderId] = snoozedUntil.toISOString();
    }
  }

  return serializedSnoozes;
}

function serializeExtensionSettings(settings: ExtensionSettings) {
  return {
    ...cloneExtensionSettings(settings),
    snoozedUntilByReminderId: serializeSnoozedReminders(
      settings.snoozedUntilByReminderId,
    ),
    reminderHistory: serializeReminderHistory(settings.reminderHistory),
  };
}

function serializeReminderHistory(history: ReminderHistoryEntry[]) {
  return history.map((entry) => ({
    ...entry,
    occurredAt: entry.occurredAt.toISOString(),
    snoozedUntil: entry.snoozedUntil?.toISOString(),
  }));
}

export function getExtensionReminderActionState(
  settings: ExtensionSettings,
): ReminderActionState {
  return {
    doneReminderIds: [],
    skippedReminderIds: [],
    snoozedUntilByReminderId: cloneSnoozedReminders(
      settings.snoozedUntilByReminderId,
    ),
  };
}

export function withExtensionReminderActionState(
  settings: ExtensionSettings,
  actionState: ReminderActionState,
): ExtensionSettings {
  return cloneExtensionSettings({
    ...settings,
    snoozedUntilByReminderId: actionState.snoozedUntilByReminderId,
  });
}

export function withExtensionReminderHistory(
  settings: ExtensionSettings,
  reminderHistory: ReminderHistoryEntry[],
): ExtensionSettings {
  return cloneExtensionSettings({
    ...settings,
    reminderHistory,
  });
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
          [EXTENSION_SETTINGS_STORAGE_KEY]: serializeExtensionSettings(settings),
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
