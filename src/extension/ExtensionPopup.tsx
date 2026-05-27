import { useEffect, useState } from "react";
import { reminders as defaultReminders } from "../data/reminders";
import { getReminderListWithCustomReminders } from "../domain/customReminders";
import {
  applyReminderAction,
  createReminderActionState,
  getActionAwareNextReminder,
  getActionAwareUpcomingReminders,
  getNextSnoozedReminderAvailability,
  type ActionAwareUpcomingReminder,
  type ReminderActionType,
} from "../domain/reminderActions";
import {
  appendReminderHistoryEntry,
  createReminderHistoryEntry,
} from "../domain/reminderHistory";
import {
  formatReminderCountdown,
  formatReminderTime,
} from "../domain/scheduling";
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

function getCountdownTimingLabel(countdown: string, reminderTime: string) {
  if (countdown === "Due now") {
    return `Next loop is due now at ${reminderTime}`;
  }

  return `Next loop in ${countdown} at ${reminderTime}`;
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

const activityIconGlyphs = {
  hydration: "🥤",
  "eye-strain": "👀",
  stretch: "🙆🏻‍♂️",
  "stand-walk": "🚶🏻‍♂️",
  posture: "🪑",
  "breathing-reset": "🧘🏻‍♂️",
  "sleep-routine": "🛏️",
  "mood-energy": "🪫",
  fallback: "◇",
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
      <span className="extension-activity-icon-glyph">
        {activityIconGlyphs[variant]}
      </span>
    </span>
  );
}

const minuteInMilliseconds = 60_000;

function ExtensionHeadsUp({
  upcomingReminders,
  currentDate,
}: {
  upcomingReminders: ActionAwareUpcomingReminder[];
  currentDate: Date;
}) {
  return (
    <section
      className="extension-panel extension-heads-up-panel"
      aria-label="Head's up"
    >
      <div className="extension-panel-heading">
        <p className="extension-eyebrow">Head's up</p>
      </div>
      {upcomingReminders.length > 0 ? (
        <ul className="extension-heads-up-list">
          {upcomingReminders.slice(0, 3).map((schedule) => (
            <li key={schedule.reminder.id}>
              <span>{schedule.reminder.title}</span>
              <strong>
                {formatReminderCountdown(schedule.nextAt, currentDate)}
              </strong>
              <small>
                {schedule.isSnoozed ? "Snoozed until " : "Scheduled for "}
                {formatReminderTime(schedule.nextAt)}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="extension-heads-up-empty">
          No upcoming loops right now.
        </p>
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
  const upcomingReminders = getActionAwareUpcomingReminders(
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

  const completedCount = Math.min(3, settings.reminderHistory.length || 3);
  const totalCount = 8;

  return (
    <main
      className="extension-shell extension-popup extension-popup-mockup"
      aria-labelledby="popup-title"
    >
      <div className="extension-popup-browserbar" aria-hidden="true">
        <span>◉</span>
        <span>☆</span>
        <span>▢</span>
      </div>
      <header className="extension-popup-header extension-titlebar">
        <div className="extension-titlebar-brand">
          <ExtensionBrandMark />
          <h1 id="popup-title">VitaLoop</h1>
        </div>
        <button
          className="extension-popup-settings"
          type="button"
          onClick={onOpenOptions}
          aria-label="Open options"
        >
          ⚙
        </button>
      </header>

      {nextSchedule ? (
        <section
          className="extension-popup-next"
          aria-label="Next wellness nudge"
        >
          <div className="extension-progress-ring" aria-hidden="true">
            <span>✓</span>
            <strong>
              {completedCount} / {totalCount}
            </strong>
            <small>Completed</small>
          </div>
          <div className="extension-popup-next-copy">
            <p>Next loop</p>
            <h2>{nextSchedule.reminder.title}</h2>
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
            <p className="extension-popup-fact">{nextReminderFact}</p>
            <ActivityIcon reminder={nextSchedule.reminder} />
            <button
              type="button"
              onClick={() => handleReminderAction("done")}
            >
              Mark as done
            </button>
          </div>
          <span className="extension-popup-hidden-status">
            {getTimingStatus(
              nextSchedule.nextAt,
              nextSchedule.isAllowedNow,
              nextSchedule.frequencyMinutes,
            )}
          </span>
        </section>
      ) : (
        <section
          className="extension-popup-next extension-empty-card"
          aria-label="Next wellness nudge"
        >
          <div className="extension-progress-ring" aria-hidden="true">
            <span>✓</span>
            <strong>
              {completedCount} / {totalCount}
            </strong>
            <small>Completed</small>
          </div>
          <div className="extension-popup-next-copy">
            <p>Next loop</p>
            <h2>No loops due right now.</h2>
            {nextSnoozedReminder ? (
              <p>
                Next loop: {nextSnoozedReminder.reminder.title} at{" "}
                {formatReminderTime(nextSnoozedReminder.nextAt)}.
              </p>
            ) : (
              <p>
                VitaLoop will show another gentle nudge when one is available.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="extension-popup-progress" aria-label="Today's progress">
        <div>
          <h2>Today's progress</h2>
          <button type="button">View all ›</button>
        </div>
        <ul>
          {resolvedReminderList.slice(0, 8).map((reminder) => (
            <li key={reminder.id}>
              <ActivityIcon reminder={reminder} />
            </li>
          ))}
          <li>
            <button type="button" onClick={onOpenOptions} aria-label="Add">
              +
            </button>
          </li>
        </ul>
      </section>

      <div className="extension-popup-actions" aria-label="Loop actions">
        <button
          type="button"
          aria-label="Done"
          className="extension-popup-hidden-status"
          onClick={() => handleReminderAction("done")}
        >
          Done
        </button>
        <button
          type="button"
          aria-label="Snooze"
          onClick={() => handleReminderAction("snooze")}
        >
          <span>Pause loops</span>
          <strong>30 min⌄</strong>
        </button>
        <button
          type="button"
          className="extension-popup-hidden-status"
          onClick={() => handleReminderAction("skip-once")}
        >
          Skip once
        </button>
        <button type="button" onClick={onOpenOptions}>
          Send test notification
        </button>
      </div>
      <p
        className="extension-popup-hidden-status"
        aria-label="Proactive loop status"
      >
        <strong>
          {settings.proactiveRemindersEnabled ? "Enabled" : "Disabled"}
        </strong>
        <span>
          {settings.proactiveRemindersEnabled
            ? "Proactive loops are enabled."
            : "Enable proactive loops in Options to use local browser notifications."}
        </span>
      </p>

      {actionStatus && (
        <p className="extension-live-status" role="status" aria-live="polite">
          {actionStatus}
        </p>
      )}
      <ExtensionHeadsUp
        upcomingReminders={upcomingReminders}
        currentDate={now}
      />
      <p className="extension-popup-running">
        VitaLoop is running <span aria-hidden="true" />
      </p>
    </main>
  );
}
