import { useEffect, useRef, useState } from "react";
import { reminders as defaultReminders } from "../data/reminders";
import {
  CUSTOM_REMINDER_CATEGORY_MAX_LENGTH,
  CUSTOM_REMINDER_MESSAGE_MAX_LENGTH,
  CUSTOM_REMINDER_TITLE_MAX_LENGTH,
  createCustomReminderDefinition,
  createDefaultCustomReminderSchedule,
  defaultCustomReminderDraft,
  deleteCustomReminderSettingsFor,
  formatCustomReminderSchedule,
  formatDateInputValue,
  getCustomReminderDraft,
  getCustomReminderDraftFromRecommendation,
  getCustomReminderCharacterLimitStatus,
  getRecommendedCustomReminders,
  getReminderListWithCustomReminders,
  upsertCustomReminderSettingsFor,
  validateCustomReminderDraft,
  weekdayLabels,
  weekdayOrder,
  type CustomReminderDraft,
  type CustomReminderDraftErrors,
  type CharacterLimitStatus,
} from "../domain/customReminders";
import { removeReminderHistoryEntriesForDate } from "../domain/reminderHistory";
import {
  type CustomReminderSchedule,
  type ReminderDefinition,
  type Weekday,
} from "../domain/schemas";
import {
  createReminderNotificationCopy,
  REMINDER_NOTIFICATION_BUTTONS,
  VITALOOP_NOTIFICATION_ICON_URL,
} from "./notificationCopy";
import {
  extensionSettingsStorage,
  getDefaultExtensionSettings,
  type ExtensionSettings,
  type ExtensionSettingsStorage,
} from "./extensionSettingsStorage";

const reminderIntensityOptions = [
  { value: "gentle", label: "Gentle" },
  { value: "balanced", label: "Balanced" },
  { value: "active", label: "Active" },
] as const;

const customReminderScheduleOptions = [
  {
    value: "oneTime",
    label: "Remind me once",
    description: "Set a single date and time",
    isPopular: false,
  },
  {
    value: "weekdayInterval",
    label: "Weekday Routines",
    description: "Repeat on specific weekdays",
    isPopular: true,
  },
  {
    value: "interval",
    label: "Micro Loops",
    description: "Repeat every X minutes",
    isPopular: false,
  },
  {
    value: "dailyInterval",
    label: "Daily-ish",
    description: "Repeat every X days",
    isPopular: false,
  },
] as const;

type ReminderId = ExtensionSettings["preferredReminderCategories"][number];
type OptionsPanelId =
  | "general"
  | "reminders";
type OneTimeCustomReminderSchedule = Extract<
  CustomReminderSchedule,
  { type: "oneTime" }
>;
type OptionsStatus =
  | "idle"
  | "saved"
  | "reset"
  | "progress-reset"
  | "error"
  | "category-required"
  | "test-pending"
  | "test-sent"
  | "test-unavailable"
  | "custom-error"
  | "custom-removed";

type NotificationPermissionLevel = "granted" | "denied";

type ChromeNotificationOptions = {
  type: "basic";
  iconUrl: string;
  title: string;
  message: string;
  contextMessage: string;
  requireInteraction: boolean;
  buttons?: ChromeNotificationButton[];
};

type ChromeNotificationButton = {
  title: string;
};

type ChromeOptionsApi = {
  notifications?: {
    create: (
      notificationId: string,
      options: ChromeNotificationOptions,
      callback?: (notificationId?: string) => void,
    ) => void | Promise<string>;
    getPermissionLevel?: (
      callback: (permissionLevel: NotificationPermissionLevel) => void,
    ) => void;
  };
  runtime?: {
    getURL?: (path: string) => string;
    lastError?: {
      message?: string;
    };
  };
};

type ExtensionOptionsProps = {
  storage?: ExtensionSettingsStorage;
  reminderList?: ReminderDefinition[];
  currentDate?: Date;
};

const TEST_NOTIFICATION_ID = "vitaloop-test-notification";
const PERMISSION_CHECK_TIMEOUT_MS = 1_500;
const NOTIFICATION_CREATE_TIMEOUT_MS = 3_000;

type BrowserNotificationApi = typeof Notification;

function getChromeApi() {
  return (globalThis as typeof globalThis & { chrome?: ChromeOptionsApi })
    .chrome;
}

function getRuntimeErrorMessage() {
  return getChromeApi()?.runtime?.lastError?.message;
}

function getExtensionNotificationIconUrl() {
  return (
    getChromeApi()?.runtime?.getURL?.(VITALOOP_NOTIFICATION_ICON_URL) ??
    VITALOOP_NOTIFICATION_ICON_URL
  );
}

function getBrowserNotificationApi() {
  return (
    globalThis as typeof globalThis & {
      Notification?: BrowserNotificationApi;
    }
  ).Notification;
}

function getTestNotificationId() {
  return `${TEST_NOTIFICATION_ID}-${Date.now()}`;
}

function createNotificationButtons(): ChromeNotificationButton[] {
  return REMINDER_NOTIFICATION_BUTTONS.map(({ title }) => ({ title }));
}

