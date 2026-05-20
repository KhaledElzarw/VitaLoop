import { useEffect, useState } from "react";
import { reminders as defaultReminders } from "../data/reminders";
import { getReminderListWithCustomReminders } from "../domain/customReminders";
import {
  applyReminderAction,
  createReminderActionState,
  getActionAwareNextReminder,
  getNextSnoozedReminderAvailability,
  type ReminderActionType,
} from "../domain/reminderActions";
import {
  appendReminderHistoryEntry,
  createReminderHistoryEntry,
  type ReminderHistoryEntry,
} from "../domain/reminderHistory";
import { formatReminderTime } from "../domain/scheduling";
import {
  type BuiltinReminderId,
  type ReminderDefinition,
} from "../domain/schemas";
import { getActivityFunFact } from "./activityFunFacts";
import {
  extensionSettingsStorage,
  getDefaultExtensionSettings,
  getExtensionReminderActionState,
  type ExtensionSettings,
  type ExtensionSettingsStorage,
  withExtensionReminderActionState,
  withExtensionReminderHistory,
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

const minuteInMilliseconds = 60_000;

function formatCountdownUnit(
  value: number,
  singularUnit: string,
  pluralUnit = `${singularUnit}s`,
) {
  return `${value} ${value === 1 ? singularUnit : pluralUnit}`;
}

function formatReminderCountdown(nextAt: Date, currentDate: Date) {
  const remainingMinutes = Math.max(
    0,
    Math.ceil((Number(nextAt) - Number(currentDate)) / minuteInMilliseconds),
  );

  if (remainingMinutes === 0) {
    return "Due now";
  }

  if (remainingMinutes < 60) {
    return formatCountdownUnit(remainingMinutes, "min", "min");
  }

  const remainingHours = Math.floor(remainingMinutes / 60);
  const minutesAfterHours = remainingMinutes % 60;

  if (remainingHours < 24) {
    const hourText = formatCountdownUnit(remainingHours, "hr");

    return minutesAfterHours > 0
      ? `${hourText} ${formatCountdownUnit(minutesAfterHours, "min", "min")}`
      : hourText;
  }

  const remainingDays = Math.floor(remainingHours / 24);
  const hoursAfterDays = remainingHours % 24;
  const dayText = formatCountdownUnit(remainingDays, "day");

  return hoursAfterDays > 0
    ? `${dayText} ${formatCountdownUnit(hoursAfterDays, "hr")}`
    : dayText;
}

function getCountdownTimingLabel(countdown: string, reminderTime: string) {
  if (countdown === "Due now") {
    return `Next reminder is due now at ${reminderTime}`;
  }

  return `Next reminder in ${countdown} at ${reminderTime}`;
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

type ActivityIconVariant = BuiltinReminderId | "fallback";

const activityIconSources = {
  hydration: "/assets/activity-icons/hydration.png",
  "eye-strain": "/assets/activity-icons/eye-strain.png",
  stretch: "/assets/activity-icons/stretch.png",
  "stand-walk": "/assets/activity-icons/stand-walk.png",
  posture: "/assets/activity-icons/posture.png",
  "breathing-reset": "/assets/activity-icons/breathing-reset.png",
  "sleep-routine": "/assets/activity-icons/sleep-routine.png",
  "mood-energy": "/assets/activity-icons/mood-energy.png",
  fallback: "/assets/activity-icons/fallback.png",
} satisfies Record<ActivityIconVariant, string>;

function getActivityIconVariant(
  reminder: Pick<ReminderDefinition, "id" | "title" | "category">,
): ActivityIconVariant {
  const label = `${reminder.id} ${reminder.title} ${reminder.category}`.toLowerCase();

  if (label.includes("hydration") || label.includes("water")) {
    return "hydration";
  }

  if (label.includes("eye") || label.includes("screen")) {
    return "eye-strain";
  }

  if (label.includes("stretch")) {
    return "stretch";
  }

  if (label.includes("stand") || label.includes("walk")) {
    return "stand-walk";
  }

  if (label.includes("posture")) {
    return "posture";
  }

  if (label.includes("breath") || label.includes("calm")) {
    return "breathing-reset";
  }

  if (label.includes("sleep") || label.includes("evening")) {
    return "sleep-routine";
  }

  if (label.includes("mood") || label.includes("energy")) {
    return "mood-energy";
  }

  return "fallback";
}

function ActivityIcon({ reminder }: { reminder: ReminderDefinition }) {
  const variant = getActivityIconVariant(reminder);

  return (
    <span
      className={`extension-activity-icon extension-activity-icon-${variant}`}
      data-activity-icon={variant}
      aria-hidden="true"
    >
      <img src={activityIconSources[variant]} alt="" aria-hidden="true" />
    </span>
  );
}

function getHistoryActionLabel(entry: ReminderHistoryEntry) {
  if (entry.actionType === "done") {
    return "Done";
  }

  if (entry.actionType === "snooze") {
    return "Snoozed";
  }

  return "Skipped";
}

function ExtensionRecentActivity({
  history,
}: {
  history: ReminderHistoryEntry[];
}) {
  return (
    <section className="extension-panel extension-history-panel" aria-label="Recent activity">
      <div className="extension-panel-heading">
        <p className="extension-eyebrow">Recent activity</p>
      </div>
      {history.length > 0 ? (
        <ul className="extension-history-list">
          {history.slice(0, 3).map((entry) => (
            <li key={entry.id}>
              <span>{entry.reminderTitle}</span>
              <strong>
                {formatReminderTime(entry.occurredAt)} ·{" "}
                {getHistoryActionLabel(entry)}
              </strong>
              {entry.snoozedUntil ? (
                <small>Until {formatReminderTime(entry.snoozedUntil)}</small>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="extension-history-empty">No reminder activity yet.</p>
      )}
    </section>
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
  const [now, setNow] = useState(() => currentDate ?? new Date());
  const [activityFactSeed] = useState(() => Math.random());
  const [actionState, setActionState] = useState(createReminderActionState);
  const [actionStatus, setActionStatus] = useState("");
  const resolvedReminderList = getReminderListWithCustomReminders(
    reminderList,
    settings,
  );
  const nextSchedule = getActionAwareNextReminder(
    resolvedReminderList,
    settings,
    now,
    actionState,
  );
  const nextSnoozedReminder = getNextSnoozedReminderAvailability(
    resolvedReminderList,
    settings,
    now,
    actionState,
  );
  const nextReminderCountdown = nextSchedule
    ? formatReminderCountdown(nextSchedule.nextAt, now)
    : "";
  const nextReminderTime = nextSchedule
    ? formatReminderTime(nextSchedule.nextAt)
    : "";
  const nextReminderFact = nextSchedule
    ? getActivityFunFact(nextSchedule.reminder, activityFactSeed)
    : "";

  useEffect(() => {
    if (currentDate) {
      setNow(currentDate);
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, minuteInMilliseconds);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentDate]);

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

    const historyEntry = createReminderHistoryEntry({
      actionType,
      schedule: nextSchedule,
      result,
      occurredAt: now,
    });
    const nextHistory = appendReminderHistoryEntry(
      settings.reminderHistory,
      historyEntry,
    );
    const settingsWithAction =
      actionType === "snooze"
        ? withExtensionReminderActionState(settings, result.state)
        : settings;
    const updatedSettings = withExtensionReminderHistory(
      settingsWithAction,
      nextHistory,
    );

    setSettings(updatedSettings);
    void storage.saveSettings(updatedSettings);
  }

  return (
    <main className="extension-shell extension-popup" aria-labelledby="popup-title">
      <header className="extension-titlebar">
        <div className="extension-titlebar-brand">
          <ExtensionBrandMark />
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
          </div>
          <p
            className="extension-reminder-time"
            aria-label={getCountdownTimingLabel(
              nextReminderCountdown,
              nextReminderTime,
            )}
          >
            <span className="extension-reminder-countdown">
              {nextReminderCountdown}
            </span>
            <span className="extension-reminder-scheduled-time">
              {nextReminderTime}
            </span>
          </p>
          <div className="extension-reminder-meta">
            <div className="extension-reminder-title-row">
              <ActivityIcon reminder={nextSchedule.reminder} />
              <div className="extension-reminder-title-copy">
                <h2>{nextSchedule.reminder.title}</h2>
                <p>{nextReminderFact}</p>
              </div>
            </div>
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
      <ExtensionRecentActivity history={settings.reminderHistory} />
    </main>
  );
}
