import {
  type AppSettings,
  type CustomReminderDefinition,
  type ReminderDefinition,
} from "./schemas";

export type CustomReminderDraft = {
  id?: CustomReminderDefinition["id"];
  title: string;
  description: string;
  category: string;
  frequencyMinutes: number;
  enabled: boolean;
};

export const defaultCustomReminderDraft: CustomReminderDraft = {
  title: "",
  description: "",
  category: "Custom",
  frequencyMinutes: 60,
  enabled: true,
};

function createUuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return "00000000-0000-4000-8000-000000000000".replaceAll("0", () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

export function createCustomReminderId(): CustomReminderDefinition["id"] {
  return `custom-${createUuid()}`;
}

export function getReminderListWithCustomReminders(
  reminderList: ReminderDefinition[],
  settings: Pick<AppSettings, "customReminders">,
) {
  return [...reminderList, ...settings.customReminders].sort(
    (first, second) => first.displayPriority - second.displayPriority,
  );
}

export function createCustomReminderDefinition({
  draft,
  displayPriority,
}: {
  draft: CustomReminderDraft;
  displayPriority: number;
}): CustomReminderDefinition {
  const title = draft.title.trim();
  const description = draft.description.trim();
  const category = draft.category.trim() || "Custom";

  return {
    id: draft.id ?? createCustomReminderId(),
    title,
    category,
    description,
    suggestedFrequency: `Every ${draft.frequencyMinutes} minutes`,
    enabledByDefault: draft.enabled,
    wellnessIntent: description,
    displayPriority,
    customFrequencyMinutes: draft.frequencyMinutes,
  };
}

export function getCustomReminderDraft(
  reminder: CustomReminderDefinition,
  enabled: boolean,
): CustomReminderDraft {
  return {
    id: reminder.id,
    title: reminder.title,
    description: reminder.description,
    category: reminder.category,
    frequencyMinutes: reminder.customFrequencyMinutes,
    enabled,
  };
}

export function upsertCustomReminderSettings({
  settings,
  reminder,
  enabled,
}: {
  settings: AppSettings;
  reminder: CustomReminderDefinition;
  enabled: boolean;
}): AppSettings {
  const customReminders = settings.customReminders.some(
    (candidate) => candidate.id === reminder.id,
  )
    ? settings.customReminders.map((candidate) =>
        candidate.id === reminder.id ? reminder : candidate,
      )
    : [...settings.customReminders, reminder];
  const preferredReminderCategories = enabled
    ? [
        ...settings.preferredReminderCategories.filter(
          (reminderId) => reminderId !== reminder.id,
        ),
        reminder.id,
      ]
    : settings.preferredReminderCategories.filter(
        (reminderId) => reminderId !== reminder.id,
      );

  return {
    ...settings,
    customReminders,
    preferredReminderCategories:
      preferredReminderCategories.length > 0
        ? preferredReminderCategories
        : ["hydration"],
  };
}

export function upsertCustomReminderSettingsFor<
  Settings extends AppSettings,
>({
  settings,
  reminder,
  enabled,
}: {
  settings: Settings;
  reminder: CustomReminderDefinition;
  enabled: boolean;
}): Settings {
  return upsertCustomReminderSettings({
    settings,
    reminder,
    enabled,
  }) as Settings;
}

export function deleteCustomReminderSettings(
  settings: AppSettings,
  reminderId: AppSettings["preferredReminderCategories"][number],
): AppSettings {
  const preferredReminderCategories =
    settings.preferredReminderCategories.filter(
      (candidateId) => candidateId !== reminderId,
    );

  return {
    ...settings,
    customReminders: settings.customReminders.filter(
      (reminder) => reminder.id !== reminderId,
    ),
    preferredReminderCategories:
      preferredReminderCategories.length > 0
        ? preferredReminderCategories
        : ["hydration"],
  };
}

export function deleteCustomReminderSettingsFor<Settings extends AppSettings>(
  settings: Settings,
  reminderId: AppSettings["preferredReminderCategories"][number],
): Settings {
  const nextSettings = deleteCustomReminderSettings(settings, reminderId);

  if (!("snoozedUntilByReminderId" in settings)) {
    return nextSettings as Settings;
  }

  const snoozedUntilByReminderId = {
    ...(settings as Settings & {
      snoozedUntilByReminderId: Record<string, Date | undefined>;
    }).snoozedUntilByReminderId,
  };

  delete snoozedUntilByReminderId[reminderId];

  return {
    ...nextSettings,
    snoozedUntilByReminderId,
  } as unknown as Settings;
}
