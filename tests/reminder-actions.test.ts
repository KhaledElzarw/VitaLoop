import { describe, expect, it, vi } from "vitest";
import { reminders } from "../src/data/reminders";
import {
  applyReminderAction,
  createReminderActionState,
  getActionAwareNextReminder,
  getNextSnoozedReminderAvailability,
  SNOOZE_MINUTES,
  type ReminderActionState,
} from "../src/domain/reminderActions";
import { type AppSettings } from "../src/domain/schemas";
import { getDefaultAppSettings } from "../src/domain/settings";

const currentDate = new Date(2026, 4, 15, 10, 0);

function createSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...getDefaultAppSettings(),
    ...overrides,
    preferredReminderCategories:
      overrides.preferredReminderCategories ??
      getDefaultAppSettings().preferredReminderCategories,
  };
}

function getCurrentNudge(settings = createSettings()) {
  const schedule = getActionAwareNextReminder(
    reminders,
    settings,
    currentDate,
    createReminderActionState(),
  );

  if (!schedule) {
    throw new Error("Expected a current reminder nudge.");
  }

  return schedule;
}

describe("simulated reminder actions", () => {
  it("returns an acknowledgement for done", () => {
    const settings = createSettings();
    const currentNudge = getCurrentNudge(settings);
    const result = applyReminderAction(
      "done",
      currentNudge,
      settings,
      currentDate,
      createReminderActionState(),
    );

    expect(result.message).toContain("marked done");
    expect(
      getActionAwareNextReminder(reminders, settings, currentDate, result.state)
        ?.reminder.id,
    ).toBe("stand-walk");
  });

  it("snoozes the current reminder by the fixed interval", () => {
    const settings = createSettings();
    const currentNudge = getCurrentNudge(settings);
    const result = applyReminderAction(
      "snooze",
      currentNudge,
      settings,
      currentDate,
      createReminderActionState(),
    );
    const snoozedUntil =
      result.state.snoozedUntilByReminderId[currentNudge.reminder.id];

    expect(SNOOZE_MINUTES).toBe(15);
    expect(snoozedUntil).toEqual(new Date(2026, 4, 15, 11, 0));
    expect(result.message).toContain("snoozed until 11:00 AM");
  });

  it("does not select a snoozed reminder before snoozedUntil", () => {
    const settings = createSettings();
    const currentNudge = getCurrentNudge(settings);
    const result = applyReminderAction(
      "snooze",
      currentNudge,
      settings,
      currentDate,
      createReminderActionState(),
    );

    expect(
      getActionAwareNextReminder(reminders, settings, currentDate, result.state)
        ?.reminder.id,
    ).toBe("stand-walk");
  });

  it("selects a snoozed reminder after snoozedUntil", () => {
    const settings = createSettings();
    const currentNudge = getCurrentNudge(settings);
    const result = applyReminderAction(
      "snooze",
      currentNudge,
      settings,
      currentDate,
      createReminderActionState(),
    );

    expect(
      getActionAwareNextReminder(
        reminders,
        settings,
        new Date(2026, 4, 15, 11, 0),
        result.state,
      )?.reminder.id,
    ).toBe("eye-strain");
  });

  it("returns no current reminder when all eligible reminders are snoozed", () => {
    const settings = createSettings();
    let actionState = createReminderActionState();

    for (const reminderId of [
      "eye-strain",
      "stand-walk",
      "hydration",
      "stretch",
    ]) {
      const currentNudge = getActionAwareNextReminder(
        reminders,
        settings,
        currentDate,
        actionState,
      );

      if (!currentNudge) {
        throw new Error(`Expected ${reminderId} to be available.`);
      }

      expect(currentNudge?.reminder.id).toBe(reminderId);

      actionState = applyReminderAction(
        "snooze",
        currentNudge,
        settings,
        currentDate,
        actionState,
      ).state;
    }

    expect(
      getActionAwareNextReminder(reminders, settings, currentDate, actionState),
    ).toBeUndefined();
    expect(
      getNextSnoozedReminderAvailability(
        reminders,
        settings,
        currentDate,
        actionState,
      ),
    ).toMatchObject({
      reminder: { id: "eye-strain" },
      nextAt: new Date(2026, 4, 15, 11, 0),
    });
  });

  it("snoozes from the provided schedule time without reading live time", () => {
    const settings = createSettings({
      quietHoursEnabled: false,
      workdayStart: "09:00",
      workdayEnd: "18:00",
    });
    const currentNudge = getCurrentNudge(settings);
    const nowSpy = vi.spyOn(Date, "now");
    const result = applyReminderAction(
      "snooze",
      currentNudge,
      settings,
      new Date(2026, 4, 15, 2, 0),
      createReminderActionState(),
    );
    const snoozedUntil =
      result.state.snoozedUntilByReminderId[currentNudge.reminder.id];

    expect(nowSpy).not.toHaveBeenCalled();
    expect(snoozedUntil).toEqual(
      new Date(currentNudge.nextAt.getTime() + SNOOZE_MINUTES * 60_000),
    );
    nowSpy.mockRestore();
  });

  it("skip once prevents the current reminder from being selected again", () => {
    const settings = createSettings();
    const currentNudge = getCurrentNudge(settings);
    const result = applyReminderAction(
      "skip-once",
      currentNudge,
      settings,
      currentDate,
      createReminderActionState(),
    );

    expect(result.message).toContain("skipped once");
    expect(
      getActionAwareNextReminder(reminders, settings, currentDate, result.state)
        ?.reminder.id,
    ).toBe("stand-walk");
  });

  it("does not mutate the reminder list or original action state", () => {
    const settings = createSettings();
    const reminderList = reminders.map((reminder) => ({ ...reminder }));
    const originalReminderList = reminderList.map((reminder) => ({
      ...reminder,
    }));
    const actionState: ReminderActionState = {
      doneReminderIds: ["eye-strain"],
      skippedReminderIds: ["stretch"],
      snoozedUntilByReminderId: {
        "stand-walk": new Date(2026, 4, 15, 10, 30),
      },
    };
    const originalActionState: ReminderActionState = {
      doneReminderIds: [...actionState.doneReminderIds],
      skippedReminderIds: [...actionState.skippedReminderIds],
      snoozedUntilByReminderId: {
        ...actionState.snoozedUntilByReminderId,
      },
    };
    const currentNudge = getActionAwareNextReminder(
      reminderList,
      settings,
      currentDate,
      actionState,
    );

    if (!currentNudge) {
      throw new Error("Expected a current reminder nudge.");
    }

    const result = applyReminderAction(
      "done",
      currentNudge,
      settings,
      currentDate,
      actionState,
    );

    expect(reminderList).toEqual(originalReminderList);
    expect(actionState).toEqual(originalActionState);
    expect(result.state).not.toBe(actionState);
    expect(result.state.doneReminderIds).toEqual([
      ...originalActionState.doneReminderIds,
      currentNudge.reminder.id,
    ]);
  });

  it("keeps unpreferred reminders ignored", () => {
    const settings = createSettings({
      preferredReminderCategories: ["hydration"],
    });
    const actionState = createReminderActionState();

    actionState.skippedReminderIds = ["eye-strain"];
    actionState.snoozedUntilByReminderId["eye-strain"] = new Date(
      2026,
      4,
      15,
      10,
      15,
    );

    expect(
      getActionAwareNextReminder(reminders, settings, currentDate, actionState)
        ?.reminder.id,
    ).toBe("hydration");
  });

  it("does not read the real current time", () => {
    const nowSpy = vi.spyOn(Date, "now");

    getActionAwareNextReminder(
      reminders,
      createSettings(),
      currentDate,
      createReminderActionState(),
    );

    expect(nowSpy).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });
});
