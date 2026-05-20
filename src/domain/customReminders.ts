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

export const CUSTOM_REMINDER_TITLE_MAX_LENGTH = 48;
export const CUSTOM_REMINDER_MESSAGE_MAX_LENGTH = 120;
export const CUSTOM_REMINDER_CATEGORY_MAX_LENGTH = 32;

export type CustomReminderDraftField =
  | "title"
  | "description"
  | "category"
  | "frequencyMinutes";

export type CustomReminderDraftErrors = Partial<
  Record<CustomReminderDraftField, string>
>;

export type CustomReminderDraftValidationResult =
  | {
      success: true;
      draft: CustomReminderDraft;
      errors: CustomReminderDraftErrors;
    }
  | {
      success: false;
      errors: CustomReminderDraftErrors;
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

export function normalizeCustomReminderDraft(
  draft: CustomReminderDraft,
): CustomReminderDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    description: draft.description.trim(),
    category: draft.category.trim() || "Custom",
  };
}

export function validateCustomReminderDraft(
  draft: CustomReminderDraft,
): CustomReminderDraftValidationResult {
  const normalizedDraft = normalizeCustomReminderDraft(draft);
  const errors: CustomReminderDraftErrors = {};

  if (!normalizedDraft.title) {
    errors.title = "Enter a title.";
  } else if (normalizedDraft.title.length > CUSTOM_REMINDER_TITLE_MAX_LENGTH) {
    errors.title = `Keep the title to ${CUSTOM_REMINDER_TITLE_MAX_LENGTH} characters or fewer.`;
  }

  if (!normalizedDraft.description) {
    errors.description = "Enter a message.";
  } else if (
    normalizedDraft.description.length > CUSTOM_REMINDER_MESSAGE_MAX_LENGTH
  ) {
    errors.description = `Keep the message to ${CUSTOM_REMINDER_MESSAGE_MAX_LENGTH} characters or fewer.`;
  }

  if (normalizedDraft.category.length > CUSTOM_REMINDER_CATEGORY_MAX_LENGTH) {
    errors.category = `Keep the category to ${CUSTOM_REMINDER_CATEGORY_MAX_LENGTH} characters or fewer.`;
  }

  if (
    !Number.isFinite(normalizedDraft.frequencyMinutes) ||
    !Number.isInteger(normalizedDraft.frequencyMinutes) ||
    normalizedDraft.frequencyMinutes < 5 ||
    normalizedDraft.frequencyMinutes > 1440
  ) {
    errors.frequencyMinutes = "Use a whole number from 5 to 1440.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    draft: normalizedDraft,
    errors: {},
  };
}

export function createCustomReminderDefinition({
  draft,
  displayPriority,
}: {
  draft: CustomReminderDraft;
  displayPriority: number;
}): CustomReminderDefinition {
  const validationResult = validateCustomReminderDraft(draft);

  if (!validationResult.success) {
    throw new Error("Invalid custom reminder draft.");
  }

  const normalizedDraft = validationResult.draft;

  return {
    id: normalizedDraft.id ?? createCustomReminderId(),
    title: normalizedDraft.title,
    category: normalizedDraft.category,
    description: normalizedDraft.description,
    suggestedFrequency: `Every ${normalizedDraft.frequencyMinutes} minutes`,
    enabledByDefault: normalizedDraft.enabled,
    wellnessIntent: normalizedDraft.description,
    displayPriority,
    customFrequencyMinutes: normalizedDraft.frequencyMinutes,
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
