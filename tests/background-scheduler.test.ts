import { describe, expect, it, vi } from "vitest";
import { reminders } from "../src/data/reminders";
import {
  getBackgroundReminderNotificationAction,
  getBackgroundReminderAlarmPlan,
  getNotificationReminderSchedule,
  getReminderNotificationButtonAction,
  handleBackgroundReminderActionWindowAlarm,
  handleBackgroundReminderAlarm,
  PROACTIVE_REMINDER_ALARM_NAME,
  syncBackgroundReminderAlarm,
  type ChromeAlarmsApi,
  type ChromeNotificationsApi,
  type ChromeWindowsApi,
} from "../src/extension/backgroundScheduler";
import {
  REMINDER_ACTION_WINDOW_HEIGHT,
  REMINDER_ACTION_WINDOW_WIDTH,
} from "../src/extension/reminderWindow";
import {
  getDefaultExtensionSettings,
  type ExtensionSettings,
} from "../src/extension/extensionSettingsStorage";

function createSettings(
  overrides: Partial<ExtensionSettings> = {},
): ExtensionSettings {
  return {
    ...getDefaultExtensionSettings(),
    ...overrides,
    preferredReminderCategories:
      overrides.preferredReminderCategories ??
      getDefaultExtensionSettings().preferredReminderCategories,
  };
}

function createChromeMocks(): {
  alarms: ChromeAlarmsApi;
  notifications: ChromeNotificationsApi;
  windows: ChromeWindowsApi;
} {
  return {
    alarms: {
      create: vi.fn<ChromeAlarmsApi["create"]>(),
      clear: vi.fn<ChromeAlarmsApi["clear"]>(),
    },
    notifications: {
      create: vi.fn<ChromeNotificationsApi["create"]>(),
    },
    windows: {
      create: vi.fn<ChromeWindowsApi["create"]>(),
    },
  };
}

