import { useEffect, useState } from "react";
import { reminders as defaultReminders } from "../data/reminders";
import { type ReminderDefinition } from "../domain/schemas";
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
import {
  createReminderActionWindowPath,
  REMINDER_ACTION_WINDOW_HEIGHT,
  REMINDER_ACTION_WINDOW_WIDTH,
} from "./reminderWindow";

const reminderIntensityOptions = [
  { value: "gentle", label: "Gentle" },
  { value: "balanced", label: "Balanced" },
  { value: "active", label: "Active" },
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
  | "test-unavailable";

type NotificationPermissionLevel = "granted" | "denied";

type ChromeNotificationOptions = {
  type: "basic";
  iconUrl: string;
  title: string;
  message: string;
  contextMessage: string;
  buttons?: ChromeNotificationButton[];
};

type ChromeNotificationButton = {
  title: string;
};

type ChromeWindowCreateData = {
  url: string;
  type: "popup";
  width: number;
  height: number;
  focused: boolean;
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
  windows?: {
    create: (
      createData: ChromeWindowCreateData,
      callback?: () => void,
    ) => void | Promise<unknown>;
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

export function ExtensionOptions({
  storage = extensionSettingsStorage,
  reminderList = defaultReminders,
}: ExtensionOptionsProps) {
  const [settings, setSettings] = useState<ExtensionSettings>(() =>
    getDefaultExtensionSettings(),
  );
  const [status, setStatus] = useState<OptionsStatus>("idle");
  const [testNotificationMessage, setTestNotificationMessage] = useState("");

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
    const notifications = getChromeApi()?.notifications;
    const reminder = getTestReminder(reminderList);

    if (!reminder) {
      setStatus("test-unavailable");
      setTestNotificationMessage(
        "No reminder copy is available for a test notification.",
      );
      return;
    }

    setStatus("test-pending");
    setTestNotificationMessage(
      "Send test notification was clicked. Preparing notification check...",
    );

    function showTestUnavailable(message: string) {
      setStatus("test-unavailable");
      setTestNotificationMessage(message);
    }

    function showTestSent() {
      setStatus("test-sent");
      setTestNotificationMessage(
        "Browser accepted the test notification. If no macOS banner appeared, check Focus or Do Not Disturb and notification settings for this browser.",
      );
    }

    function showActionWindowOpened() {
      setStatus("test-sent");
      setTestNotificationMessage(
        "Reminder popup opened with Snooze and Done buttons.",
      );
    }

    function openReminderActionWindow() {
      const windows = getChromeApi()?.windows;

      if (!windows) {
        return false;
      }

      const path = createReminderActionWindowPath(new Date(), reminder.id);
      const url = getChromeApi()?.runtime?.getURL?.(path) ?? path;

      try {
        const result = windows.create(
          {
            url,
            type: "popup",
            width: REMINDER_ACTION_WINDOW_WIDTH,
            height: REMINDER_ACTION_WINDOW_HEIGHT,
            focused: true,
          },
          () => {
            const errorMessage = getRuntimeErrorMessage();

            if (errorMessage) {
              showTestUnavailable(
                `Reminder popup could not be opened: ${errorMessage}`,
              );
              return;
            }

            showActionWindowOpened();
          },
        );

        if (result instanceof Promise) {
          void result
            .then(showActionWindowOpened)
            .catch((error: unknown) => {
              showTestUnavailable(
                `Reminder popup could not be opened: ${String(error)}`,
              );
            });
        }

        return true;
      } catch (error) {
        showTestUnavailable(
          `Reminder popup could not be opened: ${String(error)}`,
        );
        return true;
      }
    }

    if (openReminderActionWindow()) {
      return;
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
            <button type="button" onClick={sendTestNotification}>
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
            {reminderList.map((reminder) => {
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

        <p className="extension-options-footnote">
          Settings stay local to this browser.
        </p>
      </form>
    </main>
  );
}
