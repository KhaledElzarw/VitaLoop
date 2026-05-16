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

type ActivityIconVariant = ReminderDefinition["id"] | "fallback";

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

function renderActivityIconShape(variant: ActivityIconVariant) {
  switch (variant) {
    case "hydration":
      return (
        <>
          <path
            d="M15 10h18l-2 28H17L15 10Z"
            fill="rgba(255, 255, 255, 0.68)"
            stroke="rgba(77, 39, 199, 0.52)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            className="activity-water-fill"
            d="M18.3 29.5c3.9-2.7 7.4 2.7 11.4 0l-.7 6.2H19l-.7-6.2Z"
            fill="#33c5d6"
          />
          <path
            className="activity-water-wave"
            d="M18.3 27.5c3.9-2.8 7.4 2.8 11.4 0"
            fill="none"
            stroke="#0f9fab"
            strokeLinecap="round"
            strokeWidth="2"
          />
          <path
            d="M19 15h10"
            fill="none"
            stroke="rgba(255, 255, 255, 0.9)"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
        </>
      );
    case "eye-strain":
      return (
        <>
          <circle
            className="activity-relief-ring"
            cx="24"
            cy="24"
            r="17"
            fill="none"
            stroke="rgba(51, 197, 214, 0.32)"
            strokeWidth="3"
          />
          <path
            d="M10 24c3.8-6.2 9-9.3 14-9.3S34.2 17.8 38 24c-3.8 6.2-9 9.3-14 9.3S13.8 30.2 10 24Z"
            fill="rgba(255, 255, 255, 0.74)"
            stroke="rgba(77, 39, 199, 0.54)"
            strokeWidth="2"
          />
          <circle cx="24" cy="24" r="4.4" fill="#33c5d6" />
          <path
            className="activity-eye-lid"
            d="M13 21c4.2 3.5 17.8 3.5 22 0"
            fill="none"
            stroke="#4d27c7"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
        </>
      );
    case "stretch":
      return (
        <>
          <circle cx="24" cy="13" r="5" fill="#f7c78b" />
          <path
            d="M24 18v12"
            fill="none"
            stroke="#6d3df5"
            strokeLinecap="round"
            strokeWidth="4"
          />
          <g className="activity-stretch-arms">
            <path
              d="M14 24c3.4-4.6 6.7-6.9 10-6.9s6.6 2.3 10 6.9"
              fill="none"
              stroke="#33c5d6"
              strokeLinecap="round"
              strokeWidth="3.3"
            />
          </g>
          <path
            d="M24 30l-7 8M24 30l7 8"
            fill="none"
            stroke="#4d27c7"
            strokeLinecap="round"
            strokeWidth="3.5"
          />
        </>
      );
    case "stand-walk":
      return (
        <>
          <path
            className="activity-walk-chair"
            d="M12 18h11v10h-8v9M22 28l3 9"
            fill="none"
            stroke="rgba(95, 90, 114, 0.72)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <g className="activity-walk-person">
            <circle cx="31" cy="13" r="4.6" fill="#f7c78b" />
            <path
              d="M31 18v11M31 21l-6 5M31 21l6 4M31 29l-6 8M31 29l7 7"
              fill="none"
              stroke="#6d3df5"
              strokeLinecap="round"
              strokeWidth="3.4"
            />
          </g>
        </>
      );
    case "posture":
      return (
        <>
          <rect
            x="28"
            y="12"
            width="11"
            height="10"
            rx="2"
            fill="rgba(51, 197, 214, 0.28)"
            stroke="#4d27c7"
            strokeWidth="2"
          />
          <path
            d="M33.5 22v5M28 27h11"
            fill="none"
            stroke="#4d27c7"
            strokeLinecap="round"
            strokeWidth="2"
          />
          <g className="activity-posture-person">
            <circle cx="18" cy="15" r="4.4" fill="#f7c78b" />
            <path
              d="M19 20c2.6 3 3.8 6.5 3.5 11M22.5 31l-5 6M22.5 31l7 5M20 24l8 1.5"
              fill="none"
              stroke="#6d3df5"
              strokeLinecap="round"
              strokeWidth="3.2"
            />
          </g>
          <path
            d="M10 38h29"
            stroke="rgba(95, 90, 114, 0.36)"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      );
    case "breathing-reset":
      return (
        <>
          <circle
            className="activity-breath-ring"
            cx="24"
            cy="24"
            r="14"
            fill="rgba(51, 197, 214, 0.14)"
            stroke="rgba(51, 197, 214, 0.46)"
            strokeWidth="3"
          />
          <circle cx="24" cy="15" r="4.4" fill="#f7c78b" />
          <path
            d="M24 20v9M17 27c3.1 2.8 10.9 2.8 14 0M19 35c2.2-2.5 7.8-2.5 10 0"
            fill="none"
            stroke="#6d3df5"
            strokeLinecap="round"
            strokeWidth="3.2"
          />
        </>
      );
    case "sleep-routine":
      return (
        <>
          <path
            className="activity-sleep-moon"
            d="M34 8.5a8.8 8.8 0 0 0 5.2 14.4A10.8 10.8 0 1 1 34 8.5Z"
            fill="#80601a"
            opacity="0.84"
          />
          <path
            d="M10 25h25a5 5 0 0 1 5 5v7H10V25Z"
            fill="rgba(109, 61, 245, 0.18)"
            stroke="rgba(77, 39, 199, 0.5)"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M10 20h14a5 5 0 0 1 5 5H10v-5Z"
            fill="rgba(255, 255, 255, 0.72)"
          />
          <circle cx="18" cy="22" r="4" fill="#f7c78b" />
          <circle
            className="activity-sleep-glow"
            cx="36"
            cy="22"
            r="5"
            fill="#ffbd3e"
            opacity="0.52"
          />
        </>
      );
    case "mood-energy":
      return (
        <>
          <circle
            className="activity-mood-aura"
            cx="24"
            cy="22"
            r="15"
            fill="rgba(51, 197, 214, 0.14)"
          />
          <circle cx="24" cy="20" r="7" fill="#f7c78b" />
          <path
            d="M16 31c3.8 4 12.2 4 16 0M16 22c-3 1-4.7 3-5 6M32 22c3 1 4.7 3 5 6"
            fill="none"
            stroke="#6d3df5"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            className="activity-mood-spark"
            d="M34 10l1.7 3.6 3.8 1.4-3.8 1.4L34 20l-1.7-3.6-3.8-1.4 3.8-1.4L34 10Z"
            fill="#33c5d6"
          />
        </>
      );
    case "fallback":
      return (
        <>
          <circle
            className="activity-fallback-pulse"
            cx="24"
            cy="24"
            r="15"
            fill="rgba(109, 61, 245, 0.14)"
            stroke="rgba(109, 61, 245, 0.34)"
            strokeWidth="3"
          />
          <path
            d="M24 13l2.5 7.5H34l-6.1 4.4 2.4 7.1-6.3-4.5-6.3 4.5 2.4-7.1L14 20.5h7.5L24 13Z"
            fill="#33c5d6"
          />
        </>
      );
  }
}

function ActivityIcon({ reminder }: { reminder: ReminderDefinition }) {
  const variant = getActivityIconVariant(reminder);

  return (
    <svg
      className={`extension-activity-icon extension-activity-icon-${variant}`}
      data-activity-icon={variant}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      {renderActivityIconShape(variant)}
    </svg>
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
          <p className="extension-reminder-time">
            {formatReminderTime(nextSchedule.nextAt)}
          </p>
          <div className="extension-reminder-meta">
            <div className="extension-reminder-title-row">
              <ActivityIcon reminder={nextSchedule.reminder} />
              <div className="extension-reminder-title-copy">
                <h2>{nextSchedule.reminder.title}</h2>
                <p>{nextSchedule.reminder.description}</p>
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
    </main>
  );
}
