import {
  type AppSettings,
  type CustomReminderDefinition,
  type CustomReminderSchedule,
  type ReminderDefinition,
  type Weekday,
} from "./schemas";

export type CustomReminderDraft = {
  id?: CustomReminderDefinition["id"];
  title: string;
  description: string;
  category: string;
  schedule: CustomReminderSchedule;
  respectReminderWindows: boolean;
  enabled: boolean;
};

export const CUSTOM_REMINDER_TITLE_MAX_LENGTH = 48;
export const CUSTOM_REMINDER_MESSAGE_MAX_LENGTH = 120;
export const CUSTOM_REMINDER_CATEGORY_MAX_LENGTH = 32;
export const CUSTOM_REMINDER_CHARACTER_LIMIT_WARNING_THRESHOLD = 15;
export const CUSTOM_REMINDER_CHARACTER_LIMIT_NEAR_THRESHOLD = 10;

export type CustomReminderDraftField =
  | "title"
  | "description"
  | "category"
  | "intervalMinutes"
  | "dayIntervalDays"
  | "timeOfDay"
  | "weekdays"
  | "date";

export type CustomReminderDraftErrors = Partial<
  Record<CustomReminderDraftField, string>
>;

export type CharacterLimitStatus = {
  message: string;
  tone: "warning" | "near-limit";
};

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
  schedule: {
    type: "oneTime",
    date: getTomorrowDateInputValue(),
    timeOfDay: "09:00",
  },
  respectReminderWindows: true,
  enabled: true,
};

export function getCustomReminderCharacterLimitStatus(
  value: string,
  maxLength: number,
): CharacterLimitStatus | null {
  const remainingCharacters = maxLength - value.length;

  if (
    remainingCharacters > CUSTOM_REMINDER_CHARACTER_LIMIT_WARNING_THRESHOLD
  ) {
    return null;
  }

  return {
    message: `Maximum limit of characters is ${value.length}/${maxLength}`,
    tone:
      remainingCharacters <= CUSTOM_REMINDER_CHARACTER_LIMIT_NEAR_THRESHOLD
        ? "near-limit"
        : "warning",
  };
}

export function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTomorrowDateInputValue(currentDate = new Date()) {
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return formatDateInputValue(tomorrow);
}

export type CustomReminderRecommendation = {
  id: string;
  title: string;
  description: string;
  category: string;
  schedule: CustomReminderSchedule;
  priority: number;
};

export const weekdayLabels: Record<Weekday, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

