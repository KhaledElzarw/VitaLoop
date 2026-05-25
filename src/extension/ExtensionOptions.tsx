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
  { value: "interval", label: "Time interval" },
  { value: "dailyInterval", label: "Day interval" },
  { value: "weekdayInterval", label: "Weekdays" },
  { value: "oneTime", label: "Date and time" },
] as const;

type ReminderId = ExtensionSettings["preferredReminderCategories"][number];
type OptionsStatus =
  | "idle"
  | "saved"
  | "reset"
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

export function ExtensionOptions({
  storage = extensionSettingsStorage,
  reminderList = defaultReminders,
}: ExtensionOptionsProps) {
  const [settings, setSettings] = useState<ExtensionSettings>(() =>
    getDefaultExtensionSettings(),
  );
  const [status, setStatus] = useState<OptionsStatus>("idle");
  const [testNotificationMessage, setTestNotificationMessage] = useState("");
  const [customDraft, setCustomDraft] = useState<CustomReminderDraft>({
    ...defaultCustomReminderDraft,
  });
  const [isCustomRemindersExpanded, setIsCustomRemindersExpanded] =
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
    if (customDraft.schedule.type !== "oneTime") {
      return;
    }

    updateCustomSchedule({
      ...customDraft.schedule,
      date,
    });
  }

  function updateCustomOneTimeTime(timeOfDay: string) {
    if (customDraft.schedule.type !== "oneTime") {
      return;
    }

    updateCustomSchedule({
      ...customDraft.schedule,
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
  }

  function resetCustomDraft() {
    setCustomDraft({ ...defaultCustomReminderDraft });
    setCustomRecommendations(getRecommendedCustomReminders());
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

  return (
    <main
      className="extension-shell extension-options"
      aria-labelledby="options-title"
    >
      <header className="extension-titlebar extension-options-titlebar">
        <div className="extension-window-controls" aria-hidden="true">
          <span className="extension-window-dot extension-window-dot-close" />
          <span className="extension-window-dot extension-window-dot-minimize" />
          <span className="extension-window-dot extension-window-dot-zoom" />
        </div>
        <div className="extension-titlebar-title">
          <p>VitaLoop</p>
          <h1 id="options-title">VitaLoop Settings</h1>
        </div>
        <span className="extension-titlebar-spacer" aria-hidden="true" />
      </header>

      <form
        className="extension-form"
        onSubmit={(event) => {
          event.preventDefault();
          void saveCurrentSettings();
        }}
      >
        <fieldset className="extension-group">
          <legend>Proactive reminders</legend>
          <div className="extension-setting-row extension-setting-row-split">
            <label className="extension-check-row">
              <input
                type="checkbox"
                checked={settings.proactiveRemindersEnabled}
                onChange={(event) =>
                  updateSetting(
                    "proactiveRemindersEnabled",
                    event.currentTarget.checked,
                  )
                }
              />
              <span>Enable proactive reminders</span>
            </label>
            <span
              className="extension-status-pill"
              data-state={
                settings.proactiveRemindersEnabled ? "enabled" : "disabled"
              }
            >
              {settings.proactiveRemindersEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <p className="extension-help-text">
            VitaLoop uses local browser alarms and notifications for proactive
            reminders in Chromium-based browsers. Notification permission is
            needed for this local extension feature.
          </p>
          <p className="extension-status">
            Proactive reminders are{" "}
            {settings.proactiveRemindersEnabled ? "enabled" : "disabled"}.
          </p>
          <div className="extension-save-row">
            <button
              type="button"
              onClick={sendTestNotification}
              disabled={isTestNotificationPending}
            >
              Send test notification
            </button>
          </div>
          {status === "test-sent" && (
            <p
              className="extension-live-status"
              role="status"
              aria-live="polite"
            >
              {getTestNotificationStatusMessage()}
            </p>
          )}
          {status === "test-pending" && (
            <p
              className="extension-live-status"
              role="status"
              aria-live="polite"
            >
              {getTestNotificationStatusMessage()}
            </p>
          )}
          {status === "test-unavailable" && (
            <p className="extension-error" role="alert">
              {getTestNotificationStatusMessage()}
            </p>
          )}
        </fieldset>

        <fieldset className="extension-group">
          <legend>Quiet Hours</legend>
          <label className="extension-setting-row extension-check-row">
            <input
              type="checkbox"
              checked={settings.quietHoursEnabled}
              onChange={(event) =>
                updateSetting("quietHoursEnabled", event.currentTarget.checked)
              }
            />
            <span>Quiet hours enabled</span>
          </label>
          <div className="extension-field-grid">
            <label className="extension-setting-row extension-field">
              <span>Quiet hours start</span>
              <input
                type="time"
                value={settings.quietHoursStart}
                onChange={(event) =>
                  updateSetting("quietHoursStart", event.currentTarget.value)
                }
              />
            </label>
            <label className="extension-setting-row extension-field">
              <span>Quiet hours end</span>
              <input
                type="time"
                value={settings.quietHoursEnd}
                onChange={(event) =>
                  updateSetting("quietHoursEnd", event.currentTarget.value)
                }
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="extension-group">
          <legend>Workday</legend>
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
        </fieldset>

        <fieldset className="extension-group">
          <legend>Intensity</legend>
          <div className="extension-choice-grid">
            {reminderIntensityOptions.map((option) => (
              <label key={option.value} className="extension-radio-card">
                <input
                  type="radio"
                  name="reminderIntensity"
                  value={option.value}
                  checked={settings.reminderIntensity === option.value}
                  onChange={() =>
                    updateSetting("reminderIntensity", option.value)
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="extension-group">
          <legend>Categories</legend>
          <div className="extension-category-grid">
            {allReminders.map((reminder) => {
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
        </fieldset>

        <fieldset className="extension-group extension-custom-reminders-section">
          <legend>
            <label className="extension-collapsible-legend-control">
              <span>Custom reminders</span>
              <input
                type="checkbox"
                checked={isCustomRemindersExpanded}
                aria-controls="extension-custom-reminders-panel"
                onChange={(event) =>
                  setIsCustomRemindersExpanded(event.currentTarget.checked)
                }
              />
            </label>
          </legend>
          {isCustomRemindersExpanded ? (
            <div id="extension-custom-reminders-panel">
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
                <strong>{recommendation.title}</strong>
                <span>{formatCustomReminderSchedule(recommendation.schedule)}</span>
                <small>{recommendation.description}</small>
              </button>
            ))}
              </div>
          <div className="extension-field-grid">
            <label className="extension-setting-row extension-field">
              <span>Custom reminder title</span>
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
              <span>Custom reminder category</span>
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
          <label className="extension-setting-row extension-field">
            <span>Custom reminder message</span>
            <input
              type="text"
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
          <fieldset className="extension-nested-group">
            <legend>Custom recurrence</legend>
            <div className="extension-segmented-options">
              {customReminderScheduleOptions.map((option) => (
                <label key={option.value} className="extension-radio-pill">
                  <input
                    type="radio"
                    name="extensionCustomReminderScheduleType"
                    checked={customDraft.schedule.type === option.value}
                    onChange={() => updateCustomScheduleType(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {customDraft.schedule.type === "interval" ? (
            <label className="extension-setting-row extension-field">
              <span>Custom reminder interval minutes</span>
              <input
                type="number"
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
                <span>Reminder time</span>
                <input
                  type="time"
                  value={customDraft.schedule.timeOfDay}
                  onChange={(event) =>
                    updateCustomDailyTime(event.currentTarget.value)
                  }
                  aria-invalid={Boolean(customDraftErrors.timeOfDay)}
                />
                {customDraftErrors.timeOfDay ? (
                  <small className="extension-field-error">
                    {customDraftErrors.timeOfDay}
                  </small>
                ) : null}
              </label>
            </div>
          ) : null}
          {customDraft.schedule.type === "weekdayInterval" ? (
            <>
              <fieldset className="extension-nested-group">
                <legend>Reminder weekdays</legend>
                <div className="extension-weekday-grid">
                  {weekdayOrder.map((weekday) => (
                    <label
                      key={weekday}
                      className="extension-setting-row extension-check-row"
                    >
                      <input
                        type="checkbox"
                        checked={isCustomWeekdaySelected(weekday)}
                        onChange={() => toggleCustomWeekday(weekday)}
                      />
                      <span>{weekdayLabels[weekday]}</span>
                    </label>
                  ))}
                </div>
                {customDraftErrors.weekdays ? (
                  <small className="extension-field-error">
                    {customDraftErrors.weekdays}
                  </small>
                ) : null}
              </fieldset>
              <label className="extension-setting-row extension-field">
                <span>Reminder time</span>
                <input
                  type="time"
                  value={customDraft.schedule.timeOfDay}
                  onChange={(event) =>
                    updateCustomWeekdayTime(event.currentTarget.value)
                  }
                  aria-invalid={Boolean(customDraftErrors.timeOfDay)}
                />
                {customDraftErrors.timeOfDay ? (
                  <small className="extension-field-error">
                    {customDraftErrors.timeOfDay}
                  </small>
                ) : null}
              </label>
            </>
          ) : null}
          {customDraft.schedule.type === "oneTime" ? (
            <div className="extension-field-grid">
              <label className="extension-setting-row extension-field">
                <span>Reminder date</span>
                <input
                  type="date"
                  min={formatDateInputValue(new Date())}
                  value={customDraft.schedule.date}
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
                <span>Reminder time</span>
                <input
                  type="time"
                  value={customDraft.schedule.timeOfDay}
                  onChange={(event) =>
                    updateCustomOneTimeTime(event.currentTarget.value)
                  }
                  aria-invalid={Boolean(customDraftErrors.timeOfDay)}
                />
                {customDraftErrors.timeOfDay ? (
                  <small className="extension-field-error">
                    {customDraftErrors.timeOfDay}
                  </small>
                ) : null}
              </label>
            </div>
          ) : null}
          <div className="extension-field-grid">
            <label className="extension-setting-row extension-check-row">
              <input
                type="checkbox"
                checked={customDraft.respectReminderWindows}
                onChange={(event) =>
                  updateCustomDraft(
                    "respectReminderWindows",
                    event.currentTarget.checked,
                  )
                }
              />
              <span>Respect quiet hours and workday</span>
            </label>
            <label className="extension-setting-row extension-check-row">
              <input
                type="checkbox"
                checked={customDraft.enabled}
                onChange={(event) =>
                  updateCustomDraft("enabled", event.currentTarget.checked)
                }
              />
              <span>Enable custom reminder</span>
            </label>
          </div>
          <div className="extension-save-row extension-custom-reminder-actions">
            <button type="button" onClick={saveCustomReminder}>
              {customDraft.id ? "Update custom reminder" : "Add custom reminder"}
            </button>
            {customDraft.id ? (
              <button type="button" onClick={resetCustomDraft}>
                Cancel edit
              </button>
            ) : null}
          </div>
          <fieldset className="extension-nested-group extension-custom-reminder-management">
            <legend>Manage Custom Reminders</legend>
            {settings.customReminders.length > 0 ? (
              <ul className="extension-custom-list" aria-label="Custom reminders">
                {settings.customReminders.map((reminder) => (
                  <li key={reminder.id}>
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
                          <span>{formatCustomReminderSchedule(reminder.schedule)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => editCustomReminder(reminder.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
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
              <p className="extension-options-footnote">
                No custom reminders yet.
              </p>
            )}
          </fieldset>
            </div>
          ) : null}
        </fieldset>

        <div className="extension-save-row">
          <button type="submit">Save</button>
          <button type="button" onClick={() => void resetSettings()}>
            Reset to defaults
          </button>
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

        <p className="extension-options-footnote">
          Settings stay local to this browser.
        </p>
      </form>
    </main>
  );
}
