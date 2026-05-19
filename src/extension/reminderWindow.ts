export const REMINDER_ACTION_WINDOW_PATH = "extension/reminder.html";
export const REMINDER_ACTION_WINDOW_WIDTH = 360;
export const REMINDER_ACTION_WINDOW_HEIGHT = 260;

export function createReminderActionWindowPath(
  currentDate: Date,
  reminderId?: string,
) {
  const params = new URLSearchParams({
    at: String(currentDate.getTime()),
  });

  if (reminderId) {
    params.set("reminderId", reminderId);
  }

  return `${REMINDER_ACTION_WINDOW_PATH}?${params.toString()}`;
}
