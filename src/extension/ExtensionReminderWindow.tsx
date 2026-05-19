import { useEffect, useState } from "react";
import { reminders as defaultReminders } from "../data/reminders";
import {
  applyReminderAction,
  createReminderActionState,
  type ReminderActionState,
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

function ExtensionReminderBrandLogo() {
  return (
    <img
      className="extension-reminder-window-logo"
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
  const [actionState, setActionState] =
    useState<ReminderActionState>(createReminderActionState);
  const [didLoadSettings, setDidLoadSettings] = useState(false);
  const [isApplyingAction, setIsApplyingAction] = useState(false);
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
        setDidLoadSettings(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [storage]);

  async function handleReminderAction(actionType: ReminderActionType) {
    if (!nextSchedule || !didLoadSettings || isApplyingAction) {
      return;
    }

    setIsApplyingAction(true);

    const result = applyReminderAction(
      actionType,
      nextSchedule,
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
      const didSave = await storage.saveSettings(updatedSettings);

      if (!didSave) {
        setIsApplyingAction(false);
        setStatusMessage("Reminder could not be snoozed right now.");
        return;
      }

      setSettings(updatedSettings);
    }

    onClose();
  }

  return (
    <main
      className="extension-reminder-window-page"
      aria-labelledby="reminder-window-title"
    >
      {nextSchedule && notificationCopy ? (
        <section
          className="extension-reminder-window-card"
          aria-label="Reminder"
        >
          <ExtensionReminderBrandLogo />
          <div className="extension-reminder-window-copy">
            <h1 id="reminder-window-title">{notificationCopy.title}</h1>
            <p className="extension-reminder-window-context">
              {notificationCopy.contextMessage}
            </p>
            <p className="extension-reminder-window-message">
              {notificationCopy.message}
            </p>
            <div
              className="extension-reminder-window-actions"
              aria-label="Reminder actions"
            >
              <button
                type="button"
                disabled={!didLoadSettings || isApplyingAction}
                onClick={() => void handleReminderAction("done")}
              >
                Done
              </button>
              <button
                type="button"
                disabled={!didLoadSettings || isApplyingAction}
                onClick={() => void handleReminderAction("snooze")}
              >
                Snooze
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section
          className="extension-reminder-window-card extension-reminder-window-card-empty"
          aria-label="Reminder"
        >
          <ExtensionReminderBrandLogo />
          <div className="extension-reminder-window-copy">
            <h1 id="reminder-window-title">No reminders due right now.</h1>
            <p className="extension-reminder-window-message">
              VitaLoop will show another gentle nudge when one is available.
            </p>
            <div className="extension-reminder-window-actions">
              <button type="button" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </section>
      )}

      {statusMessage && (
        <p className="extension-reminder-window-status" role="status">
          {statusMessage}
        </p>
      )}
    </main>
  );
}