export const weekdayOrder: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const customReminderRecommendations = [
  {
    id: "review-calendar",
    title: "Review calendar",
    description: "Look over upcoming meetings and plans.",
    category: "Focus",
    schedule: {
      type: "dailyInterval",
      dayIntervalDays: 1,
      timeOfDay: "08:30",
      startDate: "2026-01-01",
    },
    priority: 1,
  },
  {
    id: "pay-bills",
    title: "Pay bills",
    description: "Review upcoming bills and payments.",
    category: "Life admin",
    schedule: {
      type: "dailyInterval",
      dayIntervalDays: 15,
      timeOfDay: "09:00",
      startDate: "2026-01-01",
    },
    priority: 2,
  },
  {
    id: "take-out-trash",
    title: "Take out trash",
    description: "Check the bins before the pickup day.",
    category: "Home",
    schedule: {
      type: "weekdayInterval",
      weekdays: ["monday"],
      timeOfDay: "20:00",
    },
    priority: 3,
  },
  {
    id: "laundry",
    title: "Laundry",
    description: "Start or move a laundry load.",
    category: "Home",
    schedule: {
      type: "weekdayInterval",
      weekdays: ["saturday"],
      timeOfDay: "10:00",
    },
    priority: 4,
  },
  {
    id: "reply-messages",
    title: "Reply to messages",
    description: "Clear a small batch of pending replies.",
    category: "Focus",
    schedule: { type: "interval", intervalMinutes: 180 },
    priority: 5,
  },
  {
    id: "tidy-desk",
    title: "Tidy desk",
    description: "Reset your workspace for a few minutes.",
    category: "Focus",
    schedule: {
      type: "dailyInterval",
      dayIntervalDays: 1,
      timeOfDay: "16:30",
      startDate: "2026-01-01",
    },
    priority: 6,
  },
  {
    id: "appointment-prep",
    title: "Appointment prep",
    description: "Gather anything needed for an upcoming appointment.",
    category: "Life admin",
    schedule: {
      type: "dailyInterval",
      dayIntervalDays: 1,
      timeOfDay: "18:30",
      startDate: "2026-01-01",
    },
    priority: 7,
  },
  {
    id: "call-family",
    title: "Call family",
    description: "Check in with someone important.",
    category: "Personal",
    schedule: {
      type: "weekdayInterval",
      weekdays: ["friday"],
      timeOfDay: "18:00",
    },
    priority: 8,
  },
  {
    id: "grocery-list",
    title: "Grocery list",
    description: "Update the grocery list before the next shop.",
    category: "Home",
    schedule: {
      type: "weekdayInterval",
      weekdays: ["thursday"],
      timeOfDay: "18:00",
    },
    priority: 9,
  },
  {
    id: "plan-week",
    title: "Plan week",
    description: "Choose priorities for the week ahead.",
    category: "Focus",
    schedule: {
      type: "weekdayInterval",
      weekdays: ["monday"],
      timeOfDay: "08:00",
    },
    priority: 10,
  },
  {
    id: "clean-fridge",
    title: "Clean fridge",
    description: "Clear old items and note what needs replacing.",
    category: "Home",
    schedule: {
      type: "weekdayInterval",
      weekdays: ["saturday"],
      timeOfDay: "11:00",
    },
    priority: 11,
  },
  {
    id: "budget-review",
    title: "Budget review",
    description: "Review recent spending and upcoming expenses.",
    category: "Life admin",
    schedule: {
      type: "dailyInterval",
      dayIntervalDays: 7,
      timeOfDay: "17:00",
      startDate: "2026-01-01",
    },
    priority: 12,
  },
  {
    id: "subscription-review",
    title: "Subscription review",
    description: "Check recurring subscriptions and renewals.",
    category: "Life admin",
    schedule: {
      type: "dailyInterval",
      dayIntervalDays: 30,
      timeOfDay: "10:00",
      startDate: "2026-01-01",
    },
    priority: 13,
  },
  {
    id: "back-up-files",
    title: "Back up files",
    description: "Check that important files are backed up.",
    category: "Life admin",
    schedule: {
      type: "weekdayInterval",
      weekdays: ["sunday"],
      timeOfDay: "11:00",
    },
    priority: 14,
  },
  {
    id: "charge-devices",
    title: "Charge devices",
    description: "Plug in devices needed for tomorrow.",
    category: "Routine",
    schedule: {
      type: "dailyInterval",
      dayIntervalDays: 1,
      timeOfDay: "21:30",
      startDate: "2026-01-01",
    },
    priority: 15,
  },
  {
    id: "check-mailbox",
    title: "Check mailbox",
    description: "Look for mail, notices, or deliveries.",
    category: "Home",
    schedule: {
      type: "weekdayInterval",
      weekdays: ["tuesday", "friday"],
      timeOfDay: "17:30",
    },
    priority: 16,
  },
  {
    id: "return-items",
    title: "Return items",
    description: "Handle items that need to be returned or exchanged.",
    category: "Life admin",
    schedule: {
      type: "weekdayInterval",
      weekdays: ["saturday"],
      timeOfDay: "12:00",
    },
    priority: 17,
  },
  {
    id: "car-maintenance",
    title: "Car maintenance",
    description: "Check fuel, charge, tire pressure, or service needs.",
    category: "Life admin",
    schedule: {
      type: "dailyInterval",
      dayIntervalDays: 30,
      timeOfDay: "09:00",
      startDate: "2026-01-01",
    },
    priority: 18,
  },
  {
    id: "air-filter",
    title: "Air filter",
    description: "Check whether the home air filter needs replacing.",
    category: "Life admin",
    schedule: {
      type: "dailyInterval",
      dayIntervalDays: 60,
      timeOfDay: "10:00",
      startDate: "2026-01-01",
    },
    priority: 19,
  },
  {
    id: "reading-time",
    title: "Reading time",
    description: "Set aside a focused reading session.",
    category: "Personal",
    schedule: {
      type: "dailyInterval",
      dayIntervalDays: 1,
      timeOfDay: "20:00",
      startDate: "2026-01-01",
    },
    priority: 20,
  },
] satisfies CustomReminderRecommendation[];

