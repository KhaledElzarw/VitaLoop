import { type ReminderDefinition } from "../domain/schemas";

type ReminderId = ReminderDefinition["id"];

export type ReminderNotificationCopy = {
  title: string;
  message: string;
  contextMessage: string;
};

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

const notificationIconSvg = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">',
  '<rect width="128" height="128" rx="28" fill="#17352c"/>',
  '<circle cx="38" cy="42" r="16" fill="#8fd8b5"/>',
  '<path d="M34 78c14 12 36 12 50 0" fill="none" stroke="#f6ead2" stroke-width="10" stroke-linecap="round"/>',
  '<text x="64" y="58" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">VL</text>',
  "</svg>",
].join("");

export const VITALOOP_NOTIFICATION_ICON_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  notificationIconSvg,
)}`;

export function createReminderNotificationCopy(
  reminder: ReminderDefinition,
): ReminderNotificationCopy {
  return {
    title: `VitaLoop: ${reminder.title}`,
    message: notificationMessages[reminder.id],
    contextMessage: "Local browser reminder",
  };
}
