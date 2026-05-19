import { reminders as defaultReminders } from "../data/reminders";
import {
  applyReminderAction,
  getActionAvailableReminders,
  getNextSnoozedReminderAvailability,
  type ReminderActionResult,
  type ReminderActionState,
  type ReminderActionType,
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
  withExtensionReminderActionState,
} from "./extensionSettingsStorage";

export const PROACTIVE_REMINDER_ALARM_NAME = "vitaloop.proactiveReminder";
export const PROACTIVE_REMINDER_NOTIFICATION_PREFIX = "vitaloop-reminder";

const reminderNotificationButtonActions = [
  { actionType: "done", title: "Done" },
  { actionType: "snooze", title: "Snooze" },
] as const satisfies ReadonlyArray<{
  actionType: ReminderActionType;
  title: string;
}>;

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
  buttons?: ChromeNotificationButton[];
};

export type ChromeNotificationButton = {
  title: string;
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

export type BackgroundReminderNotificationAction =
  | {
      action: "apply";
      actionType: ReminderActionType;
      result: ReminderActionResult;
      updatedSettings: ExtensionSettings;
      shouldPersistSettings: boolean;
    }
  | {
      action: "ignore";
      reason:
        | "unsupported-button"
        | "unrelated-notification"
        | "unknown-reminder";
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
  notificationIconUrl?: string;
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

function createNotificationButtons(): ChromeNotificationButton[] {
  return reminderNotificationButtonActions.map(({ title }) => ({ title }));
}

function getReminderIdFromNotificationId(
  notificationId: string,
  reminderList: ReminderDefinition[],
) {
  if (!notificationId.startsWith(`${PROACTIVE_REMINDER_NOTIFICATION_PREFIX}-`)) {
    return null;
  }

  return (
    [...reminderList]
      .sort((first, second) => second.id.length - first.id.length)
      .find((reminder) =>
        notificationId.startsWith(
          `${PROACTIVE_REMINDER_NOTIFICATION_PREFIX}-${reminder.id}-`,
        ),
      )?.id ?? null
  );
}

export function getReminderNotificationButtonAction(
  buttonIndex: number,
): ReminderActionType | null {
  return reminderNotificationButtonActions[buttonIndex]?.actionType ?? null;
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
  notificationIconUrl = VITALOOP_NOTIFICATION_ICON_URL,
): BackgroundReminderNotification {
  const copy = createReminderNotificationCopy(schedule.reminder);
  const id = `${PROACTIVE_REMINDER_NOTIFICATION_PREFIX}-${schedule.reminder.id}-${currentDate.getTime()}`;

  return {
    id,
    options: {
      type: "basic",
      iconUrl: notificationIconUrl,
      title: copy.title,
      message: copy.message,
      contextMessage: copy.contextMessage,
      buttons: createNotificationButtons(),
    },
    schedule,
  };
}

export function showBackgroundReminderNotification({
  notifications,
  schedule,
  currentDate,
  notificationIconUrl,
}: {
  notifications: ChromeNotificationsApi;
  schedule: ReminderSchedule & { nextAt: Date };
  currentDate: Date;
  notificationIconUrl?: string;
}) {
  const notification = createBackgroundReminderNotification(
    schedule,
    currentDate,
    notificationIconUrl,
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
  notificationIconUrl,
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
      notificationIconUrl,
    }),
  };
}

export function getBackgroundReminderNotificationAction({
  notificationId,
  buttonIndex,
  settings,
  reminderList = defaultReminders,
  currentDate,
  actionState,
}: SchedulerOptions & {
  notificationId: string;
  buttonIndex: number;
}): BackgroundReminderNotificationAction {
  const actionType = getReminderNotificationButtonAction(buttonIndex);

  if (!actionType) {
    return {
      action: "ignore",
      reason: "unsupported-button",
    };
  }

  const reminderId = getReminderIdFromNotificationId(
    notificationId,
    reminderList,
  );

  if (!reminderId) {
    return {
      action: "ignore",
      reason: "unrelated-notification",
    };
  }

  const reminder = reminderList.find(
    (candidateReminder) => candidateReminder.id === reminderId,
  );

  if (!reminder) {
    return {
      action: "ignore",
      reason: "unknown-reminder",
    };
  }

  const result = applyReminderAction(
    actionType,
    {
      reminder,
      frequencyMinutes: getReminderFrequencyMinutes(
        reminder.id,
        settings.reminderIntensity,
      ),
      isAllowedNow: true,
      nextAt: currentDate,
    },
    settings,
    currentDate,
    getSchedulerActionState(settings, actionState),
  );

  return {
    action: "apply",
    actionType,
    result,
    updatedSettings: withExtensionReminderActionState(settings, result.state),
    shouldPersistSettings: actionType === "snooze",
  };
}
