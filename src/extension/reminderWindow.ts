export const REMINDER_ACTION_WINDOW_PATH = "extension/reminder.html";
export const REMINDER_ACTION_WINDOW_WIDTH = 720;
export const REMINDER_ACTION_WINDOW_HEIGHT = 220;
export const REMINDER_ACTION_WINDOW_EDGE_GAP = 24;

export type ReminderActionWindowReferenceBounds = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

export type ReminderActionWindowCreateData = {
  url: string;
  type: "popup";
  width: number;
  height: number;
  focused: boolean;
  left?: number;
  top?: number;
};

function getFiniteNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

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

export function createReminderActionWindowData(
  actionWindowUrl: string,
  referenceBounds?: ReminderActionWindowReferenceBounds | null,
): ReminderActionWindowCreateData {
  const referenceLeft = getFiniteNumber(referenceBounds?.left);
  const referenceTop = getFiniteNumber(referenceBounds?.top);
  const referenceWidth = getFiniteNumber(referenceBounds?.width);
  const createData: ReminderActionWindowCreateData = {
    url: actionWindowUrl,
    type: "popup",
    width: REMINDER_ACTION_WINDOW_WIDTH,
    height: REMINDER_ACTION_WINDOW_HEIGHT,
    focused: true,
  };

  if (referenceLeft !== null && referenceWidth !== null) {
    createData.left = Math.max(
      0,
      referenceLeft +
        referenceWidth -
        REMINDER_ACTION_WINDOW_WIDTH -
        REMINDER_ACTION_WINDOW_EDGE_GAP,
    );
  }

  if (referenceTop !== null) {
    createData.top = Math.max(0, referenceTop + REMINDER_ACTION_WINDOW_EDGE_GAP);
  }

  return createData;
}
