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

export type ActionAwareUpcomingReminder = ActionAwareSchedule & {
  isSnoozed: boolean;
};

export type SnoozedReminderAvailability = {
  reminder: ReminderDefinition;
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

function getIgnoredReminderIds(actionState: ReminderActionState) {
  return [
    ...actionState.doneReminderIds,
    ...actionState.skippedReminderIds,
  ];
}

export function isReminderSnoozed(
  reminderId: ReminderId,
  actionState: ReminderActionState,
  currentDate: Date,
) {
  const snoozedUntil = actionState.snoozedUntilByReminderId[reminderId];

  return Boolean(snoozedUntil && Number(snoozedUntil) > Number(currentDate));
}

export function getActionAvailableReminders(
  reminderList: ReminderDefinition[],
  settings: AppSettings,
  currentDate: Date,
  actionState: ReminderActionState,
) {
  const ignoredReminderIds = getIgnoredReminderIds(actionState);

  return getEnabledReminders(reminderList, settings).filter(
    (reminder) =>
      !ignoredReminderIds.includes(reminder.id) &&
      !isReminderSnoozed(reminder.id, actionState, currentDate),
  );
}

export function getNextSnoozedReminderAvailability(
  reminderList: ReminderDefinition[],
  settings: AppSettings,
  currentDate: Date,
  actionState: ReminderActionState,
): SnoozedReminderAvailability | undefined {
  const ignoredReminderIds = getIgnoredReminderIds(actionState);

  return getEnabledReminders(reminderList, settings)
    .filter((reminder) => !ignoredReminderIds.includes(reminder.id))
    .map((reminder) => ({
      reminder,
      nextAt: actionState.snoozedUntilByReminderId[reminder.id],
    }))
    .filter(
      (
        availability,
      ): availability is SnoozedReminderAvailability =>
        availability.nextAt !== undefined &&
        Number(availability.nextAt) > Number(currentDate),
    )
    .sort((first, second) => {
      const timeDifference = Number(first.nextAt) - Number(second.nextAt);

      if (timeDifference !== 0) {
        return timeDifference;
      }

      return first.reminder.displayPriority - second.reminder.displayPriority;
    })[0];
}

export function getActionAwareNextReminder(
  reminderList: ReminderDefinition[],
  settings: AppSettings,
  currentDate: Date,
  actionState: ReminderActionState,
) {
  return getActionAvailableReminders(
    reminderList,
    settings,
    currentDate,
    actionState,
  )
    .map((reminder) => getReminderSchedule(reminder, settings, currentDate))
    .filter(isScheduleAvailable)
    .sort((first, second) => {
      const timeDifference = Number(first.nextAt) - Number(second.nextAt);

      if (timeDifference !== 0) {
        return timeDifference;
      }

      return first.reminder.displayPriority - second.reminder.displayPriority;
    })[0];
}

export function getActionAwareUpcomingReminders(
  reminderList: ReminderDefinition[],
  settings: AppSettings,
  currentDate: Date,
  actionState: ReminderActionState,
): ActionAwareUpcomingReminder[] {
  const ignoredReminderIds = getIgnoredReminderIds(actionState);

  return getEnabledReminders(reminderList, settings)
    .filter((reminder) => !ignoredReminderIds.includes(reminder.id))
    .map((reminder): ActionAwareUpcomingReminder | undefined => {
      const snoozedUntil = actionState.snoozedUntilByReminderId[reminder.id];
      const schedule = getReminderSchedule(reminder, settings, currentDate);

      if (snoozedUntil && Number(snoozedUntil) > Number(currentDate)) {
        return {
          ...schedule,
          nextAt: snoozedUntil,
          isSnoozed: true,
        };
      }

      if (!isScheduleAvailable(schedule)) {
        return undefined;
      }

      return {
        ...schedule,
        nextAt: schedule.nextAt,
        isSnoozed: false,
      };
    })
    .filter(
      (
        schedule,
      ): schedule is ActionAwareUpcomingReminder => schedule !== undefined,
    )
    .sort((first, second) => {
      const timeDifference = Number(first.nextAt) - Number(second.nextAt);

      if (timeDifference !== 0) {
        return timeDifference;
      }

      return first.reminder.displayPriority - second.reminder.displayPriority;
    });
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
