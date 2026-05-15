import {
  formatReminderTime,
  getEnabledReminders,
  getNextAllowedTime,
  getReminderSchedule,
  type ReminderSchedule,
} from "./scheduling";
import {
  type AppSettings,
  type ReminderDefinition,
} from "./schemas";

type ReminderId = AppSettings["preferredReminderCategories"][number];

export type ReminderActionType = "done" | "snooze" | "skip-once";

export type ReminderActionState = {
  doneReminderIds: ReminderId[];
  skippedReminderIds: ReminderId[];
  snoozedUntilByReminderId: Partial<Record<ReminderId, Date>>;
};

export type ReminderActionResult = {
  state: ReminderActionState;
  message: string;
};

type ActionAwareSchedule = ReminderSchedule & {
  nextAt: Date;
};

export const SNOOZE_MINUTES = 15;

export function createReminderActionState(): ReminderActionState {
  return {
    doneReminderIds: [],
    skippedReminderIds: [],
    snoozedUntilByReminderId: {},
  };
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addUniqueReminderId(reminderIds: ReminderId[], reminderId: ReminderId) {
  return reminderIds.includes(reminderId)
    ? reminderIds
    : [...reminderIds, reminderId];
}

function isScheduleAvailable(
  schedule: ReminderSchedule,
): schedule is ActionAwareSchedule {
  return schedule.nextAt !== null;
}

function getAdjustedSchedule(
  reminder: ReminderDefinition,
  settings: AppSettings,
  currentDate: Date,
  actionState: ReminderActionState,
) {
  const schedule = getReminderSchedule(reminder, settings, currentDate);
  const snoozedUntil = actionState.snoozedUntilByReminderId[reminder.id];

  if (!schedule.nextAt || !snoozedUntil) {
    return schedule;
  }

  return {
    ...schedule,
    nextAt:
      Number(snoozedUntil) > Number(schedule.nextAt)
        ? snoozedUntil
        : schedule.nextAt,
  };
}

export function getActionAwareNextReminder(
  reminderList: ReminderDefinition[],
  settings: AppSettings,
  currentDate: Date,
  actionState: ReminderActionState,
) {
  const ignoredReminderIds = [
    ...actionState.doneReminderIds,
    ...actionState.skippedReminderIds,
  ];

  return getEnabledReminders(reminderList, settings)
    .filter((reminder) => !ignoredReminderIds.includes(reminder.id))
    .map((reminder) =>
      getAdjustedSchedule(reminder, settings, currentDate, actionState),
    )
    .filter(isScheduleAvailable)
    .sort((first, second) => {
      const timeDifference = Number(first.nextAt) - Number(second.nextAt);

      if (timeDifference !== 0) {
        return timeDifference;
      }

      return first.reminder.displayPriority - second.reminder.displayPriority;
    })[0];
}

export function applyReminderAction(
  actionType: ReminderActionType,
  schedule: ActionAwareSchedule,
  settings: AppSettings,
  currentDate: Date,
  actionState: ReminderActionState,
): ReminderActionResult {
  const reminderId = schedule.reminder.id;

  if (actionType === "done") {
    return {
      state: {
        ...actionState,
        doneReminderIds: addUniqueReminderId(
          actionState.doneReminderIds,
          reminderId,
        ),
      },
      message: `${schedule.reminder.title} marked done. VitaLoop will suggest another gentle nudge.`,
    };
  }

  if (actionType === "skip-once") {
    return {
      state: {
        ...actionState,
        skippedReminderIds: addUniqueReminderId(
          actionState.skippedReminderIds,
          reminderId,
        ),
      },
      message: `${schedule.reminder.title} skipped once. VitaLoop will suggest another option.`,
    };
  }

  const snoozeTarget = getNextAllowedTime(
    settings,
    addMinutes(schedule.nextAt ?? currentDate, SNOOZE_MINUTES),
  );

  if (!snoozeTarget) {
    return {
      state: actionState,
      message: `${schedule.reminder.title} could not be snoozed right now.`,
    };
  }

  return {
    state: {
      ...actionState,
      snoozedUntilByReminderId: {
        ...actionState.snoozedUntilByReminderId,
        [reminderId]: snoozeTarget,
      },
    },
    message: `${schedule.reminder.title} snoozed until ${formatReminderTime(
      snoozeTarget,
    )}.`,
  };
}
