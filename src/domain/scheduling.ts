import {
  type AppSettings,
  type BuiltinReminderId,
  type ReminderDefinition,
} from "./schemas";

type ReminderId = AppSettings["preferredReminderCategories"][number];
type ReminderIntensity = AppSettings["reminderIntensity"];

type ReminderFrequencyMap = Record<
  BuiltinReminderId,
  Record<ReminderIntensity, number>
>;

export type ReminderSchedule = {
  reminder: ReminderDefinition;
  frequencyMinutes: number;
  isAllowedNow: boolean;
  nextAt: Date | null;
};

function isBuiltinReminderId(reminderId: ReminderId): reminderId is BuiltinReminderId {
  return reminderId in reminderFrequencies;
}

type ScheduledReminder = ReminderSchedule & {
  nextAt: Date;
};

const minuteInMilliseconds = 60_000;

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
  return new Date(date.getTime() + minutes * minuteInMilliseconds);
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
  reminderOrId: ReminderDefinition | ReminderId,
  reminderIntensity: ReminderIntensity,
) {
  const reminderId =
    typeof reminderOrId === "string" ? reminderOrId : reminderOrId.id;

  if (typeof reminderOrId !== "string" && reminderOrId.customFrequencyMinutes) {
    return reminderOrId.customFrequencyMinutes;
  }

  if (isBuiltinReminderId(reminderId)) {
    return reminderFrequencies[reminderId][reminderIntensity];
  }

  return 60;
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
    reminder,
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
      reminder,
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

function formatCountdownUnit(
  value: number,
  singularUnit: string,
  pluralUnit = `${singularUnit}s`,
) {
  return `${value} ${value === 1 ? singularUnit : pluralUnit}`;
}

export function formatReminderCountdown(nextAt: Date, currentDate: Date) {
  const remainingMinutes = Math.max(
    0,
    Math.ceil((Number(nextAt) - Number(currentDate)) / minuteInMilliseconds),
  );

  if (remainingMinutes === 0) {
    return "Due now";
  }

  if (remainingMinutes < 60) {
    return formatCountdownUnit(remainingMinutes, "min", "min");
  }

  const remainingHours = Math.floor(remainingMinutes / 60);
  const minutesAfterHours = remainingMinutes % 60;

  if (remainingHours < 24) {
    const hourText = formatCountdownUnit(remainingHours, "hr");

    return minutesAfterHours > 0
      ? `${hourText} ${formatCountdownUnit(minutesAfterHours, "min", "min")}`
      : hourText;
  }

  const remainingDays = Math.floor(remainingHours / 24);
  const hoursAfterDays = remainingHours % 24;
  const dayText = formatCountdownUnit(remainingDays, "day");

  return hoursAfterDays > 0
    ? `${dayText} ${formatCountdownUnit(hoursAfterDays, "hr")}`
    : dayText;
}
