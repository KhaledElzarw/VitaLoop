import { reminders } from "../data/reminders";
import {
  handleBackgroundReminderAlarm,
  PROACTIVE_REMINDER_NOTIFICATION_PREFIX,
  syncBackgroundReminderAlarm,
  type ChromeAlarm,
  type ChromeAlarmsApi,
  type ChromeNotificationsApi,
} from "./backgroundScheduler";
import {
  EXTENSION_SETTINGS_STORAGE_KEY,
  loadExtensionSettings,
} from "./extensionSettingsStorage";
import { VITALOOP_NOTIFICATION_ICON_URL } from "./notificationCopy";

type ChromeEvent<Listener> = {
  addListener: (listener: Listener) => void;
};

type ChromeRuntimeApi = {
  getURL?: (path: string) => string;
  onInstalled?: ChromeEvent<() => void>;
  onStartup?: ChromeEvent<() => void>;
  openOptionsPage?: () => void;
};

type ChromeStorageChange = {
  oldValue?: unknown;
  newValue?: unknown;
};

type ChromeBackgroundApi = {
  alarms?: ChromeAlarmsApi & {
    onAlarm?: ChromeEvent<(alarm: ChromeAlarm) => void>;
  };
  notifications?: ChromeNotificationsApi & {
    clear?: (notificationId: string) => void;
    onClicked?: ChromeEvent<(notificationId: string) => void>;
  };
  runtime?: ChromeRuntimeApi;
  storage?: {
    onChanged?: ChromeEvent<
      (changes: Record<string, ChromeStorageChange>, areaName: string) => void
    >;
  };
};

function getChromeApi() {
  return (
    globalThis as typeof globalThis & {
      chrome?: ChromeBackgroundApi;
    }
  ).chrome;
}

async function syncProactiveReminderAlarm() {
  const chromeApi = getChromeApi();

  if (!chromeApi?.alarms) {
    return;
  }

  const settings = await loadExtensionSettings();

  syncBackgroundReminderAlarm({
    alarms: chromeApi.alarms,
    settings,
    reminderList: reminders,
    currentDate: new Date(),
  });
}

async function notifyForAlarm(alarm: ChromeAlarm) {
  const chromeApi = getChromeApi();

  if (!chromeApi?.alarms || !chromeApi.notifications) {
    return;
  }

  const settings = await loadExtensionSettings();

  handleBackgroundReminderAlarm({
    alarm,
    alarms: chromeApi.alarms,
    notifications: chromeApi.notifications,
    settings,
    reminderList: reminders,
    currentDate: new Date(),
    notificationIconUrl:
      chromeApi.runtime?.getURL?.(VITALOOP_NOTIFICATION_ICON_URL) ??
      VITALOOP_NOTIFICATION_ICON_URL,
  });
}

function openOptionsForNotification(notificationId: string) {
  if (!notificationId.startsWith(PROACTIVE_REMINDER_NOTIFICATION_PREFIX)) {
    return;
  }

  const chromeApi = getChromeApi();

  chromeApi?.notifications?.clear?.(notificationId);
  chromeApi?.runtime?.openOptionsPage?.();
}

const chromeApi = getChromeApi();

chromeApi?.runtime?.onInstalled?.addListener(() => {
  void syncProactiveReminderAlarm();
});

chromeApi?.runtime?.onStartup?.addListener(() => {
  void syncProactiveReminderAlarm();
});

chromeApi?.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName !== "local" || !(EXTENSION_SETTINGS_STORAGE_KEY in changes)) {
    return;
  }

  void syncProactiveReminderAlarm();
});

chromeApi?.alarms?.onAlarm?.addListener((alarm) => {
  void notifyForAlarm(alarm);
});

chromeApi?.notifications?.onClicked?.addListener((notificationId) => {
  openOptionsForNotification(notificationId);
});
