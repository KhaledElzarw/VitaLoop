import {
  type AppSettings,
  type ReminderDefinition,
} from "./schemas";

type ReminderId = AppSettings["preferredReminderCategories"][number];
type ReminderIntensity = AppSettings["reminderIntensity"];

type ReminderFrequencyMap = Record<
  ReminderId,
  Record<ReminderIntensity, number>
>;

export type ReminderSchedule = {
  reminder: ReminderDefinition;
  frequencyMinutes: number;
  isAllowedNow: boolean;
  nextAt: Date | null;
};

type ScheduledReminder = ReminderSchedule & {
  nextAt: Date;
};

const reminderFrequencies: ReminderFrequencyMap = {
  hydration: {
    gentle: 120,
    balanced: 90,
    active: 60,
  },
  "eye-strain": {
    gentle: 60,
    balanced: 45,
    active: 30,
  },
  stretch: {
    gentle: 180,
    balanced: 120,
    active: 90,
  },
  "stand-walk": {
    gentle: 90,
    balanced: 60,
    active: 45,
  },
  posture: {
    gentle: 120,
    balanced: 75,
    active: 60,
  },
  "breathing-reset": {
    gentle: 240,
    balanced: 180,
    active: 120,
  },
  "sleep-routine": {
    gentle: 1440,
    balanced: 1440,
    active: 720,
  },
  "mood-energy": {
    gentle: 360,
    balanced: 240,
    active: 180,
  },
};

function parseTimeOfDay(timeOfDay: string) {
  const [hours, minutes] = timeOfDay.split(":").map(Number);

  return hours * 60 + minutes;
}

function getMinuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function isMinuteInWindow(
  minuteOfDay: number,
  startTime: string,
  endTime: string,
) {
  const startMinute = parseTimeOfDay(startTime);
  const endMinute = parseTimeOfDay(endTime);

  if (startMinute === endMinute) {
    return false;
  }

  if (startMinute < endMinute) {
    return minuteOfDay >= startMinute && minuteOfDay < endMinute;
  }

  return minuteOfDay >= startMinute || minuteOfDay < endMinute;
}

function startOfMinute(date: Date) {
  const nextDate = new Date(date);
  nextDate.setSeconds(0, 0);

  return nextDate;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function hasNextAt(schedule: ReminderSchedule): schedule is ScheduledReminder {
  return schedule.nextAt !== null;
}

export function isQuietHoursActive(settings: AppSettings, currentDate: Date) {
  if (!settings.quietHoursEnabled) {
    return false;
  }

  return isMinuteInWindow(
    getMinuteOfDay(currentDate),
    settings.quietHoursStart,
    settings.quietHoursEnd,
  );
}

export function isInsideWorkdayWindow(
  settings: AppSettings,
  currentDate: Date,
) {
  return isMinuteInWindow(
    getMinuteOfDay(currentDate),
    settings.workdayStart,
    settings.workdayEnd,
  );
}

export function isReminderAllowed(settings: AppSettings, currentDate: Date) {
  return (
    !isQuietHoursActive(settings, currentDate) &&
    isInsideWorkdayWindow(settings, currentDate)
  );
}

export function getReminderFrequencyMinutes(
  reminderId: ReminderId,
  reminderIntensity: ReminderIntensity,
) {
  return reminderFrequencies[reminderId][reminderIntensity];
}

export function getEnabledReminders(
  reminderList: ReminderDefinition[],
  settings: AppSettings,
) {
  return reminderList.filter((reminder) =>
    settings.preferredReminderCategories.includes(reminder.id),
  );
}

export function getNextAllowedTime(
  settings: AppSettings,
  currentDate: Date,
) {
  let candidateDate = startOfMinute(currentDate);

  for (
    let checkedMinutes = 0;
    checkedMinutes < 7 * 24 * 60;
    checkedMinutes += 1
  ) {
    if (isReminderAllowed(settings, candidateDate)) {
      return candidateDate;
    }

    candidateDate = addMinutes(candidateDate, 1);
  }

  return null;
}

export function getNextReminderTime(
  reminder: ReminderDefinition,
  settings: AppSettings,
  currentDate: Date,
) {
  if (!settings.preferredReminderCategories.includes(reminder.id)) {
    return null;
  }

  if (!isReminderAllowed(settings, currentDate)) {
    return getNextAllowedTime(settings, currentDate);
  }

  const frequencyMinutes = getReminderFrequencyMinutes(
    reminder.id,
    settings.reminderIntensity,
  );

  return getNextAllowedTime(
    settings,
    addMinutes(startOfMinute(currentDate), frequencyMinutes),
  );
}

export function getReminderSchedule(
  reminder: ReminderDefinition,
  settings: AppSettings,
  currentDate: Date,
): ReminderSchedule {
  return {
    reminder,
    frequencyMinutes: getReminderFrequencyMinutes(
      reminder.id,
      settings.reminderIntensity,
    ),
    isAllowedNow: isReminderAllowed(settings, currentDate),
    nextAt: getNextReminderTime(reminder, settings, currentDate),
  };
}

export function getNextScheduledReminder(
  reminderList: ReminderDefinition[],
  settings: AppSettings,
  currentDate: Date,
) {
  const schedules = getEnabledReminders(reminderList, settings)
    .map((reminder) => getReminderSchedule(reminder, settings, currentDate))
    .filter(hasNextAt);

  return schedules.sort((first, second) => {
    const timeDifference =
      Number(first.nextAt) - Number(second.nextAt);

    if (timeDifference !== 0) {
      return timeDifference;
    }

    return first.reminder.displayPriority - second.reminder.displayPriority;
  })[0];
}

export function formatReminderTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
