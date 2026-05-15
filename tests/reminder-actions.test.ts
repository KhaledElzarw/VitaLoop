import { describe, expect, it, vi } from "vitest";
import { reminders } from "../src/data/reminders";
import {
  applyReminderAction,
  createReminderActionState,
  getActionAwareNextReminder,
  SNOOZE_MINUTES,
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
