import { reminders } from "../data/reminders";
import {
  getBackgroundReminderNotificationAction,
  handleBackgroundReminderActionWindowAlarm,
  handleBackgroundReminderAlarm,
  PROACTIVE_REMINDER_NOTIFICATION_PREFIX,
  syncBackgroundReminderAlarm,
  type ChromeAlarm,
  type ChromeAlarmsApi,
  type ChromeNotificationsApi,
  type ChromeWindowsApi,
} from "./backgroundScheduler";
import {
  EXTENSION_SETTINGS_STORAGE_KEY,
  loadExtensionSettings,
  saveExtensionSettings,
} from "./extensionSettingsStorage";
import { VITALOOP_NOTIFICATION_ICON_URL } from "./notificationCopy";
import { createReminderActionWindowPath } from "./reminderWindow";

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
    onButtonClicked?: ChromeEvent<
      (notificationId: string, buttonIndex: number) => void
    >;
  };
  runtime?: ChromeRuntimeApi;
  storage?: {
    onChanged?: ChromeEvent<
      (changes: Record<string, ChromeStorageChange>, areaName: string) => void
    >;
  };
  windows?: ChromeWindowsApi;
};

function getChromeApi() {
  return (
    globalThis as typeof globalThis & {
      chrome?: ChromeBackgroundApi;
    }
  ).chrome;
}

function getReminderActionWindowUrl(currentDate: Date, reminderId: string) {
  const path = createReminderActionWindowPath(currentDate, reminderId);

  return getChromeApi()?.runtime?.getURL?.(path) ?? path;
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

  if (!chromeApi?.alarms) {
    return;
  }

  const currentDate = new Date();
  const settings = await loadExtensionSettings();

  if (chromeApi.windows) {
    handleBackgroundReminderActionWindowAlarm({
      alarm,
      alarms: chromeApi.alarms,
      windows: chromeApi.windows,
      settings,
      reminderList: reminders,
      currentDate,
      createActionWindowUrl: (schedule) =>
        getReminderActionWindowUrl(currentDate, schedule.reminder.id),
    });
    return;
  }

  if (!chromeApi.notifications) {
    return;
  }

  handleBackgroundReminderAlarm({
    alarm,
    alarms: chromeApi.alarms,
    notifications: chromeApi.notifications,
    settings,
    reminderList: reminders,
    currentDate,
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

async function handleNotificationButton(
  notificationId: string,
  buttonIndex: number,
) {
  const chromeApi = getChromeApi();

  if (!chromeApi?.alarms || !chromeApi.notifications) {
    return;
  }

  const currentDate = new Date();
  const settings = await loadExtensionSettings();
  const notificationAction = getBackgroundReminderNotificationAction({
    notificationId,
    buttonIndex,
    settings,
    reminderList: reminders,
    currentDate,
  });

  if (notificationAction.action === "ignore") {
    return;
  }

  chromeApi.notifications.clear?.(notificationId);

  if (!notificationAction.shouldPersistSettings) {
    return;
  }

  const didSave = await saveExtensionSettings(
    notificationAction.updatedSettings,
  );

  if (!didSave) {
    return;
  }

  syncBackgroundReminderAlarm({
    alarms: chromeApi.alarms,
    settings: notificationAction.updatedSettings,
    reminderList: reminders,
    currentDate: new Date(),
  });
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

chromeApi?.notifications?.onButtonClicked?.addListener(
  (notificationId, buttonIndex) => {
    void handleNotificationButton(notificationId, buttonIndex);
  },
);