export function createDefaultCustomReminderSchedule(
  type: CustomReminderSchedule["type"],
  currentDate = new Date(),
): CustomReminderSchedule {
  if (type === "interval") {
    return {
      type: "interval",
      intervalMinutes: 60,
    };
  }

  if (type === "dailyInterval") {
    return {
      type: "dailyInterval",
      dayIntervalDays: 1,
      timeOfDay: "09:00",
      startDate: formatDateInputValue(currentDate),
    };
  }

  if (type === "weekdayInterval") {
    return {
      type: "weekdayInterval",
      weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      timeOfDay: "09:00",
    };
  }

  return {
    type: "oneTime",
    date: getTomorrowDateInputValue(currentDate),
    timeOfDay: "09:00",
  };
}

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

function getRandomItem<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

function shuffleItems<T>(items: T[], random: () => number) {
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(random() * (index + 1));
    [shuffledItems[index], shuffledItems[targetIndex]] = [
      shuffledItems[targetIndex],
      shuffledItems[index],
    ];
  }

  return shuffledItems;
}

export function getRecommendedCustomReminders(random = Math.random) {
  const topTenRecommendations = customReminderRecommendations.filter(
    (recommendation) => recommendation.priority <= 10,
  );
  const requiredRecommendation = getRandomItem(topTenRecommendations, random);
  const remainingRecommendations = customReminderRecommendations.filter(
    (recommendation) => recommendation.id !== requiredRecommendation.id,
  );

  return [
    requiredRecommendation,
    ...shuffleItems(remainingRecommendations, random).slice(0, 2),
  ];
}

export function getCustomReminderDraftFromRecommendation(
  recommendation: CustomReminderRecommendation,
  currentDate = new Date(),
): CustomReminderDraft {
  const schedule =
    recommendation.schedule.type === "dailyInterval"
      ? {
          ...recommendation.schedule,
          startDate: formatDateInputValue(currentDate),
        }
      : recommendation.schedule;

  return {
    ...defaultCustomReminderDraft,
    title: recommendation.title,
    description: recommendation.description,
    category: recommendation.category,
    schedule: { ...schedule },
  };
}

function isTimeOfDay(timeOfDay: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(timeOfDay);
}

function isDateOnly(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);

  return (
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day
  );
}

function createDateTime(date: string, timeOfDay: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = timeOfDay.split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes);
}

function normalizeWeekdays(weekdays: Weekday[]) {
  return weekdayOrder.filter((weekday) => weekdays.includes(weekday));
}

function normalizeCustomReminderSchedule(
  schedule: CustomReminderSchedule,
): CustomReminderSchedule {
  if (schedule.type === "interval") {
    return {
      type: "interval",
      intervalMinutes: Number(schedule.intervalMinutes),
    };
  }

  if (schedule.type === "dailyInterval") {
    return {
      type: "dailyInterval",
      dayIntervalDays: Number(schedule.dayIntervalDays),
      timeOfDay: schedule.timeOfDay,
      startDate: schedule.startDate,
    };
  }

  if (schedule.type === "weekdayInterval") {
    return {
      type: "weekdayInterval",
      weekdays: normalizeWeekdays(schedule.weekdays),
      timeOfDay: schedule.timeOfDay,
    };
  }

  return {
    type: "oneTime",
    date: schedule.date,
    timeOfDay: schedule.timeOfDay,
  };
}

export function normalizeCustomReminderDraft(
  draft: CustomReminderDraft,
): CustomReminderDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    description: draft.description.trim(),
    category: draft.category.trim() || "Custom",
    schedule: normalizeCustomReminderSchedule(draft.schedule),
  };
}

