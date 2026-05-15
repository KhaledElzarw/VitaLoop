import { useEffect, useState } from "react";
import { reminders as defaultReminders } from "../data/reminders";
import {
  applyReminderAction,
  createReminderActionState,
  getActionAwareNextReminder,
  type ReminderActionType,
} from "../domain/reminderActions";
import { formatReminderTime } from "../domain/scheduling";
import { type AppSettings, type ReminderDefinition } from "../domain/schemas";
import { getDefaultAppSettings } from "../domain/settings";
import {
  extensionSettingsStorage,
  type ExtensionSettingsStorage,
} from "./extensionSettingsStorage";

type ChromeOptionsApi = {
  runtime?: {
    openOptionsPage?: () => void;
  };
};

type ExtensionPopupProps = {
  storage?: ExtensionSettingsStorage;
  reminderList?: ReminderDefinition[];
  currentDate?: Date;
  onOpenOptions?: () => void;
};

function openExtensionOptionsPage() {
  const chromeApi = (
    globalThis as typeof globalThis & { chrome?: ChromeOptionsApi }
  ).chrome;

  if (chromeApi?.runtime?.openOptionsPage) {
    chromeApi.runtime.openOptionsPage();
    return;
  }

  window.location.href = "/extension/options.html";
}

function getTimingStatus(
  nextAt: Date,
  isAllowedNow: boolean,
  frequencyMinutes: number,
) {
  if (!isAllowedNow) {
    return `Paused now. Next window opens around ${formatReminderTime(nextAt)}.`;
  }

  return `Suggested around ${formatReminderTime(
    nextAt,
  )} on a ${frequencyMinutes} minute rhythm.`;
}

export function ExtensionPopup({
  storage = extensionSettingsStorage,
  reminderList = defaultReminders,
  currentDate,
  onOpenOptions = openExtensionOptionsPage,
}: ExtensionPopupProps) {
  const [settings, setSettings] = useState<AppSettings>(() =>
    getDefaultAppSettings(),
  );
  const [now] = useState(() => currentDate ?? new Date());
  const [actionState, setActionState] = useState(createReminderActionState);
  const [actionStatus, setActionStatus] = useState("");
  const nextSchedule = getActionAwareNextReminder(
    reminderList,
    settings,
    now,
    actionState,
  );

  useEffect(() => {
    let isMounted = true;

    storage.loadSettings().then((loadedSettings) => {
      if (isMounted) {
        setSettings(loadedSettings);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [storage]);

  function handleReminderAction(actionType: ReminderActionType) {
    if (!nextSchedule) {
      return;
    }

    const result = applyReminderAction(
      actionType,
      nextSchedule,
      settings,
      now,
      actionState,
    );

    setActionState(result.state);
    setActionStatus(result.message);
  }

  return (
    <main className="extension-shell extension-popup" aria-labelledby="popup-title">
      <header className="extension-titlebar">
        <h1 id="popup-title">VitaLoop</h1>
        <button
          className="extension-titlebar-action"
          type="button"
          onClick={onOpenOptions}
        >
          Options
        </button>
      </header>

      {nextSchedule ? (
        <section
          className="extension-panel extension-reminder-card"
          aria-label="Next wellness nudge"
        >
          <img
            className="extension-brand-mark"
            src="/assets/vitaloop-logo-source.png"
            alt=""
            aria-hidden="true"
          />
          <div className="extension-card-topline">
            <p className="extension-eyebrow">Next reminder</p>
            <span>{nextSchedule.reminder.category}</span>
          </div>
          <p className="extension-reminder-time">
            {formatReminderTime(nextSchedule.nextAt)}
          </p>
          <div className="extension-reminder-meta">
            <h2>{nextSchedule.reminder.title}</h2>
            <p>{nextSchedule.reminder.description}</p>
          </div>
          <p className="extension-status">
            {getTimingStatus(
              nextSchedule.nextAt,
              nextSchedule.isAllowedNow,
              nextSchedule.frequencyMinutes,
            )}
          </p>
          <div className="extension-actions" aria-label="Reminder actions">
            <button type="button" onClick={() => handleReminderAction("done")}>
              Done
            </button>
            <button
              type="button"
              onClick={() => handleReminderAction("snooze")}
            >
              Snooze
            </button>
            <button
              type="button"
              onClick={() => handleReminderAction("skip-once")}
            >
              Skip once
            </button>
          </div>
        </section>
      ) : (
        <section
          className="extension-panel extension-reminder-card"
          aria-label="Next wellness nudge"
        >
          <img
            className="extension-brand-mark"
            src="/assets/vitaloop-logo-source.png"
            alt=""
            aria-hidden="true"
          />
          <h2>No nudge scheduled</h2>
          <p>
            Choose at least one reminder category to keep VitaLoop ready for a
            gentle prompt.
          </p>
        </section>
      )}

      {actionStatus && (
        <p className="extension-live-status" role="status" aria-live="polite">
          {actionStatus}
        </p>
      )}

    </main>
  );
}
