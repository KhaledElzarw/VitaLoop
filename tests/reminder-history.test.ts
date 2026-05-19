import { describe, expect, it } from "vitest";
import { reminders } from "../src/data/reminders";
import {
  appendReminderHistoryEntry,
  createReminderHistoryEntry,
  REMINDER_HISTORY_LIMIT,
  type ReminderHistoryEntry,
} from "../src/domain/reminderHistory";
import {
  applyReminderAction,
  createReminderActionState,
} from "../src/domain/reminderActions";
import { getDefaultAppSettings } from "../src/domain/settings";

const currentDate = new Date(2026, 4, 15, 10, 0);
const eyeStrainReminder = reminders.find(
  (reminder) => reminder.id === "eye-strain",
);

if (!eyeStrainReminder) {
  throw new Error("Expected eye strain reminder fixture.");
}

const schedule = {
  reminder: eyeStrainReminder,
  frequencyMinutes: 45,
  isAllowedNow: true,
  nextAt: currentDate,
};

describe("reminder history", () => {
  it("creates a stable history entry for a completed reminder", () => {
    const result = applyReminderAction(
      "done",
      schedule,
      getDefaultAppSettings(),
      currentDate,
      createReminderActionState(),
    );
    const entry = createReminderHistoryEntry({
      actionType: "done",
      schedule,
      result,
      occurredAt: currentDate,
    });

    expect(entry).toMatchObject({
      id: `${currentDate.toISOString()}-eye-strain-done`,
      reminderId: "eye-strain",
      reminderTitle: "Eye strain",
      actionType: "done",
      occurredAt: currentDate,
    });
    expect(entry.snoozedUntil).toBeUndefined();
  });

  it("captures snoozed-until timestamps for snooze actions", () => {
    const result = applyReminderAction(
      "snooze",
      schedule,
      getDefaultAppSettings(),
      currentDate,
      createReminderActionState(),
    );
    const entry = createReminderHistoryEntry({
      actionType: "snooze",
      schedule,
      result,
      occurredAt: currentDate,
    });

    expect(entry.snoozedUntil).toEqual(new Date(2026, 4, 15, 10, 15));
  });

  it("keeps the newest 50 history entries", () => {
    const result = applyReminderAction(
      "done",
      schedule,
      getDefaultAppSettings(),
      currentDate,
      createReminderActionState(),
    );
    const history = Array.from({ length: REMINDER_HISTORY_LIMIT + 2 }).reduce<
      ReminderHistoryEntry[]
    >(
      (entries, _item, index) =>
        appendReminderHistoryEntry(
          entries,
          createReminderHistoryEntry({
            actionType: "done",
            schedule,
            result,
            occurredAt: new Date(currentDate.getTime() + index * 1000),
          }),
        ),
      [],
    );

    expect(history).toHaveLength(REMINDER_HISTORY_LIMIT);
    expect(history[0].occurredAt).toEqual(
      new Date(currentDate.getTime() + (REMINDER_HISTORY_LIMIT + 1) * 1000),
    );
  });
});