describe("background reminder scheduler", () => {
  it("creates the named repeating alarm when proactive reminders are enabled", () => {
    const { alarms } = createChromeMocks();

    const plan = syncBackgroundReminderAlarm({
      alarms,
      settings: createSettings({ proactiveRemindersEnabled: true }),
      reminderList: reminders,
      currentDate: new Date(2026, 4, 15, 10, 0),
    });

    expect(plan.action).toBe("create");
    expect(alarms.create).toHaveBeenCalledWith(PROACTIVE_REMINDER_ALARM_NAME, {
      delayInMinutes: 45,
      periodInMinutes: 45,
    });
    expect(alarms.clear).not.toHaveBeenCalled();
  });

  it("clears the named alarm when proactive reminders are disabled", () => {
    const { alarms } = createChromeMocks();

    const plan = syncBackgroundReminderAlarm({
      alarms,
      settings: createSettings({ proactiveRemindersEnabled: false }),
      reminderList: reminders,
      currentDate: new Date(2026, 4, 15, 10, 0),
    });

    expect(plan).toEqual({
      action: "clear",
      alarmName: PROACTIVE_REMINDER_ALARM_NAME,
      reason: "disabled",
    });
    expect(alarms.clear).toHaveBeenCalledWith(PROACTIVE_REMINDER_ALARM_NAME);
    expect(alarms.create).not.toHaveBeenCalled();
  });

  it("respects quiet hours before creating a notification", () => {
    const settings = createSettings({
      proactiveRemindersEnabled: true,
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      workdayStart: "00:00",
      workdayEnd: "23:59",
    });
    const currentDate = new Date(2026, 4, 15, 23, 0);
    const plan = getBackgroundReminderAlarmPlan({
      settings,
      reminderList: reminders,
      currentDate,
    });

    expect(plan.action).toBe("create");
    expect(plan.action === "create" ? plan.alarmInfo.delayInMinutes : 0).toBe(
      480,
    );
    expect(
      getNotificationReminderSchedule({
        settings,
        reminderList: reminders,
        currentDate,
      }),
    ).toBeNull();
  });

  it("respects the workday window before creating a notification", () => {
    const settings = createSettings({
      proactiveRemindersEnabled: true,
      quietHoursEnabled: false,
      workdayStart: "09:00",
      workdayEnd: "17:00",
    });
    const currentDate = new Date(2026, 4, 15, 8, 30);
    const plan = getBackgroundReminderAlarmPlan({
      settings,
      reminderList: reminders,
      currentDate,
    });

    expect(plan.action).toBe("create");
    expect(plan.action === "create" ? plan.alarmInfo.delayInMinutes : 0).toBe(
      30,
    );
    expect(
      getNotificationReminderSchedule({
        settings,
        reminderList: reminders,
        currentDate,
      }),
    ).toBeNull();
  });

  it("ignores unpreferred reminder categories", () => {
    const settings = createSettings({
      proactiveRemindersEnabled: true,
      quietHoursEnabled: false,
      workdayStart: "09:00",
      workdayEnd: "18:00",
      preferredReminderCategories: ["stretch"],
    });
    const currentDate = new Date(2026, 4, 15, 10, 0);
    const plan = getBackgroundReminderAlarmPlan({
      settings,
      reminderList: reminders,
      currentDate,
    });
    const notificationSchedule = getNotificationReminderSchedule({
      settings,
      reminderList: reminders,
      currentDate,
    });

    expect(plan.action === "create" ? plan.schedule.reminder.id : null).toBe(
      "stretch",
    );
    expect(plan.action === "create" ? plan.alarmInfo.periodInMinutes : 0).toBe(
      120,
    );
    expect(notificationSchedule?.reminder.id).toBe("stretch");
  });

  it("does not notify for snoozed reminders before snoozedUntil", () => {
    const { alarms, notifications } = createChromeMocks();
    const settings = createSettings({
      proactiveRemindersEnabled: true,
      quietHoursEnabled: false,
      workdayStart: "09:00",
      workdayEnd: "18:00",
      preferredReminderCategories: ["eye-strain"],
      snoozedUntilByReminderId: {
        "eye-strain": new Date(2026, 4, 15, 11, 0),
      },
    });

    const result = handleBackgroundReminderAlarm({
      alarm: { name: PROACTIVE_REMINDER_ALARM_NAME },
      alarms,
      notifications,
      settings,
      reminderList: reminders,
      currentDate: new Date(2026, 4, 15, 10, 0),
    });

    expect(result.notification).toBeNull();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(alarms.create).toHaveBeenCalledWith(PROACTIVE_REMINDER_ALARM_NAME, {
      delayInMinutes: 60,
      periodInMinutes: 45,
    });
  });

  it("can notify for a snoozed reminder after snoozedUntil", () => {
    const { alarms, notifications } = createChromeMocks();
    const settings = createSettings({
      proactiveRemindersEnabled: true,
      quietHoursEnabled: false,
      workdayStart: "09:00",
      workdayEnd: "18:00",
      preferredReminderCategories: ["eye-strain"],
      snoozedUntilByReminderId: {
        "eye-strain": new Date(2026, 4, 15, 11, 0),
      },
    });

    const result = handleBackgroundReminderAlarm({
      alarm: { name: PROACTIVE_REMINDER_ALARM_NAME },
      alarms,
      notifications,
      settings,
      reminderList: reminders,
      currentDate: new Date(2026, 4, 15, 11, 0),
    });

    expect(result.notification?.schedule.reminder.id).toBe("eye-strain");
    expect(notifications.create).toHaveBeenCalledWith(
      expect.stringContaining("vitaloop-reminder-eye-strain"),
      expect.objectContaining({
        title: "VitaLoop: Eye strain",
      }),
    );
  });

  it("creates notification copy for eligible reminders on the named alarm", () => {
    const { alarms, notifications } = createChromeMocks();

    const result = handleBackgroundReminderAlarm({
      alarm: { name: PROACTIVE_REMINDER_ALARM_NAME },
      alarms,
      notifications,
      settings: createSettings({
        proactiveRemindersEnabled: true,
        quietHoursEnabled: false,
      }),
      reminderList: reminders,
      currentDate: new Date(2026, 4, 15, 10, 0),
      notificationIconUrl:
        "chrome-extension://vitaloop/assets/vitaloop-logo-source.png",
    });

    expect(result.notification?.schedule.reminder.id).toBe("eye-strain");
    expect(notifications.create).toHaveBeenCalledWith(
      expect.stringContaining("vitaloop-reminder-eye-strain"),
      expect.objectContaining({
        type: "basic",
        iconUrl: "chrome-extension://vitaloop/assets/vitaloop-logo-source.png",
        title: "VitaLoop: Eye strain",
        message: "Look away from the screen and soften your focus.",
        buttons: [{ title: "Done" }, { title: "Snooze" }],
      }),
    );
    expect(alarms.create).toHaveBeenCalledWith(
      PROACTIVE_REMINDER_ALARM_NAME,
      expect.objectContaining({ periodInMinutes: 45 }),
    );
  });

  it("opens a focused reminder action popup for eligible reminders", () => {
    const { alarms, windows } = createChromeMocks();

    const result = handleBackgroundReminderActionWindowAlarm({
      alarm: { name: PROACTIVE_REMINDER_ALARM_NAME },
      alarms,
      windows,
      settings: createSettings({
        proactiveRemindersEnabled: true,
        quietHoursEnabled: false,
      }),
      reminderList: reminders,
      currentDate: new Date(2026, 4, 15, 10, 0),
      createActionWindowUrl: (schedule) =>
        `chrome-extension://vitaloop/extension/reminder.html?reminderId=${schedule.reminder.id}`,
    });

    expect(result.actionWindow?.schedule.reminder.id).toBe("eye-strain");
    expect(windows.create).toHaveBeenCalledWith({
      url: "chrome-extension://vitaloop/extension/reminder.html?reminderId=eye-strain",
      type: "popup",
      width: REMINDER_ACTION_WINDOW_WIDTH,
      height: REMINDER_ACTION_WINDOW_HEIGHT,
      focused: true,
    });
    expect(alarms.create).toHaveBeenCalledWith(
      PROACTIVE_REMINDER_ALARM_NAME,
      expect.objectContaining({ periodInMinutes: 45 }),
    );
  });

  it("maps reminder notification buttons to supported actions", () => {
    expect(getReminderNotificationButtonAction(0)).toBe("done");
    expect(getReminderNotificationButtonAction(1)).toBe("snooze");
    expect(getReminderNotificationButtonAction(2)).toBeNull();
  });

  it("creates a snooze update from a notification button click", () => {
    const settings = createSettings({
      proactiveRemindersEnabled: true,
      quietHoursEnabled: false,
    });
    const result = getBackgroundReminderNotificationAction({
      notificationId: "vitaloop-reminder-eye-strain-1778824800000",
      buttonIndex: 1,
      settings,
      reminderList: reminders,
      currentDate: new Date(2026, 4, 15, 10, 0),
    });

    expect(result.action).toBe("apply");

    if (result.action !== "apply") {
      throw new Error("Expected a notification action result.");
    }

    expect(result.actionType).toBe("snooze");
    expect(result.shouldPersistSettings).toBe(true);
    expect(result.result.message).toContain("snoozed until 10:15 AM");
    expect(result.updatedSettings.snoozedUntilByReminderId).toMatchObject({
      "eye-strain": new Date(2026, 4, 15, 10, 15),
    });
  });

  it("acknowledges a done notification button without persisting settings", () => {
    const result = getBackgroundReminderNotificationAction({
      notificationId: "vitaloop-reminder-eye-strain-1778824800000",
      buttonIndex: 0,
      settings: createSettings({
        proactiveRemindersEnabled: true,
        quietHoursEnabled: false,
      }),
      reminderList: reminders,
      currentDate: new Date(2026, 4, 15, 10, 0),
    });

    expect(result.action).toBe("apply");

    if (result.action !== "apply") {
      throw new Error("Expected a notification action result.");
    }

    expect(result.actionType).toBe("done");
    expect(result.shouldPersistSettings).toBe(false);
    expect(result.result.message).toContain("marked done");
  });

  it("ignores unsupported notification button clicks", () => {
    expect(
      getBackgroundReminderNotificationAction({
        notificationId: "vitaloop-reminder-eye-strain-1778824800000",
        buttonIndex: 2,
        settings: createSettings({ proactiveRemindersEnabled: true }),
        reminderList: reminders,
        currentDate: new Date(2026, 4, 15, 10, 0),
      }),
    ).toEqual({
      action: "ignore",
      reason: "unsupported-button",
    });
    expect(
      getBackgroundReminderNotificationAction({
        notificationId: "other-notification",
        buttonIndex: 0,
        settings: createSettings({ proactiveRemindersEnabled: true }),
        reminderList: reminders,
        currentDate: new Date(2026, 4, 15, 10, 0),
      }),
    ).toEqual({
      action: "ignore",
      reason: "unrelated-notification",
    });
  });
});
