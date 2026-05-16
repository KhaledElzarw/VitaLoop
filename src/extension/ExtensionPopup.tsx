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
            d="M14 9.5h20l-2.4 29H16.4L14 9.5Z"
            fill="rgba(255, 255, 255, 0.7)"
            stroke="rgba(77, 39, 199, 0.48)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            className="activity-water-fill"
            d="M17.4 28.7c4.3-2.8 8.8 2.8 13.2 0l-.7 7H18.1l-.7-7Z"
            fill="#33c5d6"
          />
          <path
            className="activity-water-wave"
            d="M17.5 26.5c4.2-3 8.8 3 13 0"
            fill="none"
            stroke="#0f9fab"
            strokeLinecap="round"
            strokeWidth="2"
          />
          <g className="activity-water-bubbles" fill="rgba(255, 255, 255, 0.78)">
            <circle cx="22" cy="31" r="1.3" />
            <circle cx="27" cy="34" r="1" />
            <circle cx="24.5" cy="28.7" r="0.9" />
          </g>
          <path
            className="activity-water-drop"
            d="M24 14c1.8 2 2.7 3.5 2.7 4.6a2.7 2.7 0 1 1-5.4 0c0-1.1.9-2.6 2.7-4.6Z"
            fill="rgba(51, 197, 214, 0.74)"
          />
          <path
            d="M19 14h10"
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
            d="M10.5 23.8c4.4-5.6 9-8.4 13.5-8.4s9.1 2.8 13.5 8.4"
            fill="none"
            stroke="rgba(77, 39, 199, 0.54)"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            className="activity-eye-lid"
            d="M14 27.5c4.8 4.7 15.2 4.7 20 0"
            fill="none"
            stroke="#4d27c7"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            d="M16 29.5l-2.2 2.2M21 31.5l-.7 3M27 31.5l.7 3M32 29.5l2.2 2.2"
            fill="none"
            stroke="rgba(29, 24, 48, 0.58)"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
          <path
            className="activity-eye-spark"
            d="M13 15l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1L13 15ZM35 14l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8.8-1.8Z"
            fill="#33c5d6"
          />
        </>
      );
    case "stretch":
      return (
        <>
          <path
            d="M12 39h24"
            fill="none"
            stroke="rgba(51, 197, 214, 0.42)"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <circle cx="24" cy="12" r="4.8" fill="#f7c78b" />
          <path
            d="M20 18h8l1.6 12h-11.2L20 18Z"
            fill="rgba(109, 61, 245, 0.78)"
          />
          <path
            d="M24 18v13"
            fill="none"
            stroke="rgba(255, 255, 255, 0.36)"
            strokeLinecap="round"
            strokeWidth="2"
          />
          <g className="activity-stretch-arms">
            <path
              d="M20 21c-4 1.2-7.1.4-9.4-2.2M28 21c3.1-3.5 5.6-6.9 7.4-10.3"
              fill="none"
              stroke="#33c5d6"
              strokeLinecap="round"
              strokeWidth="3.2"
            />
          </g>
          <path
            d="M21 30l-5.5 8M27 30l5.5 8"
            fill="none"
            stroke="#1d1830"
            strokeLinecap="round"
            strokeWidth="3.2"
          />
        </>
      );
    case "stand-walk":
      return (
        <>
          <path
            className="activity-walk-chair"
            d="M8 19h12v10h-8v9M19 29l3 9M10 38h13"
            fill="none"
            stroke="rgba(95, 90, 114, 0.72)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path
            d="M23 24h7M27.5 20.5L31 24l-3.5 3.5"
            fill="none"
            stroke="#33c5d6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.4"
          />
          <g className="activity-walk-person">
            <circle cx="35" cy="13" r="4.4" fill="#f7c78b" />
            <path
              d="M34 18l-1 11M33 22l-5 4M33 22l5 3M33 29l-6 8M33 29l7 6"
              fill="none"
              stroke="#6d3df5"
              strokeLinecap="round"
              strokeWidth="3.3"
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
          <path
            d="M11 10v27"
            fill="none"
            stroke="rgba(51, 197, 214, 0.5)"
            strokeDasharray="2.4 3.5"
            strokeLinecap="round"
            strokeWidth="2"
          />
          <g className="activity-posture-person">
            <circle cx="18" cy="15" r="4.4" fill="#f7c78b" />
            <path
              d="M18.5 20c2.4 3.2 3.3 7 2.7 11.2M21.2 31.2l-5.2 6M21.2 31.2l8 5M20 24l7.8 1.8"
              fill="none"
              stroke="#6d3df5"
              strokeLinecap="round"
              strokeWidth="3.2"
            />
          </g>
          <path
            className="activity-posture-spine"
            d="M16.2 20.5c2.7 3.8 3.7 8.8 2.8 15"
            fill="none"
            stroke="#33c5d6"
            strokeLinecap="round"
            strokeWidth="2"
          />
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
          <g className="activity-breath-petals" fill="rgba(51, 197, 214, 0.2)">
            <circle cx="24" cy="11" r="6.5" />
            <circle cx="35" cy="20" r="6.5" />
            <circle cx="31" cy="33" r="6.5" />
            <circle cx="17" cy="33" r="6.5" />
            <circle cx="13" cy="20" r="6.5" />
          </g>
          <circle cx="24" cy="17" r="4.3" fill="#f7c78b" />
          <path
            d="M24 22v9M16 30c3.2 3 12.8 3 16 0M18 36c3.5-2.6 8.5-2.6 12 0"
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
            d="M9 28h28a4 4 0 0 1 4 4v6H9V28Z"
            fill="rgba(109, 61, 245, 0.18)"
            stroke="rgba(77, 39, 199, 0.5)"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M11 22h13a5 5 0 0 1 5 5H11v-5Z"
            fill="rgba(255, 255, 255, 0.72)"
          />
          <circle cx="18" cy="24" r="4" fill="#f7c78b" />
          <path
            d="M35 26h7M38.5 18v8"
            fill="none"
            stroke="#80601a"
            strokeLinecap="round"
            strokeWidth="2"
          />
          <circle
            className="activity-sleep-glow"
            cx="38.5"
            cy="18"
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
          <circle cx="24" cy="20" r="6.8" fill="#f7c78b" />
          <path
            className="activity-mood-hands"
            d="M15 24c-2.8 1.1-4.2 3.3-4 6.4M33 24c2.8 1.1 4.2 3.3 4 6.4M14 30l-3 3M34 30l3 3"
            fill="none"
            stroke="#6d3df5"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            d="M18 30c3.5 3.4 8.5 3.4 12 0"
            fill="none"
            stroke="#1d1830"
            strokeLinecap="round"
            strokeWidth="2.4"
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
            d="M16 25c4-6 12-6 16 0M18 31c3-3.8 9-3.8 12 0"
            fill="none"
            stroke="#33c5d6"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            d="M24 12l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5L24 12Z"
            fill="#6d3df5"
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
