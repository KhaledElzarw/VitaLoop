import { z } from "zod";
import {
  type ReminderActionResult,
  type ReminderActionType,
} from "./reminderActions";
import {
  reminderIdSchema,
  type ReminderDefinition,
} from "./schemas";
import { type ReminderSchedule } from "./scheduling";

export const REMINDER_HISTORY_LIMIT = 50;

export const reminderHistoryActionSchema = z.enum([
  "done",
  "snooze",
  "skip-once",
]);

export const reminderHistoryEntrySchema = z.object({
  id: z.string().min(1),
  reminderId: reminderIdSchema,
  reminderTitle: z.string().min(1),
  actionType: reminderHistoryActionSchema,
  occurredAt: z.coerce.date(),
  snoozedUntil: z.coerce.date().optional(),
});

export type ReminderHistoryEntry = z.infer<typeof reminderHistoryEntrySchema>;

type ActionAwareSchedule = ReminderSchedule & {
  reminder: ReminderDefinition;
  nextAt: Date;
};

function cloneHistoryEntry(
  entry: ReminderHistoryEntry,
): ReminderHistoryEntry {
  return {
    ...entry,
    occurredAt: new Date(entry.occurredAt),
    snoozedUntil: entry.snoozedUntil
      ? new Date(entry.snoozedUntil)
      : undefined,
  };
}

export function cloneReminderHistory(
  history: ReminderHistoryEntry[],
): ReminderHistoryEntry[] {
  return history.map(cloneHistoryEntry);
}

export function createReminderHistoryEntry({
  actionType,
  schedule,
  result,
  occurredAt,
}: {
  actionType: ReminderActionType;
  schedule: ActionAwareSchedule;
  result: ReminderActionResult;
  occurredAt: Date;
}): ReminderHistoryEntry {
  const snoozedUntil =
    actionType === "snooze"
      ? result.state.snoozedUntilByReminderId[schedule.reminder.id]
      : undefined;

  return {
    id: `${occurredAt.toISOString()}-${schedule.reminder.id}-${actionType}`,
    reminderId: schedule.reminder.id,
    reminderTitle: schedule.reminder.title,
    actionType,
    occurredAt: new Date(occurredAt),
    snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : undefined,
  };
}

export function appendReminderHistoryEntry(
  history: ReminderHistoryEntry[],
  entry: ReminderHistoryEntry,
  limit = REMINDER_HISTORY_LIMIT,
): ReminderHistoryEntry[] {
  return [
    cloneHistoryEntry(entry),
    ...history
      .filter((candidateEntry) => candidateEntry.id !== entry.id)
      .map(cloneHistoryEntry),
  ].slice(0, limit);
}
