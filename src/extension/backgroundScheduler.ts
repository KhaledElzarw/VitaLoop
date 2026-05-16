import { reminders as defaultReminders } from "../data/reminders";
import {
  getActionAvailableReminders,
  getNextSnoozedReminderAvailability,
  type ReminderActionState,
} from "../domain/reminderActions";
import {
  getNextAllowedTime,
  getNextScheduledReminder,
  getReminderFrequencyMinutes,
  isReminderAllowed,
  type ReminderSchedule,
} from "../domain/scheduling";
import { type ReminderDefinition } from "../domain/schemas";
import {
  createReminderNotificationCopy,
  VITALOOP_NOTIFICATION_ICON_URL,
} from "./notificationCopy";
import {
  getExtensionReminderActionState,
  type ExtensionSettings,
} from "./extensionSettingsStorage";

export const PROACTIVE_REMINDER_ALARM_NAME = "vitaloop.proactiveReminder";
export const PROACTIVE_REMINDER_NOTIFICATION_PREFIX = "vitaloop-reminder";

type ChromeAlarmCreateInfo = {
  delayInMinutes: number;
  periodInMinutes: number;
};

export type ChromeAlarm = {
  name: string;
};

export type ChromeAlarmsApi = {
  create: (name: string, alarmInfo: ChromeAlarmCreateInfo) => void;
  clear: (name: string) => void;
};

export type ChromeNotificationOptions = {
  type: "basic";
  iconUrl: string;
  title: string;
  message: string;
  contextMessage: string;
};

export type ChromeNotificationsApi = {
  create: (notificationId: string, options: ChromeNotificationOptions) => void;
};

export type BackgroundReminderAlarmPlan =
  | {
      action: "create";
      alarmName: typeof PROACTIVE_REMINDER_ALARM_NAME;
      alarmInfo: ChromeAlarmCreateInfo;
      schedule: ReminderSchedule & { nextAt: Date };
    }
  | {
      action: "clear";
      alarmName: typeof PROACTIVE_REMINDER_ALARM_NAME;
      reason: "disabled" | "no-eligible-reminders";
    };

export type BackgroundReminderNotification = {
  id: string;
  options: ChromeNotificationOptions;
  schedule: ReminderSchedule & { nextAt: Date };
};

type SchedulerOptions = {
  settings: ExtensionSettings;
  reminderList?: ReminderDefinition[];
  currentDate: Date;
  actionState?: ReminderActionState;
};

type AlarmSyncOptions = SchedulerOptions & {
  alarms: ChromeAlarmsApi;
};

type AlarmHandlerOptions = AlarmSyncOptions & {
  alarm: ChromeAlarm;
  notifications: ChromeNotificationsApi;
};

function getDelayInMinutes(nextAt: Date, currentDate: Date) {
  const delayInMinutes = Math.ceil(
    (Number(nextAt) - Number(currentDate)) / 60_000,
  );

  return Math.max(1, delayInMinutes);
}

function getSortedEligibleReminders(
  reminderList: ReminderDefinition[],
  settings: ExtensionSettings,
) {
  return reminderList.sort((first, second) => {
    const frequencyDifference =
      getReminderFrequencyMinutes(first.id, settings.reminderIntensity) -
      getReminderFrequencyMinutes(second.id, settings.reminderIntensity);

    if (frequencyDifference !== 0) {
      return frequencyDifference;
    }

    return first.displayPriority - second.displayPriority;
  });
}

function getSchedulerActionState(
  settings: ExtensionSettings,
  actionState?: ReminderActionState,
) {
  return actionState ?? getExtensionReminderActionState(settings);
}

