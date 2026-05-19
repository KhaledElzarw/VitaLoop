import {
  cloneReminderHistory,
  reminderHistoryEntrySchema,
  type ReminderHistoryEntry,
} from "../domain/reminderHistory";

export const REMINDER_HISTORY_STORAGE_KEY = "vitaloop.reminderHistory";

type ReminderHistoryStorage = Pick<Storage, "getItem" | "setItem">;

export type ReminderHistoryService = {
  loadReminderHistory: () => ReminderHistoryEntry[];
  saveReminderHistory: (history: ReminderHistoryEntry[]) => boolean;
};

function getBrowserStorage(storage?: ReminderHistoryStorage) {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function serializeReminderHistory(history: ReminderHistoryEntry[]) {
  return history.map((entry) => ({
    ...entry,
    occurredAt: entry.occurredAt.toISOString(),
    snoozedUntil: entry.snoozedUntil?.toISOString(),
  }));
}

export function loadReminderHistory(
  storage?: ReminderHistoryStorage,
): ReminderHistoryEntry[] {
  const availableStorage = getBrowserStorage(storage);

  if (!availableStorage) {
    return [];
  }

  try {
    const rawHistory = availableStorage.getItem(REMINDER_HISTORY_STORAGE_KEY);

    if (!rawHistory) {
      return [];
    }

    const parsedHistory: unknown = JSON.parse(rawHistory);
    const result = reminderHistoryEntrySchema.array().safeParse(parsedHistory);

    return result.success ? cloneReminderHistory(result.data) : [];
  } catch {
    return [];
  }
}

export function saveReminderHistory(
  history: ReminderHistoryEntry[],
  storage?: ReminderHistoryStorage,
): boolean {
  const result = reminderHistoryEntrySchema.array().safeParse(history);
  const availableStorage = getBrowserStorage(storage);

  if (!result.success || !availableStorage) {
    return false;
  }

  try {
    availableStorage.setItem(
      REMINDER_HISTORY_STORAGE_KEY,
      JSON.stringify(serializeReminderHistory(result.data)),
    );
    return true;
  } catch {
    return false;
  }
}

export const reminderHistoryService: ReminderHistoryService = {
  loadReminderHistory,
  saveReminderHistory,
};