export function validateCustomReminderDraft(
  draft: CustomReminderDraft,
  currentDate = new Date(),
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

  if (normalizedDraft.schedule.type === "interval") {
    if (
      !Number.isFinite(normalizedDraft.schedule.intervalMinutes) ||
      !Number.isInteger(normalizedDraft.schedule.intervalMinutes) ||
      normalizedDraft.schedule.intervalMinutes < 5 ||
      normalizedDraft.schedule.intervalMinutes > 1440
    ) {
      errors.intervalMinutes = "Use a whole number from 5 to 1440.";
    }
  }

  if (normalizedDraft.schedule.type === "dailyInterval") {
    if (
      !Number.isFinite(normalizedDraft.schedule.dayIntervalDays) ||
      !Number.isInteger(normalizedDraft.schedule.dayIntervalDays) ||
      normalizedDraft.schedule.dayIntervalDays < 1 ||
      normalizedDraft.schedule.dayIntervalDays > 365
    ) {
      errors.dayIntervalDays = "Use a whole number from 1 to 365.";
    }

    if (!isTimeOfDay(normalizedDraft.schedule.timeOfDay)) {
      errors.timeOfDay = "Use 24-hour HH:MM time.";
    }

    if (!isDateOnly(normalizedDraft.schedule.startDate)) {
      errors.date = "Use a valid date.";
    }
  }

  if (normalizedDraft.schedule.type === "weekdayInterval") {
    if (normalizedDraft.schedule.weekdays.length === 0) {
      errors.weekdays = "Choose at least one weekday.";
    }

    if (!isTimeOfDay(normalizedDraft.schedule.timeOfDay)) {
      errors.timeOfDay = "Use 24-hour HH:MM time.";
    }
  }

  if (normalizedDraft.schedule.type === "oneTime") {
    if (!isDateOnly(normalizedDraft.schedule.date)) {
      errors.date = "Use a valid date.";
    } else if (
      isTimeOfDay(normalizedDraft.schedule.timeOfDay) &&
      Number(
        createDateTime(
          normalizedDraft.schedule.date,
          normalizedDraft.schedule.timeOfDay,
        ),
      ) <= Number(currentDate)
    ) {
      errors.date = "Choose a future date and time.";
    }

    if (!isTimeOfDay(normalizedDraft.schedule.timeOfDay)) {
      errors.timeOfDay = "Use 24-hour HH:MM time.";
    }
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
  currentDate,
}: {
  draft: CustomReminderDraft;
  displayPriority: number;
  currentDate?: Date;
}): CustomReminderDefinition {
  const validationResult = validateCustomReminderDraft(draft, currentDate);

  if (!validationResult.success) {
    throw new Error("Invalid custom reminder draft.");
  }

  const normalizedDraft = validationResult.draft;

  return {
    id: normalizedDraft.id ?? createCustomReminderId(),
    title: normalizedDraft.title,
    category: normalizedDraft.category,
    description: normalizedDraft.description,
    suggestedFrequency: formatCustomReminderSchedule(normalizedDraft.schedule),
    enabledByDefault: normalizedDraft.enabled,
    wellnessIntent: normalizedDraft.description,
    displayPriority,
    schedule: normalizedDraft.schedule,
    respectReminderWindows: normalizedDraft.respectReminderWindows,
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
    schedule: { ...reminder.schedule },
    respectReminderWindows: reminder.respectReminderWindows,
    enabled,
  };
}

function formatTimeOfDay(timeOfDay: string) {
  const [hours, minutes] = timeOfDay.split(":").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hours, minutes));
}

function formatDateOnly(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatWeekdays(weekdays: Weekday[]) {
  const labels = normalizeWeekdays(weekdays).map((weekday) => weekdayLabels[weekday]);

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

export function formatCustomReminderSchedule(
  schedule: CustomReminderSchedule,
) {
  if (schedule.type === "interval") {
    return `Every ${schedule.intervalMinutes} minutes`;
  }

  if (schedule.type === "dailyInterval") {
    return `Every ${schedule.dayIntervalDays} day${
      schedule.dayIntervalDays === 1 ? "" : "s"
    } at ${formatTimeOfDay(schedule.timeOfDay)}`;
  }

  if (schedule.type === "weekdayInterval") {
    return `${formatWeekdays(schedule.weekdays)} at ${formatTimeOfDay(
      schedule.timeOfDay,
    )}`;
  }

  return `${formatDateOnly(schedule.date)} at ${formatTimeOfDay(
    schedule.timeOfDay,
  )}`;
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
