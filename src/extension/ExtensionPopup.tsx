import { useEffect, useState } from "react";
import { reminders as defaultReminders } from "../data/reminders";
import {
  applyReminderAction,
  createReminderActionState,
  getActionAwareNextReminder,
  getNextSnoozedReminderAvailability,
  type ReminderActionType,
} from "../domain/reminderActions";
import { formatReminderTime } from "../domain/scheduling";
import { type ReminderDefinition } from "../domain/schemas";
import {
  extensionSettingsStorage,
  getDefaultExtensionSettings,
  getExtensionReminderActionState,
  type ExtensionSettings,
  type ExtensionSettingsStorage,
  withExtensionReminderActionState,
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

export function ExtensionPopup({
  storage = extensionSettingsStorage,
  reminderList = defaultReminders,
  currentDate,
  onOpenOptions = openExtensionOptionsPage,
}: ExtensionPopupProps) {
  const [settings, setSettings] = useState<ExtensionSettings>(() =>
    getDefaultExtensionSettings(),
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
  const nextSnoozedReminder = getNextSnoozedReminderAvailability(
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
        setActionState(getExtensionReminderActionState(loadedSettings));
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

    if (actionType === "snooze") {
      const updatedSettings = withExtensionReminderActionState(
        settings,
        result.state,
      );

      setSettings(updatedSettings);
      void storage.saveSettings(updatedSettings);
    }
  }

  return (
    <main className="extension-shell extension-popup" aria-labelledby="popup-title">
      <header className="extension-titlebar">
        <div className="extension-window-controls" aria-hidden="true">
          <span className="extension-window-dot extension-window-dot-close" />
          <span className="extension-window-dot extension-window-dot-minimize" />
          <span className="extension-window-dot extension-window-dot-zoom" />
        </div>
        <div className="extension-titlebar-title">
          <p>VitaLoop</p>
          <h1 id="popup-title">VitaLoop</h1>
        </div>
        <button
          className="extension-titlebar-action"
          type="button"
          onClick={onOpenOptions}
          aria-label="Open options"
        >
          Options
        </button>
      </header>

      <section
        className="extension-panel extension-status-panel extension-proactive-panel"
        aria-label="Proactive reminder status"
      >
        <div className="extension-panel-heading">
          <p className="extension-eyebrow">Proactive reminders</p>
          <span
            className="extension-status-pill"
            data-state={
              settings.proactiveRemindersEnabled ? "enabled" : "disabled"
            }
          >
            {settings.proactiveRemindersEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <p>
          {settings.proactiveRemindersEnabled
            ? "Local browser notifications are enabled for gentle wellness nudges."
            : "Enable proactive reminders in Options to use local browser notifications."}
        </p>
      </section>

      {nextSchedule ? (
        <section
          className="extension-panel extension-reminder-card"
          aria-label="Next wellness nudge"
        >
          <div className="extension-panel-heading">
            <p className="extension-eyebrow">Next reminder</p>
            <div className="extension-card-badges">
              <ExtensionBrandMark />
              <span className="extension-category-pill">
                {nextSchedule.reminder.category}
              </span>
            </div>
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
          className="extension-panel extension-reminder-card extension-empty-card"
          aria-label="Next wellness nudge"
        >
          <div className="extension-panel-heading">
            <p className="extension-eyebrow">Next reminder</p>
            <ExtensionBrandMark />
          </div>
          <h2>No reminders due right now.</h2>
          {nextSnoozedReminder ? (
            <p>
              Next reminder: {nextSnoozedReminder.reminder.title} at{" "}
              {formatReminderTime(nextSnoozedReminder.nextAt)}.
            </p>
          ) : (
            <p>
              VitaLoop will show another gentle nudge when one is available.
            </p>
          )}
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
