import { reminders } from "../data/reminders";
import {
  getBackgroundReminderNotificationAction,
  handleBackgroundReminderActionWindowAlarm,
  handleBackgroundReminderAlarm,
  PROACTIVE_REMINDER_NOTIFICATION_PREFIX,
  showBackgroundReminderNotification,
  syncBackgroundReminderAlarm,
  type BackgroundReminderActionWindow,
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
import {
  createReminderActionWindowPath,
  type ReminderActionWindowReferenceBounds,
} from "./reminderWindow";

type ChromeEvent<Listener> = {
  addListener: (listener: Listener) => void;
};

type ChromeRuntimeApi = {
  getURL?: (path: string) => string;
  lastError?: {
    message?: string;
  };
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

const ACTION_WINDOW_CREATE_TIMEOUT_MS = 3_000;
const FOCUSED_WINDOW_LOOKUP_TIMEOUT_MS = 1_000;

function getChromeApi() {
  return (
    globalThis as typeof globalThis & {
      chrome?: ChromeBackgroundApi;
    }
  ).chrome;
}

function getRuntimeErrorMessage() {
  return getChromeApi()?.runtime?.lastError?.message;
}

function getReminderActionWindowUrl(currentDate: Date, reminderId: string) {
  const path = createReminderActionWindowPath(currentDate, reminderId);

  return getChromeApi()?.runtime?.getURL?.(path) ?? path;
}

async function getLastFocusedWindow(
  windows: ChromeWindowsApi,
): Promise<ReminderActionWindowReferenceBounds | null> {
  if (!windows.getLastFocused) {
    return null;
  }

  return new Promise((resolve) => {
    let didSettle = false;
    const timeoutId = setTimeout(() => {
      settle(null);
    }, FOCUSED_WINDOW_LOOKUP_TIMEOUT_MS);
    const settle = (window: ReminderActionWindowReferenceBounds | null) => {
      if (didSettle) {
        return;
      }

      didSettle = true;
      clearTimeout(timeoutId);
      resolve(window);
    };

    try {
      const result = windows.getLastFocused?.((window) => settle(window));

      if (result instanceof Promise) {
        void result.then((window) => settle(window)).catch(() => {
          settle(null);
        });
      }
    } catch {
      settle(null);
    }
  });
}

async function openReminderActionWindow(
  windows: ChromeWindowsApi,
  actionWindow: BackgroundReminderActionWindow,
) {
  return new Promise<boolean>((resolve) => {
    let didSettle = false;
    const timeoutId = setTimeout(() => {
      settle(false);
    }, ACTION_WINDOW_CREATE_TIMEOUT_MS);
    const settle = (didOpen: boolean) => {
      if (didSettle) {
        return;
      }

      didSettle = true;
      clearTimeout(timeoutId);
      resolve(didOpen);
    };

    try {
      const result = windows.create(actionWindow.createData, () => {
        settle(!getRuntimeErrorMessage());
      });

      if (result instanceof Promise) {
        void result.then(() => settle(true)).catch(() => {
          settle(false);
        });
      }
    } catch {
      settle(false);
    }
  });
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
    const referenceWindow = await getLastFocusedWindow(chromeApi.windows);
    const actionWindowResult = handleBackgroundReminderActionWindowAlarm({
      alarm,
      alarms: chromeApi.alarms,
      settings,
      reminderList: reminders,
      currentDate,
      referenceWindow,
      createActionWindowUrl: (schedule) =>
        getReminderActionWindowUrl(currentDate, schedule.reminder.id),
    });

    if (!actionWindowResult.actionWindow) {
      return;
    }

    const didOpenActionWindow = await openReminderActionWindow(
      chromeApi.windows,
      actionWindowResult.actionWindow,
    );

    if (didOpenActionWindow || !chromeApi.notifications) {
      return;
    }

    showBackgroundReminderNotification({
      notifications: chromeApi.notifications,
      schedule: actionWindowResult.actionWindow.schedule,
      currentDate,
      notificationIconUrl:
        chromeApi.runtime?.getURL?.(VITALOOP_NOTIFICATION_ICON_URL) ??
        VITALOOP_NOTIFICATION_ICON_URL,
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