function getTestReminder(reminderList: ReminderDefinition[]) {
  return (
    reminderList.find((reminder) => reminder.id === "eye-strain") ??
    reminderList[0]
  );
}

function getCharacterLimitHintClassName(status: CharacterLimitStatus) {
  return status.tone === "near-limit"
    ? "extension-character-limit-hint extension-character-limit-hint-danger"
    : "extension-character-limit-hint";
}

function OptionsIcon({ label }: { label: string }) {
  return (
    <span className="extension-nav-icon" aria-hidden="true">
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function ExtensionOptions({
  storage = extensionSettingsStorage,
  reminderList = defaultReminders,
  currentDate,
}: ExtensionOptionsProps) {
  const [settings, setSettings] = useState<ExtensionSettings>(() =>
    getDefaultExtensionSettings(),
  );
  const [status, setStatus] = useState<OptionsStatus>("idle");
  const [activeOptionsPanel, setActiveOptionsPanel] =
    useState<OptionsPanelId>("general");
  const [testNotificationMessage, setTestNotificationMessage] = useState("");
  const [customDraft, setCustomDraft] = useState<CustomReminderDraft>({
    ...defaultCustomReminderDraft,
  });
  const [isCustomReminderWizardOpen, setIsCustomReminderWizardOpen] =
    useState(false);
  const [customRecommendations, setCustomRecommendations] = useState(() =>
    getRecommendedCustomReminders(),
  );
  const [customDraftErrors, setCustomDraftErrors] =
    useState<CustomReminderDraftErrors>({});
  const [pendingDeleteCustomReminderId, setPendingDeleteCustomReminderId] =
    useState<ReminderId | null>(null);
  const isSendingTestNotificationRef = useRef(false);
  const isTestNotificationPending = status === "test-pending";
  const allReminders = getReminderListWithCustomReminders(
    reminderList,
    settings,
  );
  const reminderCategories = reminderList;
  const titleLimitStatus = getCustomReminderCharacterLimitStatus(
    customDraft.title,
    CUSTOM_REMINDER_TITLE_MAX_LENGTH,
  );
  const categoryLimitStatus = getCustomReminderCharacterLimitStatus(
    customDraft.category,
    CUSTOM_REMINDER_CATEGORY_MAX_LENGTH,
  );
  const messageLimitStatus = getCustomReminderCharacterLimitStatus(
    customDraft.description,
    CUSTOM_REMINDER_MESSAGE_MAX_LENGTH,
  );
  const titleDescriptionIds = [
    titleLimitStatus ? "extension-custom-reminder-title-limit" : "",
    customDraftErrors.title ? "extension-custom-reminder-title-error" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const categoryDescriptionIds = [
    categoryLimitStatus ? "extension-custom-reminder-category-limit" : "",
    customDraftErrors.category ? "extension-custom-reminder-category-error" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const messageDescriptionIds = [
    messageLimitStatus ? "extension-custom-reminder-message-limit" : "",
    customDraftErrors.description
      ? "extension-custom-reminder-message-error"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    let isMounted = true;

    storage.loadSettings().then((loadedSettings) => {
      if (isMounted) {
        setSettings(loadedSettings);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [storage]);

  function updateSetting<Key extends keyof ExtensionSettings>(
    key: Key,
    value: ExtensionSettings[Key],
  ) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }));
    setStatus("idle");
    setTestNotificationMessage("");
    setPendingDeleteCustomReminderId(null);
  }

  function toggleReminderCategory(reminderId: ReminderId) {
    setSettings((currentSettings) => {
      const isPreferred =
        currentSettings.preferredReminderCategories.includes(reminderId);
      const nextCategories = isPreferred
        ? currentSettings.preferredReminderCategories.filter(
            (category) => category !== reminderId,
          )
        : [...currentSettings.preferredReminderCategories, reminderId];

      if (nextCategories.length === 0) {
        setStatus("category-required");
        return currentSettings;
      }

      setStatus("idle");

      return {
        ...currentSettings,
        preferredReminderCategories: nextCategories,
      };
    });
  }

  function updateCustomDraft<Key extends keyof CustomReminderDraft>(
    key: Key,
    value: CustomReminderDraft[Key],
  ) {
    setCustomDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }));
    setCustomDraftErrors({});
    setStatus("idle");
    setTestNotificationMessage("");
  }

  function updateCustomSchedule(schedule: CustomReminderSchedule) {
    setCustomDraft((currentDraft) => ({
      ...currentDraft,
      schedule,
    }));
    setCustomDraftErrors({});
    setStatus("idle");
    setTestNotificationMessage("");
  }

  function updateCustomScheduleType(type: CustomReminderSchedule["type"]) {
    updateCustomSchedule(createDefaultCustomReminderSchedule(type));
  }

  function updateCustomIntervalMinutes(intervalMinutes: number) {
    updateCustomSchedule({
      type: "interval",
      intervalMinutes,
    });
  }

  function updateCustomDayInterval(dayIntervalDays: number) {
    if (customDraft.schedule.type !== "dailyInterval") {
      return;
    }

    updateCustomSchedule({
      ...customDraft.schedule,
      dayIntervalDays,
    });
  }

  function updateCustomDailyTime(timeOfDay: string) {
    if (customDraft.schedule.type !== "dailyInterval") {
      return;
    }

    updateCustomSchedule({
      ...customDraft.schedule,
      timeOfDay,
    });
  }

  function updateCustomWeekdayTime(timeOfDay: string) {
    if (customDraft.schedule.type !== "weekdayInterval") {
      return;
    }

    updateCustomSchedule({
      ...customDraft.schedule,
      timeOfDay,
    });
  }

  function updateCustomOneTimeDate(date: string) {
    const schedule =
      customDraft.schedule.type === "oneTime"
        ? customDraft.schedule
        : (createDefaultCustomReminderSchedule(
            "oneTime",
          ) as OneTimeCustomReminderSchedule);

    updateCustomSchedule({
      ...schedule,
      date,
    });
  }

  function updateCustomOneTimeTime(timeOfDay: string) {
    const schedule =
      customDraft.schedule.type === "oneTime"
        ? customDraft.schedule
        : (createDefaultCustomReminderSchedule(
            "oneTime",
          ) as OneTimeCustomReminderSchedule);

    updateCustomSchedule({
      ...schedule,
      timeOfDay,
    });
  }

  function isCustomWeekdaySelected(weekday: Weekday) {
    return (
      customDraft.schedule.type === "weekdayInterval" &&
      customDraft.schedule.weekdays.includes(weekday)
    );
  }

  function toggleCustomWeekday(weekday: Weekday) {
    if (customDraft.schedule.type !== "weekdayInterval") {
      return;
    }

    const weekdays = customDraft.schedule.weekdays.includes(weekday)
      ? customDraft.schedule.weekdays.filter((candidate) => candidate !== weekday)
      : [...customDraft.schedule.weekdays, weekday];

    updateCustomSchedule({
      ...customDraft.schedule,
      weekdays,
    });
  }

  function applyCustomRecommendation(
    recommendation: (typeof customRecommendations)[number],
  ) {
    setCustomDraft(getCustomReminderDraftFromRecommendation(recommendation));
    setCustomDraftErrors({});
    setPendingDeleteCustomReminderId(null);
    setStatus("idle");
    setTestNotificationMessage("");
    setIsCustomReminderWizardOpen(true);
  }

  function resetCustomDraft() {
    setCustomDraft({ ...defaultCustomReminderDraft });
    setCustomRecommendations(getRecommendedCustomReminders());
    setCustomDraftErrors({});
  }

  function openNewCustomReminderWizard() {
    resetCustomDraft();
    setPendingDeleteCustomReminderId(null);
    setStatus("idle");
    setTestNotificationMessage("");
    setIsCustomReminderWizardOpen(true);
  }

  function closeCustomReminderWizard() {
    setIsCustomReminderWizardOpen(false);
    setCustomDraftErrors({});
  }

  function saveCustomReminder() {
    const validationResult = validateCustomReminderDraft(customDraft);

    if (!validationResult.success) {
      setCustomDraftErrors(validationResult.errors);
      setStatus("custom-error");
      return;
    }

    setSettings((currentSettings) => {
      const existingReminder = currentSettings.customReminders.find(
        (reminder) => reminder.id === customDraft.id,
      );
      const reminder = createCustomReminderDefinition({
        draft: validationResult.draft,
        displayPriority:
          existingReminder?.displayPriority ??
          reminderList.length + currentSettings.customReminders.length + 1,
      });

      return upsertCustomReminderSettingsFor({
        settings: currentSettings,
        reminder,
        enabled: customDraft.enabled,
      });
    });
    resetCustomDraft();
    setPendingDeleteCustomReminderId(null);
    setIsCustomReminderWizardOpen(false);
    setStatus("idle");
    setTestNotificationMessage("");
  }

  function editCustomReminder(reminderId: ReminderId) {
    const reminder = settings.customReminders.find(
      (candidate) => candidate.id === reminderId,
    );

    if (!reminder) {
      return;
    }

    setCustomDraft(
      getCustomReminderDraft(
        reminder,
        settings.preferredReminderCategories.includes(reminder.id),
      ),
    );
    setCustomDraftErrors({});
    setPendingDeleteCustomReminderId(null);
    setStatus("idle");
    setTestNotificationMessage("");
    setIsCustomReminderWizardOpen(true);
  }

  function deleteCustomReminder(reminderId: ReminderId) {
    setPendingDeleteCustomReminderId(reminderId);
    setStatus("idle");
    setTestNotificationMessage("");
  }

  function confirmDeleteCustomReminder(reminderId: ReminderId) {
    setSettings((currentSettings) =>
      deleteCustomReminderSettingsFor(currentSettings, reminderId),
    );

    if (customDraft.id === reminderId) {
      resetCustomDraft();
    }

    setPendingDeleteCustomReminderId(null);
    setStatus("custom-removed");
    setTestNotificationMessage("");
  }

  function cancelDeleteCustomReminder() {
    setPendingDeleteCustomReminderId(null);
    setStatus("idle");
    setTestNotificationMessage("");
  }

  async function saveCurrentSettings() {
    const didSave = await storage.saveSettings(settings);

    setStatus(didSave ? "saved" : "error");
  }

  async function resetSettings() {
    const defaultSettings = getDefaultExtensionSettings();
    const didSave = await storage.saveSettings(defaultSettings);

    setSettings(defaultSettings);
    setStatus(didSave ? "reset" : "error");
  }

  async function resetTodaysProgress() {
    const nextSettings: ExtensionSettings = {
      ...settings,
      snoozedUntilByReminderId: {},
      reminderHistory: removeReminderHistoryEntriesForDate(
        settings.reminderHistory,
        currentDate ?? new Date(),
      ),
    };
    const didSave = await storage.saveSettings(nextSettings);

    setSettings(nextSettings);
    setStatus(didSave ? "progress-reset" : "error");
    setTestNotificationMessage("");
  }

  function sendTestNotification() {
    if (isSendingTestNotificationRef.current) {
      return;
    }

    const notifications = getChromeApi()?.notifications;
    const reminder = getTestReminder(allReminders);

    if (!reminder) {
      setStatus("test-unavailable");
      setTestNotificationMessage(
        "No reminder copy is available for a test notification.",
      );
      return;
    }

    isSendingTestNotificationRef.current = true;
    setStatus("test-pending");
    setTestNotificationMessage(
      "Send test notification was clicked. Preparing notification check...",
    );

    function showTestUnavailable(message: string) {
      isSendingTestNotificationRef.current = false;
      setStatus("test-unavailable");
      setTestNotificationMessage(message);
    }

    function showTestSent() {
      isSendingTestNotificationRef.current = false;
      setStatus("test-sent");
      setTestNotificationMessage(
        "Browser accepted the test notification. If no macOS banner appeared, check Focus or Do Not Disturb and notification settings for this browser.",
      );
    }

    function sendPageNotificationFallback(reason: string) {
      const BrowserNotification = getBrowserNotificationApi();
      const copy = createReminderNotificationCopy(reminder);

      setStatus("test-pending");
      setTestNotificationMessage(
        `${reason} Trying a page-level browser notification fallback...`,
      );

      if (!BrowserNotification) {
        showTestUnavailable(
          `${reason} The page-level Notification API is also unavailable in this browser context.`,
        );
        return;
      }

      function createPageNotification() {
        try {
          new BrowserNotification(copy.title, {
            body: copy.message,
            icon: getExtensionNotificationIconUrl(),
            requireInteraction: true,
          });
          setStatus("test-sent");
          setTestNotificationMessage(
            `${reason} Fallback browser notification was sent from the Options page. If no macOS banner appeared, system or browser notification settings are suppressing it. Scheduled reminders still require extension notification support.`,
          );
        } catch (error) {
          showTestUnavailable(
            `${reason} Page-level notification failed: ${String(error)}`,
          );
        }
      }

      if (BrowserNotification.permission === "granted") {
        createPageNotification();
        return;
      }

      if (BrowserNotification.permission === "denied") {
        showTestUnavailable(
          `${reason} Page-level notification permission is denied in this browser.`,
        );
        return;
      }

      if (!BrowserNotification.requestPermission) {
        showTestUnavailable(
          `${reason} Page-level notification permission is not granted, and this browser cannot request it from the Options page.`,
        );
        return;
      }

      void BrowserNotification.requestPermission()
        .then((permission) => {
          if (permission === "granted") {
            createPageNotification();
            return;
          }

          showTestUnavailable(
            `${reason} Page-level notification permission is ${permission}.`,
          );
        })
        .catch((error: unknown) => {
          showTestUnavailable(
            `${reason} Page-level notification permission request failed: ${String(
              error,
            )}`,
          );
        });
    }

    if (!notifications) {
      sendPageNotificationFallback(
        "The extension notification API is unavailable on this page.",
      );
      return;
    }

    const notificationsApi = notifications;

    function createTestNotification() {
      const copy = createReminderNotificationCopy(reminder);

      try {
        let didSettle = false;
        const timeoutId = window.setTimeout(() => {
          if (didSettle) {
            return;
          }

          didSettle = true;
          sendPageNotificationFallback(
            "The extension notification API did not confirm notification creation.",
          );
        }, NOTIFICATION_CREATE_TIMEOUT_MS);
        const settleUnavailable = (message: string) => {
          if (didSettle) {
            return;
          }

          didSettle = true;
          window.clearTimeout(timeoutId);
          showTestUnavailable(message);
        };
        const settleSent = () => {
          if (didSettle) {
            return;
          }

          didSettle = true;
          window.clearTimeout(timeoutId);
          showTestSent();
        };
        const result = notificationsApi.create(
          getTestNotificationId(),
          {
            type: "basic",
            iconUrl: getExtensionNotificationIconUrl(),
            title: copy.title,
            message: copy.message,
            contextMessage: copy.contextMessage,
            requireInteraction: true,
            buttons: createNotificationButtons(),
          },
          () => {
            const errorMessage = getRuntimeErrorMessage();

            if (errorMessage) {
              settleUnavailable(
                `Browser rejected the test notification: ${errorMessage}`,
              );
              return;
            }

            settleSent();
          },
        );

        if (result instanceof Promise) {
          void result.then(settleSent).catch((error: unknown) => {
            settleUnavailable(
              `Browser rejected the test notification: ${String(error)}`,
            );
          });
        }
      } catch (error) {
        showTestUnavailable(
          `Test notification could not be sent: ${String(error)}`,
        );
      }
    }

    if (notificationsApi.getPermissionLevel) {
      try {
        let didCheckPermission = false;
        const timeoutId = window.setTimeout(() => {
          if (didCheckPermission) {
            return;
          }

          didCheckPermission = true;
          setTestNotificationMessage(
            "Browser did not answer the notification permission check. Trying the extension notification API directly...",
          );
          createTestNotification();
        }, PERMISSION_CHECK_TIMEOUT_MS);

        notificationsApi.getPermissionLevel((permissionLevel) => {
          if (didCheckPermission) {
            return;
          }

          didCheckPermission = true;
          window.clearTimeout(timeoutId);
          const errorMessage = getRuntimeErrorMessage();

          if (errorMessage) {
            showTestUnavailable(
              `Browser could not check notification permission: ${errorMessage}`,
            );
            return;
          }

          if (permissionLevel === "denied") {
            showTestUnavailable(
              "Browser notification permission is denied. Allow notifications for this browser in macOS System Settings, then try again.",
            );
            return;
          }

          createTestNotification();
        });
      } catch (error) {
        showTestUnavailable(
          `Browser could not check notification permission: ${String(error)}`,
        );
      }

      return;
    }

    setTestNotificationMessage(
      "Browser does not expose a permission check. Trying the extension notification API directly...",
    );
    createTestNotification();
  }

  function getTestNotificationStatusMessage() {
    if (testNotificationMessage) {
      return testNotificationMessage;
    }

    if (status === "test-unavailable") {
      return "Test notification could not be sent from this browser context.";
    }

    return "";
  }

  const optionsNavItems: Array<{ id: OptionsPanelId; label: string }> = [
    { id: "general", label: "General" },
    { id: "reminders", label: "Reminders" },
  ];

  const customReminderOnSchedule: OneTimeCustomReminderSchedule =
    customDraft.schedule.type === "oneTime"
      ? customDraft.schedule
      : (createDefaultCustomReminderSchedule(
          "oneTime",
        ) as OneTimeCustomReminderSchedule);

  const customReminderForm = (
    <>
      <div className="extension-field-grid">
        <label className="extension-setting-row extension-field">
          <span>Title</span>
          <input
            type="text"
            maxLength={CUSTOM_REMINDER_TITLE_MAX_LENGTH}
            value={customDraft.title}
            onChange={(event) =>
              updateCustomDraft("title", event.currentTarget.value)
            }
            aria-describedby={titleDescriptionIds || undefined}
            aria-invalid={Boolean(customDraftErrors.title)}
          />
          {titleLimitStatus ? (
            <small
              id="extension-custom-reminder-title-limit"
              className={getCharacterLimitHintClassName(titleLimitStatus)}
            >
              {titleLimitStatus.message}
            </small>
          ) : null}
          {customDraftErrors.title ? (
            <small
              id="extension-custom-reminder-title-error"
              className="extension-field-error"
            >
              {customDraftErrors.title}
            </small>
          ) : null}
        </label>
        <label className="extension-setting-row extension-field">
          <span>Category</span>
          <input
            type="text"
            maxLength={CUSTOM_REMINDER_CATEGORY_MAX_LENGTH}
            value={customDraft.category}
            onChange={(event) =>
              updateCustomDraft("category", event.currentTarget.value)
            }
            aria-describedby={categoryDescriptionIds || undefined}
            aria-invalid={Boolean(customDraftErrors.category)}
          />
          {categoryLimitStatus ? (
            <small
              id="extension-custom-reminder-category-limit"
              className={getCharacterLimitHintClassName(categoryLimitStatus)}
            >
              {categoryLimitStatus.message}
            </small>
          ) : null}
          {customDraftErrors.category ? (
            <small
              id="extension-custom-reminder-category-error"
              className="extension-field-error"
            >
              {customDraftErrors.category}
            </small>
          ) : null}
        </label>
      </div>
      <label className="extension-setting-row extension-field extension-custom-reminder-message-field">
        <span>Message</span>
        <textarea
          rows={4}
          maxLength={CUSTOM_REMINDER_MESSAGE_MAX_LENGTH}
          value={customDraft.description}
          onChange={(event) =>
            updateCustomDraft("description", event.currentTarget.value)
          }
          aria-describedby={messageDescriptionIds || undefined}
          aria-invalid={Boolean(customDraftErrors.description)}
        />
        {messageLimitStatus ? (
          <small
            id="extension-custom-reminder-message-limit"
            className={getCharacterLimitHintClassName(messageLimitStatus)}
          >
            {messageLimitStatus.message}
          </small>
        ) : null}
        {customDraftErrors.description ? (
          <small
            id="extension-custom-reminder-message-error"
            className="extension-field-error"
          >
            {customDraftErrors.description}
          </small>
        ) : null}
      </label>
    </>
  );

  const reminderTimingControls = (
    <>
      {customDraft.schedule.type === "oneTime" ? (
        <div className="extension-field-grid">
          <label className="extension-setting-row extension-field">
            <span>Date</span>
            <input
              type="date"
              min={formatDateInputValue(new Date())}
              value={customReminderOnSchedule.date}
              onChange={(event) =>
                updateCustomOneTimeDate(event.currentTarget.value)
              }
              aria-invalid={Boolean(customDraftErrors.date)}
            />
            {customDraftErrors.date ? (
              <small className="extension-field-error">
                {customDraftErrors.date}
              </small>
            ) : null}
          </label>
          <label className="extension-setting-row extension-field">
            <span>Time</span>
            <input
              type="time"
              value={customReminderOnSchedule.timeOfDay}
              onChange={(event) =>
                updateCustomOneTimeTime(event.currentTarget.value)
              }
              aria-invalid={Boolean(customDraftErrors.timeOfDay)}
            />
          </label>
        </div>
      ) : null}
      {customDraft.schedule.type === "interval" ? (
        <label className="extension-setting-row extension-field">
          <span>Repeat every minutes</span>
          <input
            type="number"
            aria-label="Custom reminder interval minutes"
            min="5"
            max="1440"
            step="1"
            value={customDraft.schedule.intervalMinutes}
            onChange={(event) =>
              updateCustomIntervalMinutes(Number(event.currentTarget.value))
            }
            aria-describedby={`extension-custom-reminder-interval-hint${
              customDraftErrors.intervalMinutes
                ? " extension-custom-reminder-interval-error"
                : ""
            }`}
            aria-invalid={Boolean(customDraftErrors.intervalMinutes)}
          />
          <small
            id="extension-custom-reminder-interval-hint"
            className="extension-field-hint"
          >
            Whole number, 5-1440 minutes.
          </small>
          {customDraftErrors.intervalMinutes ? (
            <small
              id="extension-custom-reminder-interval-error"
              className="extension-field-error"
            >
              {customDraftErrors.intervalMinutes}
            </small>
          ) : null}
        </label>
      ) : null}
      {customDraft.schedule.type === "dailyInterval" ? (
        <div className="extension-field-grid">
          <label className="extension-setting-row extension-field">
            <span>Repeat every days</span>
            <input
              type="number"
              min="1"
              max="365"
              step="1"
              value={customDraft.schedule.dayIntervalDays}
              onChange={(event) =>
                updateCustomDayInterval(Number(event.currentTarget.value))
              }
              aria-invalid={Boolean(customDraftErrors.dayIntervalDays)}
            />
            {customDraftErrors.dayIntervalDays ? (
              <small className="extension-field-error">
                {customDraftErrors.dayIntervalDays}
              </small>
            ) : null}
          </label>
          <label className="extension-setting-row extension-field">
            <span>Time of day</span>
            <input
              type="time"
              value={customDraft.schedule.timeOfDay}
              onChange={(event) =>
                updateCustomDailyTime(event.currentTarget.value)
              }
              aria-invalid={Boolean(customDraftErrors.timeOfDay)}
            />
          </label>
        </div>
      ) : null}
      {customDraft.schedule.type === "weekdayInterval" ? (
        <>
          <label className="extension-setting-row extension-field">
            <span>Time</span>
            <input
              type="time"
              value={customDraft.schedule.timeOfDay}
              onChange={(event) =>
                updateCustomWeekdayTime(event.currentTarget.value)
              }
              aria-invalid={Boolean(customDraftErrors.timeOfDay)}
            />
          </label>
          <fieldset className="extension-nested-group">
            <legend>Repeat on</legend>
            <div className="extension-weekday-pill-grid">
              {weekdayOrder.map((weekday) => (
                <label key={weekday} className="extension-weekday-pill">
                  <input
                    type="checkbox"
                    checked={isCustomWeekdaySelected(weekday)}
                    onChange={() => toggleCustomWeekday(weekday)}
                  />
                  <span>{weekdayLabels[weekday].slice(0, 3)}</span>
                </label>
              ))}
            </div>
            {customDraftErrors.weekdays ? (
              <small className="extension-field-error">
                {customDraftErrors.weekdays}
              </small>
            ) : null}
          </fieldset>
        </>
      ) : null}
      {customDraftErrors.timeOfDay ? (
        <small className="extension-field-error">
          {customDraftErrors.timeOfDay}
        </small>
      ) : null}
    </>
  );

  const recurrenceControls = (
    <div className="extension-wizard-recurrence-options">
      {customReminderScheduleOptions.map((option) => (
        <label key={option.value} className="extension-wizard-recurrence-card">
          <input
            type="radio"
            aria-label={option.label}
            name="extensionCustomReminderScheduleType"
            checked={customDraft.schedule.type === option.value}
            onChange={() => updateCustomScheduleType(option.value)}
          />
          <span className="extension-wizard-recurrence-title">
            <span>{option.label}</span>
            {option.isPopular ? (
              <em className="extension-wizard-popular-tag">🔥 Popular</em>
            ) : null}
          </span>
          <small>{option.description}</small>
        </label>
      ))}
    </div>
  );

  const reminderWindowControl = (
    <label className="extension-switch-row">
      <span>
        <strong>Respect quiet hours and workday</strong>
        <small>Delay reminders to allowed times.</small>
      </span>
      <input
        type="checkbox"
        aria-label="Respect quiet hours and workday"
        checked={customDraft.respectReminderWindows}
        onChange={(event) =>
          updateCustomDraft(
            "respectReminderWindows",
            event.currentTarget.checked,
          )
        }
      />
    </label>
  );

  const customRemindersSection = (
    <details className="extension-schedule-subsection extension-custom-panel extension-custom-subsection">
      <summary>
        <span>Custom reminders</span>
        <small>Create and manage your own reminders.</small>
      </summary>
      <div className="extension-custom-header">
        <h3>Recommended for you</h3>
        <button
          type="button"
          onClick={() => setCustomRecommendations(getRecommendedCustomReminders())}
        >
          Refresh
        </button>
      </div>
      <div
        className="extension-recommendation-grid"
        aria-label="Recommended custom reminders"
      >
        {customRecommendations.map((recommendation) => (
          <button
            key={recommendation.id}
            type="button"
            className="extension-recommendation-card"
            onClick={() => applyCustomRecommendation(recommendation)}
          >
            <span className="extension-recommendation-icon">◇</span>
            <strong>{recommendation.title}</strong>
            <small>{recommendation.description}</small>
            <span>{formatCustomReminderSchedule(recommendation.schedule)}</span>
            <em>Use</em>
          </button>
        ))}
      </div>
      <div className="extension-save-row extension-custom-reminder-actions">
        <button
          type="button"
          aria-label="Add custom reminder"
          onClick={openNewCustomReminderWizard}
        >
          + Add custom reminder
        </button>
      </div>
      <fieldset className="extension-nested-group extension-custom-reminder-management">
        <legend>Manage Custom Reminders</legend>
        {settings.customReminders.length > 0 ? (
          <ul className="extension-custom-list" aria-label="Custom reminders">
            {settings.customReminders.map((reminder) => (
              <li key={reminder.id} aria-label={reminder.title}>
                {pendingDeleteCustomReminderId === reminder.id ? (
                  <>
                    <div>
                      <strong>Delete {reminder.title}?</strong>
                      <span>Save settings to apply.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => confirmDeleteCustomReminder(reminder.id)}
                    >
                      Confirm delete
                    </button>
                    <button type="button" onClick={cancelDeleteCustomReminder}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>{reminder.title}</strong>
                      <span>
                        {formatCustomReminderSchedule(reminder.schedule)}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Edit ${reminder.title}`}
                      onClick={() => editCustomReminder(reminder.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${reminder.title}`}
                      onClick={() => deleteCustomReminder(reminder.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="extension-options-footnote">No custom reminders yet.</p>
        )}
      </fieldset>
    </details>
  );

  return (
    <main
      className="extension-shell extension-options extension-options-mockup"
      aria-labelledby="options-title"
    >
      <form
        className="extension-options-frame"
        onSubmit={(event) => {
          event.preventDefault();
          void saveCurrentSettings();
        }}
      >
        <aside className="extension-options-sidebar" aria-label="Options sections">
          <div className="extension-options-brand">
            <img
              src="/assets/vitaloop-logo-source.png"
              alt=""
              aria-hidden="true"
            />
            <span>VitaLoop</span>
          </div>
          <nav>
            {optionsNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeOptionsPanel === item.id ? "is-active" : ""}
                onClick={() => setActiveOptionsPanel(item.id)}
              >
                <OptionsIcon label={item.label} />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="extension-options-main">
          <header className="extension-options-heading">
            <h1 id="options-title">Options</h1>
          </header>

          {activeOptionsPanel === "general" ? (
            <div className="extension-options-grid">
              <section className="extension-card">
                <label className="extension-switch-row">
                  <span>
                    <strong>Proactive reminders</strong>
                    <small>
                      Enable local proactive reminders throughout your day.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    aria-label="Enable proactive reminders"
                    checked={settings.proactiveRemindersEnabled}
                    onChange={(event) =>
                      updateSetting(
                        "proactiveRemindersEnabled",
                        event.currentTarget.checked,
                      )
                    }
                  />
                </label>
                <label className="extension-setting-row extension-field">
                  <span>Reminder intensity</span>
                  <select
                    aria-label="Reminder intensity"
                    value={settings.reminderIntensity}
                    onChange={(event) =>
                      updateSetting(
                        "reminderIntensity",
                        event.currentTarget
                          .value as ExtensionSettings["reminderIntensity"],
                      )
                    }
                  >
                    {reminderIntensityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="extension-switch-row">
                  <span>
                    <strong>Daily summary</strong>
                    <small>Show a summary of your day in the popup.</small>
                  </span>
                  <input type="checkbox" checked readOnly />
                </label>
                <label className="extension-switch-row">
                  <span>
                    <strong>Start with system</strong>
                    <small>Launch VitaLoop when you start your browser.</small>
                  </span>
                  <input type="checkbox" disabled />
                </label>
                <details className="extension-schedule-subsection">
                  <summary>
                    <span>👨🏻‍💻 Working Hours</span>
                    <small>Set the workday window for reminders.</small>
                  </summary>
                  <div className="extension-field-grid">
                    <label className="extension-setting-row extension-field">
                      <span>Workday start</span>
                      <input
                        type="time"
                        value={settings.workdayStart}
                        onChange={(event) =>
                          updateSetting("workdayStart", event.currentTarget.value)
                        }
                      />
                    </label>
                    <label className="extension-setting-row extension-field">
                      <span>Workday end</span>
                      <input
                        type="time"
                        value={settings.workdayEnd}
                        onChange={(event) =>
                          updateSetting("workdayEnd", event.currentTarget.value)
                        }
                      />
                    </label>
                  </div>
                </details>
              </section>
              <aside className="extension-options-rail">
                <section className="extension-card">
                  <h2>Quick actions</h2>
                  <button
                    type="button"
                    className="extension-secondary-action"
                    onClick={sendTestNotification}
                    disabled={isTestNotificationPending}
                  >
                    Send test notification
                  </button>
                  <button
                    type="button"
                    className="extension-secondary-action"
                    onClick={() => void resetTodaysProgress()}
                  >
                    Reset today's progress
                  </button>
                </section>
              </aside>
            </div>
          ) : null}

          {activeOptionsPanel === "reminders" ? (
            <section className="extension-card">
              <h2>
                {optionsNavItems.find((item) => item.id === activeOptionsPanel)
                  ?.label}
              </h2>
              <div className="extension-category-grid">
                {reminderCategories.map((reminder) => {
                  const isPreferred =
                    settings.preferredReminderCategories.includes(reminder.id);
                  const isOnlyPreferred =
                    isPreferred &&
                    settings.preferredReminderCategories.length === 1;

                  return (
                    <label
                      key={reminder.id}
                      className="extension-setting-row extension-check-row"
                    >
                      <input
                        type="checkbox"
                        checked={isPreferred}
                        disabled={isOnlyPreferred}
                        onChange={() => toggleReminderCategory(reminder.id)}
                      />
                      <span>{reminder.title}</span>
                    </label>
                  );
                })}
              </div>
              {customRemindersSection}
            </section>
          ) : null}

          <div className="extension-save-row extension-options-footer">
            <button type="button" onClick={() => void resetSettings()}>
              Reset to defaults
            </button>
            <button type="submit">Save changes</button>
          </div>

          {status === "saved" && (
            <p className="extension-live-status" role="status" aria-live="polite">
              Settings saved.
            </p>
          )}
          {status === "reset" && (
            <p className="extension-live-status" role="status" aria-live="polite">
              Defaults restored.
            </p>
          )}
          {status === "progress-reset" && (
            <p className="extension-live-status" role="status" aria-live="polite">
              Today's progress reset.
            </p>
          )}
          {status === "category-required" && (
            <p className="extension-live-status" role="status" aria-live="polite">
              Keep at least one category active.
            </p>
          )}
          {status === "error" && (
            <p className="extension-error" role="alert">
              Settings could not be saved.
            </p>
          )}
          {status === "test-sent" || status === "test-pending" ? (
            <p className="extension-live-status" role="status" aria-live="polite">
              {getTestNotificationStatusMessage()}
            </p>
          ) : null}
          {status === "test-unavailable" ? (
            <p className="extension-error" role="alert">
              {getTestNotificationStatusMessage()}
            </p>
          ) : null}
          {status === "custom-error" && (
            <p className="extension-error" role="alert">
              Check the highlighted custom reminder fields and try again.
            </p>
          )}
          {status === "custom-removed" && (
            <p className="extension-live-status" role="status" aria-live="polite">
              Custom reminder removed. Save settings to apply.
            </p>
          )}
        </section>
      </form>

      {isCustomReminderWizardOpen ? (
        <div className="extension-wizard-backdrop" role="presentation">
          <section
            className="extension-custom-wizard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="extension-custom-wizard-heading"
          >
            <header className="extension-custom-wizard-header">
              <h2 id="extension-custom-wizard-heading">New custom reminder</h2>
              <button
                type="button"
                className="extension-icon-button"
                aria-label="Close custom reminder wizard"
                onClick={closeCustomReminderWizard}
              >
                ×
              </button>
            </header>
            <div className="extension-custom-wizard-body">
              <div className="extension-custom-wizard-panel">
                <h3>Details</h3>
                {customReminderForm}
                <div className="extension-custom-wizard-subsection">
                  <h4>Remind me on:</h4>
                  {reminderTimingControls}
                </div>
                <div className="extension-custom-wizard-subsection">
                  <h4>Frequency</h4>
                  <p>Choose how often this reminder repeats.</p>
                  {recurrenceControls}
                </div>
                {reminderWindowControl}
              </div>
            </div>
            <footer className="extension-custom-wizard-footer">
              <button type="button" onClick={saveCustomReminder}>
                Add Reminder
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
