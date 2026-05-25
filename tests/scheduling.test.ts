import { describe, expect, it, vi } from "vitest";
import { reminders } from "../src/data/reminders";
import {
  formatReminderCountdown,
  getNextReminderTime,
  getNextScheduledReminder,
  getReminderFrequencyMinutes,
  isInsideWorkdayWindow,
  isQuietHoursActive,
  isReminderAllowed,
} from "../src/domain/scheduling";
import { type AppSettings } from "../src/domain/schemas";
import { getDefaultAppSettings } from "../src/domain/settings";

function createSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...getDefaultAppSettings(),
    ...overrides,
    preferredReminderCategories:
      overrides.preferredReminderCategories ??
      getDefaultAppSettings().preferredReminderCategories,
  };
}

function findReminder(reminderId: AppSettings["preferredReminderCategories"][number]) {
  const reminder = reminders.find((item) => item.id === reminderId);

  if (!reminder) {
    throw new Error(`Missing reminder fixture: ${reminderId}`);
  }

  return reminder;
}

describe("reminder scheduling", () => {
  it("blocks reminders during quiet hours", () => {
    const settings = createSettings({
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      workdayStart: "00:00",
      workdayEnd: "23:59",
    });
    const currentDate = new Date(2026, 0, 1, 23, 0);

    expect(isQuietHoursActive(settings, currentDate)).toBe(true);
    expect(isReminderAllowed(settings, currentDate)).toBe(false);
  });

  it("treats quiet-hours start as blocked and end as available", () => {
    const settings = createSettings({
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      workdayStart: "00:00",
      workdayEnd: "23:59",
    });
    const quietHoursStart = new Date(2026, 0, 1, 22, 0);
    const quietHoursEnd = new Date(2026, 0, 2, 7, 0);

    expect(isQuietHoursActive(settings, quietHoursStart)).toBe(true);
    expect(isReminderAllowed(settings, quietHoursStart)).toBe(false);
    expect(isQuietHoursActive(settings, quietHoursEnd)).toBe(false);
    expect(isReminderAllowed(settings, quietHoursEnd)).toBe(true);
  });

  it("blocks reminders outside the workday window", () => {
    const settings = createSettings({
      quietHoursEnabled: false,
      workdayStart: "09:00",
      workdayEnd: "18:00",
    });
    const currentDate = new Date(2026, 0, 1, 8, 30);

    expect(isInsideWorkdayWindow(settings, currentDate)).toBe(false);
    expect(isReminderAllowed(settings, currentDate)).toBe(false);
  });

  it("treats workday start as available and end as outside the window", () => {
    const settings = createSettings({
      quietHoursEnabled: false,
      workdayStart: "09:00",
      workdayEnd: "18:00",
    });
    const workdayStart = new Date(2026, 0, 1, 9, 0);
    const workdayEnd = new Date(2026, 0, 1, 18, 0);

    expect(isInsideWorkdayWindow(settings, workdayStart)).toBe(true);
    expect(isReminderAllowed(settings, workdayStart)).toBe(true);
    expect(isInsideWorkdayWindow(settings, workdayEnd)).toBe(false);
    expect(isReminderAllowed(settings, workdayEnd)).toBe(false);
  });

  it("changes frequency by reminder intensity", () => {
    expect(getReminderFrequencyMinutes("hydration", "gentle")).toBeGreaterThan(
      getReminderFrequencyMinutes("hydration", "balanced"),
    );
    expect(getReminderFrequencyMinutes("hydration", "active")).toBeLessThan(
      getReminderFrequencyMinutes("hydration", "balanced"),
    );
  });

  it("calculates the next reminder time", () => {
    const settings = createSettings({
      quietHoursEnabled: false,
      reminderIntensity: "balanced",
      workdayStart: "09:00",
      workdayEnd: "18:00",
    });

    expect(
      getNextReminderTime(
        findReminder("hydration"),
        settings,
        new Date(2026, 0, 1, 10, 0),
      ),
    ).toEqual(new Date(2026, 0, 1, 11, 30));
  });

  it("formats reminder countdowns", () => {
    const currentDate = new Date(2026, 0, 1, 10, 0);

    expect(formatReminderCountdown(currentDate, currentDate)).toBe("Due now");
    expect(
      formatReminderCountdown(new Date(2026, 0, 1, 10, 45), currentDate),
    ).toBe("45 min");
    expect(
      formatReminderCountdown(new Date(2026, 0, 1, 12, 15), currentDate),
    ).toBe("2 hrs 15 min");
  });

  it("handles overnight quiet hours", () => {
    const settings = createSettings({
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      workdayStart: "09:00",
      workdayEnd: "18:00",
    });

    expect(isQuietHoursActive(settings, new Date(2026, 0, 1, 23, 0))).toBe(
      true,
    );
    expect(
      getNextReminderTime(
        findReminder("hydration"),
        settings,
        new Date(2026, 0, 1, 23, 0),
      ),
    ).toEqual(new Date(2026, 0, 2, 9, 0));
  });

  it("handles same-day quiet hours", () => {
    const settings = createSettings({
      quietHoursEnabled: true,
      quietHoursStart: "12:00",
      quietHoursEnd: "13:00",
      workdayStart: "09:00",
      workdayEnd: "18:00",
    });

    expect(isQuietHoursActive(settings, new Date(2026, 0, 1, 12, 30))).toBe(
      true,
    );
    expect(
      getNextReminderTime(
        findReminder("hydration"),
        settings,
        new Date(2026, 0, 1, 12, 30),
      ),
    ).toEqual(new Date(2026, 0, 1, 13, 0));
  });

  it("ignores disabled reminder categories", () => {
    const settings = createSettings({
      quietHoursEnabled: false,
      workdayStart: "09:00",
      workdayEnd: "18:00",
      preferredReminderCategories: ["hydration"],
    });
    const nextSchedule = getNextScheduledReminder(
      reminders,
      settings,
      new Date(2026, 0, 1, 10, 0),
    );

    expect(nextSchedule?.reminder.id).toBe("hydration");
    expect(nextSchedule?.nextAt).toEqual(new Date(2026, 0, 1, 11, 30));
  });

  it("does not select unpreferred categories even when they are due sooner", () => {
    const settings = createSettings({
      quietHoursEnabled: false,
      workdayStart: "09:00",
      workdayEnd: "18:00",
      preferredReminderCategories: ["mood-energy"],
    });
    const currentDate = new Date(2026, 0, 1, 10, 0);
    const nextSchedule = getNextScheduledReminder(
      reminders,
      settings,
      currentDate,
    );

    expect(
      getNextReminderTime(findReminder("hydration"), settings, currentDate),
    ).toBeNull();
    expect(nextSchedule?.reminder.id).toBe("mood-energy");
    expect(nextSchedule?.nextAt).toEqual(new Date(2026, 0, 1, 14, 0));
  });

  it("uses custom reminder frequency without applying intensity", () => {
    const customReminder = {
      id: "custom-123e4567-e89b-42d3-a456-426614174000",
      title: "Desk reset",
      category: "Custom",
      description: "Reset your desk and posture.",
      suggestedFrequency: "Every 25 minutes",
      enabledByDefault: true,
      wellnessIntent: "Reset your desk and posture.",
      displayPriority: 9,
      schedule: {
        type: "interval",
        intervalMinutes: 25,
      },
      respectReminderWindows: true,
    } as const;
    const settings = createSettings({
      quietHoursEnabled: false,
      reminderIntensity: "active",
      preferredReminderCategories: [customReminder.id],
      customReminders: [customReminder],
    });
    const nextSchedule = getNextScheduledReminder(
      [customReminder],
      settings,
      new Date(2026, 0, 1, 10, 0),
    );

    expect(getReminderFrequencyMinutes(customReminder, "gentle")).toBe(25);
    expect(nextSchedule?.reminder.id).toBe(customReminder.id);
    expect(nextSchedule?.frequencyMinutes).toBe(25);
    expect(nextSchedule?.nextAt).toEqual(new Date(2026, 0, 1, 10, 25));
  });

  it("schedules custom day interval reminders from their start date", () => {
    const customReminder = {
      id: "custom-123e4567-e89b-42d3-a456-426614174000",
      title: "Pay bills",
      category: "Life admin",
      description: "Review upcoming bills and payments.",
      suggestedFrequency: "Every 2 days at 9:00 AM",
      enabledByDefault: true,
      wellnessIntent: "Review upcoming bills and payments.",
      displayPriority: 9,
      schedule: {
        type: "dailyInterval",
        dayIntervalDays: 2,
        timeOfDay: "09:00",
        startDate: "2026-01-01",
      },
      respectReminderWindows: true,
    } as const;
    const settings = createSettings({
      quietHoursEnabled: false,
      workdayStart: "00:00",
      workdayEnd: "23:59",
      preferredReminderCategories: [customReminder.id],
      customReminders: [customReminder],
    });

    expect(
      getNextReminderTime(customReminder, settings, new Date(2026, 0, 2, 10, 0)),
    ).toEqual(new Date(2026, 0, 3, 9, 0));
  });

  it("schedules custom weekday and one-time reminders", () => {
    const weekdayReminder = {
      id: "custom-123e4567-e89b-42d3-a456-426614174000",
      title: "Water plants",
      category: "Home",
      description: "Check plant soil.",
      suggestedFrequency: "Monday at 8:30 AM",
      enabledByDefault: true,
      wellnessIntent: "Check plant soil.",
      displayPriority: 9,
      schedule: {
        type: "weekdayInterval" as const,
        weekdays: ["monday" as const],
        timeOfDay: "08:30",
      },
      respectReminderWindows: false,
    };
    const oneTimeReminder = {
      ...weekdayReminder,
      id: "custom-123e4567-e89b-42d3-a456-426614174001",
      title: "Appointment prep",
      schedule: {
        type: "oneTime" as const,
        date: "2026-01-05",
        timeOfDay: "07:30",
      },
    };
    const settings = createSettings({
      quietHoursEnabled: true,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      workdayStart: "09:00",
      workdayEnd: "17:00",
      preferredReminderCategories: [weekdayReminder.id, oneTimeReminder.id],
      customReminders: [weekdayReminder, oneTimeReminder],
    });

    expect(
      getNextReminderTime(
        weekdayReminder,
        settings,
        new Date(2026, 0, 2, 10, 0),
      ),
    ).toEqual(new Date(2026, 0, 5, 8, 30));
    expect(
      getNextReminderTime(
        oneTimeReminder,
        settings,
        new Date(2026, 0, 2, 10, 0),
      ),
    ).toEqual(new Date(2026, 0, 5, 7, 30));
  });

  it("does not depend on live timers", () => {
    const nowSpy = vi.spyOn(Date, "now");

    getNextScheduledReminder(
      reminders,
      createSettings(),
      new Date(2026, 0, 1, 10, 0),
    );

    expect(nowSpy).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });
});