export function getBackgroundReminderAlarmPlan({
  settings,
  reminderList = defaultReminders,
  currentDate,
  actionState,
}: SchedulerOptions): BackgroundReminderAlarmPlan {
  if (!settings.proactiveRemindersEnabled) {
    return {
      action: "clear",
      alarmName: PROACTIVE_REMINDER_ALARM_NAME,
      reason: "disabled",
    };
  }

  const resolvedActionState = getSchedulerActionState(settings, actionState);
  const availableReminders = getActionAvailableReminders(
    reminderList,
    settings,
    currentDate,
    resolvedActionState,
  );
  const schedule = getNextScheduledReminder(
    availableReminders,
    settings,
    currentDate,
  );

  if (!schedule) {
    const snoozedReminder = getNextSnoozedReminderAvailability(
      reminderList,
      settings,
      currentDate,
      resolvedActionState,
    );

    if (snoozedReminder) {
      const nextAt =
        getNextAllowedTime(settings, snoozedReminder.nextAt) ??
        snoozedReminder.nextAt;
      const frequencyMinutes = getReminderFrequencyMinutes(
        snoozedReminder.reminder.id,
        settings.reminderIntensity,
      );

      return {
        action: "create",
        alarmName: PROACTIVE_REMINDER_ALARM_NAME,
        alarmInfo: {
          delayInMinutes: getDelayInMinutes(nextAt, currentDate),
          periodInMinutes: frequencyMinutes,
        },
        schedule: {
          reminder: snoozedReminder.reminder,
          frequencyMinutes,
          isAllowedNow: false,
          nextAt,
        },
      };
    }

    return {
      action: "clear",
      alarmName: PROACTIVE_REMINDER_ALARM_NAME,
      reason: "no-eligible-reminders",
    };
  }

  return {
    action: "create",
    alarmName: PROACTIVE_REMINDER_ALARM_NAME,
    alarmInfo: {
      delayInMinutes: getDelayInMinutes(schedule.nextAt, currentDate),
      periodInMinutes: schedule.frequencyMinutes,
    },
    schedule,
  };
}

export function syncBackgroundReminderAlarm({
  alarms,
  settings,
  reminderList = defaultReminders,
  currentDate,
  actionState,
}: AlarmSyncOptions) {
  const plan = getBackgroundReminderAlarmPlan({
    settings,
    reminderList,
    currentDate,
    actionState,
  });

  if (plan.action === "clear") {
    alarms.clear(PROACTIVE_REMINDER_ALARM_NAME);
    return plan;
  }

  alarms.create(PROACTIVE_REMINDER_ALARM_NAME, plan.alarmInfo);
  return plan;
}

export function getNotificationReminderSchedule({
  settings,
  reminderList = defaultReminders,
  currentDate,
  actionState,
}: SchedulerOptions) {
  if (
    !settings.proactiveRemindersEnabled ||
    !isReminderAllowed(settings, currentDate)
  ) {
    return null;
  }

  const reminder = getSortedEligibleReminders(
    getActionAvailableReminders(
      reminderList,
      settings,
      currentDate,
      getSchedulerActionState(settings, actionState),
    ),
    settings,
  )[0];

  if (!reminder) {
    return null;
  }

  return {
    reminder,
    frequencyMinutes: getReminderFrequencyMinutes(
      reminder.id,
      settings.reminderIntensity,
    ),
    isAllowedNow: true,
    nextAt: currentDate,
  };
}

export function createBackgroundReminderNotification(
  schedule: ReminderSchedule & { nextAt: Date },
  currentDate: Date,
): BackgroundReminderNotification {
  const copy = createReminderNotificationCopy(schedule.reminder);
  const id = `${PROACTIVE_REMINDER_NOTIFICATION_PREFIX}-${schedule.reminder.id}-${currentDate.getTime()}`;

  return {
    id,
    options: {
      type: "basic",
      iconUrl: VITALOOP_NOTIFICATION_ICON_URL,
      title: copy.title,
      message: copy.message,
      contextMessage: copy.contextMessage,
    },
    schedule,
  };
}

export function showBackgroundReminderNotification({
  notifications,
  schedule,
  currentDate,
}: {
  notifications: ChromeNotificationsApi;
  schedule: ReminderSchedule & { nextAt: Date };
  currentDate: Date;
}) {
  const notification = createBackgroundReminderNotification(
    schedule,
    currentDate,
  );

  notifications.create(notification.id, notification.options);

  return notification;
}

export function handleBackgroundReminderAlarm({
  alarm,
  alarms,
  notifications,
  settings,
  reminderList = defaultReminders,
  currentDate,
  actionState,
}: AlarmHandlerOptions) {
  if (alarm.name !== PROACTIVE_REMINDER_ALARM_NAME) {
    return {
      alarmPlan: null,
      notification: null,
    };
  }

  const alarmPlan = syncBackgroundReminderAlarm({
    alarms,
    settings,
    reminderList,
    currentDate,
    actionState,
  });
  const schedule = getNotificationReminderSchedule({
    settings,
    reminderList,
    currentDate,
    actionState,
  });

  if (!schedule) {
    return {
      alarmPlan,
      notification: null,
    };
  }

  return {
    alarmPlan,
    notification: showBackgroundReminderNotification({
      notifications,
      schedule,
      currentDate,
    }),
  };
}
