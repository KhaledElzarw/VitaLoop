import { type ReminderDefinition } from "../domain/schemas";

type ReminderId = ReminderDefinition["id"];

export type ReminderNotificationCopy = {
  title: string;
  message: string;
  contextMessage: string;
};

export const REMINDER_NOTIFICATION_BUTTONS = [
  { title: "Done" },
  { title: "Snooze" },
] as const;

const notificationMessages: Record<ReminderId, string> = {
  hydration: "Pause for a sip of water when it fits your moment.",
  "eye-strain": "Look away from the screen and soften your focus.",
  stretch: "Take a light stretch break before returning to your task.",
  "stand-walk": "Stand up or take a short walk if your day allows.",
  posture: "Notice your shoulders, neck, and sitting position.",
  "breathing-reset": "Take a few calm breaths before returning to your task.",
  "sleep-routine": "Start winding down with one small evening step.",
  "mood-energy": "Check in with how you feel and what you need next.",
};

export const VITALOOP_NOTIFICATION_ICON_URL =
  "assets/app-icons/vitaloop-notification-logo.png";

export function createReminderNotificationCopy(
  reminder: ReminderDefinition,
): ReminderNotificationCopy {
  return {
    title: `VitaLoop: ${reminder.title}`,
    message: notificationMessages[reminder.id],
    contextMessage: "Local browser reminder",
  };
}
