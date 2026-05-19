import { useEffect, useState } from "react";
import { reminders as defaultReminders } from "../data/reminders";
import {
  applyReminderAction,
  createReminderActionState,
  type ReminderActionType,
} from "../domain/reminderActions";
import { getReminderFrequencyMinutes } from "../domain/scheduling";
import { type ReminderDefinition } from "../domain/schemas";
import {
  extensionSettingsStorage,
  getDefaultExtensionSettings,
  getExtensionReminderActionState,
  type ExtensionSettings,
  type ExtensionSettingsStorage,
  withExtensionReminderActionState,
} from "./extensionSettingsStorage";
import { createReminderNotificationCopy } from "./notificationCopy";

type ReminderWindowLocation = Pick<Location, "search">;

type ExtensionReminderWindowProps = {
  storage?: ExtensionSettingsStorage;
  reminderList?: ReminderDefinition[];
  currentDate?: Date;
  windowLocation?: ReminderWindowLocation;
  onClose?: () => void;
};

function getReminderWindowDate(
  currentDate: Date | undefined,
  windowLocation: ReminderWindowLocation,
) {
  if (currentDate) {
    return currentDate;
  }

  const timestamp = Number(
    new URLSearchParams(windowLocation.search).get("at"),
  );

  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp)
    : new Date();
}

function getReminderWindowReminderId(windowLocation: ReminderWindowLocation) {
  return new URLSearchParams(windowLocation.search).get("reminderId");
}

function closeReminderWindow() {
  window.close();
}

function ExtensionBrandMark() {
  return (
    <img
      className="extension-brand-mark"
      src="/assets/vitaloop-logo-source.png"
      alt=""
      aria-hidden="true"
    />
  );
}

export function ExtensionReminderWindow({
  storage = extensionSettingsStorage,
  reminderList = defaultReminders,
  currentDate,
  windowLocation = window.location,
  onClose = closeReminderWindow,
}: ExtensionReminderWindowProps) {
  const [settings, setSettings] = useState<ExtensionSettings>(() =>
    getDefaultExtensionSettings(),
  );
  const [now] = useState(() =>
    getReminderWindowDate(currentDate, windowLocation),
  );
  const [reminderId] = useState(() =>
    getReminderWindowReminderId(windowLocation),
  );
  const [actionState, setActionState] = useState(createReminderActionState);
  const [statusMessage, setStatusMessage] = useState("");
  const reminder = reminderList.find(
    (candidateReminder) => candidateReminder.id === reminderId,
  );
  const nextSchedule = reminder
    ? {
        reminder,
        frequencyMinutes: getReminderFrequencyMinutes(
          reminder.id,
          settings.reminderIntensity,
        ),
        isAllowedNow: true,
        nextAt: now,
      }
    : undefined;
  const notificationCopy = nextSchedule
    ? createReminderNotificationCopy(nextSchedule.reminder)
    : null;

  useEffect(() => {
    let isMounted = true;

    storage.loadSettings().then((loadedSettings) => {
      if (isMounted) {
        setSettings(loadedSettings);
        setActionState(getExtensionReminderActionState(loadedSettings));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [storage]);

  async function handleReminderAction(actionType: ReminderActionType) {
    if (!nextSchedule) {
      return;
    }

    const result = applyReminderAction(
      actionType,
      {
        ...nextSchedule,
        frequencyMinutes: getReminderFrequencyMinutes(
          nextSchedule.reminder.id,
          settings.reminderIntensity,
        ),
        isAllowedNow: true,
      },
      settings,
      now,
      actionState,
    );

    setActionState(result.state);
    setStatusMessage(result.message);

    if (actionType === "snooze") {
      const updatedSettings = withExtensionReminderActionState(
        settings,
        result.state,
      );

      setSettings(updatedSettings);
      await storage.saveSettings(updatedSettings);
    }

    onClose();
  }

  return (
    <main
      className="extension-shell extension-reminder-window"
      aria-labelledby="reminder-window-title"
    >
      <header className="extension-titlebar extension-reminder-titlebar">
        <div className="extension-titlebar-brand">
          <ExtensionBrandMark />
          <h1 id="reminder-window-title">VitaLoop</h1>
        </div>
      </header>

      {nextSchedule && notificationCopy ? (
        <section
          className="extension-panel extension-reminder-window-panel"
          aria-label="Reminder"
        >
          <p className="extension-eyebrow">Reminder time</p>
          <h2>{nextSchedule.reminder.title}</h2>
          <p>{notificationCopy.message}</p>
          <div
            className="extension-actions extension-reminder-window-actions"
            aria-label="Reminder actions"
          >
            <button
              type="button"
              onClick={() => void handleReminderAction("snooze")}
            >
              Snooze
            </button>
            <button
              type="button"
              onClick={() => void handleReminderAction("done")}
            >
              Done
            </button>
          </div>
        </section>
      ) : (
        <section
          className="extension-panel extension-reminder-window-panel"
          aria-label="Reminder"
        >
          <p className="extension-eyebrow">Reminder time</p>
          <h2>No reminders due right now.</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </section>
      )}

      {statusMessage && (
        <p className="extension-live-status" role="status" aria-live="polite">
          {statusMessage}
        </p>
      )}
    </main>
  );
}
