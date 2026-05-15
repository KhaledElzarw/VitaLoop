import { useState } from "react";
import { reminders } from "./data/reminders";
import { type AppSettings, type ReminderDefinition } from "./domain/schemas";
import { getDefaultAppSettings } from "./domain/settings";
import {
  settingsService,
  type SettingsService,
} from "./services/settingsService";

const tagline = "Recurring wellness reminders for busy days.";

const screens = [
  { id: "home", label: "Home" },
  { id: "reminders", label: "Reminders" },
  { id: "settings", label: "Settings" },
  { id: "backlog", label: "Backlog" },
  { id: "watch-preview", label: "Watch Preview" },
  { id: "about", label: "About" },
] as const;

const reminderIntensityOptions = [
  { value: "gentle", label: "Gentle" },
  { value: "balanced", label: "Balanced" },
  { value: "active", label: "Active" },
] as const;

type ScreenId = (typeof screens)[number]["id"];
type ReminderId = AppSettings["preferredReminderCategories"][number];

const backlogCategories = [
  "P0 Foundation",
  "P0 Core Screens",
  "P0 Reminder Categories",
  "P1 Settings",
  "P2 Mobile Packaging",
  "P2 Apple Watch",
];

function getOrderedReminders(reminderList: ReminderDefinition[]) {
  return [...reminderList].sort(
    (first, second) => first.displayPriority - second.displayPriority,
  );
}

function getEnabledReminders(reminderList: ReminderDefinition[]) {
  return getOrderedReminders(reminderList).filter(
    (reminder) => reminder.enabledByDefault,
  );
}

function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("home");
  const activeLabel = screens.find((screen) => screen.id === activeScreen)?.label;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">VitaLoop</p>
          <h1>VitaLoop</h1>
          <p>{tagline}</p>
        </div>
      </header>

      <main
        className="app-main"
        aria-labelledby={`${activeScreen}-heading`}
      >
        <p className="screen-label">{activeLabel}</p>
        {activeScreen === "home" && <HomeScreen reminders={reminders} />}
        {activeScreen === "reminders" && <RemindersScreen reminders={reminders} />}
        {activeScreen === "settings" && <SettingsScreen />}
        {activeScreen === "backlog" && <BacklogScreen />}
        {activeScreen === "watch-preview" && <WatchPreviewScreen />}
        {activeScreen === "about" && <AboutScreen />}
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {screens.map((screen) => (
          <button
            key={screen.id}
            type="button"
            aria-current={activeScreen === screen.id ? "page" : undefined}
            onClick={() => setActiveScreen(screen.id)}
          >
            {screen.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

type ReminderScreenProps = {
  reminders: ReminderDefinition[];
  hasError?: boolean;
};

export function HomeScreen({ reminders }: ReminderScreenProps) {
  const enabledReminders = getEnabledReminders(reminders);
  const nextReminder = enabledReminders[0];

  return (
    <section className="screen-panel">
      <h2 id="home-heading">Today overview</h2>
      <p>
        VitaLoop keeps recurring wellness nudges simple, optional, and easy to
        adjust around a full day.
      </p>
      <div className="summary-grid" aria-label="Foundation summary">
        <div>
          <strong>{enabledReminders.length}</strong>
          <span>Active reminders</span>
        </div>
        <div>
          <strong>{nextReminder?.title ?? "None"}</strong>
          <span>Next wellness nudge</span>
        </div>
        <div>
          <strong>Gentle</strong>
          <span>Wellness rhythm</span>
        </div>
      </div>
      {nextReminder ? (
        <article className="next-nudge" aria-label="Next wellness nudge">
          <p className="eyebrow">Next wellness nudge</p>
          <h3>{nextReminder.title}</h3>
          <p>{nextReminder.description}</p>
          <span>{nextReminder.suggestedFrequency}</span>
        </article>
      ) : (
        <p className="empty-copy">
          No active reminders are available in this mocked view yet.
        </p>
      )}
      <p className="rhythm-summary">
        Current rhythm: hydration and screen breaks lead the day, with movement
        reminders spaced in as light resets.
      </p>
    </section>
  );
}

export function RemindersScreen({
  reminders,
  hasError = false,
}: ReminderScreenProps) {
  const orderedReminders = getOrderedReminders(reminders);
  const [selectedReminderId, setSelectedReminderId] = useState(
    orderedReminders[0]?.id,
  );
  const selectedReminder =
    orderedReminders.find((reminder) => reminder.id === selectedReminderId) ??
    orderedReminders[0];

  if (hasError) {
    return (
      <section className="screen-panel">
        <h2 id="reminders-heading">Reminders</h2>
        <div className="state-message" role="alert">
          <h3>Reminders are unavailable</h3>
          <p>
            VitaLoop could not prepare the reminder preview. Try again when the
            app state is ready.
          </p>
        </div>
      </section>
    );
  }

  if (orderedReminders.length === 0) {
    return (
      <section className="screen-panel">
        <h2 id="reminders-heading">Reminders</h2>
        <div className="state-message">
          <h3>No reminders to show</h3>
          <p>
            Add mocked reminder categories to preview a gentle wellness rhythm.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="screen-panel">
      <h2 id="reminders-heading">Reminders</h2>
      <p>
        Preview the recurring wellness categories VitaLoop can suggest during a
        busy day.
      </p>
      <div className="reminder-list" aria-label="Reminder categories">
        {orderedReminders.map((reminder) => (
          <button
            key={reminder.id}
            type="button"
            className="reminder-card"
            aria-label={`Show ${reminder.title} details`}
            aria-pressed={selectedReminder?.id === reminder.id}
            onClick={() => setSelectedReminderId(reminder.id)}
          >
            <div>
              <span className="category-label">{reminder.category}</span>
              <h3>{reminder.title}</h3>
              <p>{reminder.wellnessIntent}</p>
              <p className="next-preview">
                Next reminder preview: follows the{" "}
                {reminder.suggestedFrequency.toLowerCase()} rhythm.
              </p>
            </div>
            <div className="card-meta">
              <span>{reminder.suggestedFrequency}</span>
              <span
                className={
                  reminder.enabledByDefault ? "status-enabled" : "status-muted"
                }
              >
                {reminder.enabledByDefault ? "Enabled" : "Preview"}
              </span>
            </div>
          </button>
        ))}
      </div>
      {selectedReminder && (
        <aside
          className="details-panel"
          role="region"
          aria-label="Selected reminder details"
        >
          <p className="eyebrow">Selected reminder</p>
          <h3 id="selected-reminder-heading">{selectedReminder.title}</h3>
          <p>{selectedReminder.description}</p>
          <dl>
            <div>
              <dt>Category</dt>
              <dd>{selectedReminder.category}</dd>
            </div>
            <div>
              <dt>Frequency</dt>
              <dd>{selectedReminder.suggestedFrequency}</dd>
            </div>
            <div>
              <dt>Next reminder</dt>
              <dd>
                Next reminder preview: {selectedReminder.title} follows the{" "}
                {selectedReminder.suggestedFrequency.toLowerCase()} rhythm.
              </dd>
            </div>
          </dl>
        </aside>
      )}
    </section>
  );
}

type SettingsScreenProps = {
  service?: SettingsService;
  reminderList?: ReminderDefinition[];
};

type SettingsStatus = "idle" | "saved" | "reset" | "error";

export function SettingsScreen({
  service = settingsService,
  reminderList = reminders,
}: SettingsScreenProps) {
  const [settings, setSettings] = useState<AppSettings>(() =>
    service.loadSettings(),
  );
  const [status, setStatus] = useState<SettingsStatus>("idle");

  function updateSetting<Key extends keyof AppSettings>(
    key: Key,
    value: AppSettings[Key],
  ) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }));
    setStatus("idle");
  }

  function toggleReminderCategory(reminderId: ReminderId) {
    setSettings((currentSettings) => {
      const isPreferred =
        currentSettings.preferredReminderCategories.includes(reminderId);
      const nextCategories = isPreferred
        ? currentSettings.preferredReminderCategories.filter(
            (category) => category !== reminderId,
          )
        : [...currentSettings.preferredReminderCategories, reminderId];

      if (nextCategories.length === 0) {
        return currentSettings;
      }

      return {
        ...currentSettings,
        preferredReminderCategories: nextCategories,
      };
    });
    setStatus("idle");
  }

  function saveCurrentSettings() {
    setStatus(service.saveSettings(settings) ? "saved" : "error");
  }

  function resetSettings() {
    const defaultSettings = getDefaultAppSettings();
    setSettings(defaultSettings);
    setStatus(service.saveSettings(defaultSettings) ? "reset" : "error");
  }

  return (
    <section className="screen-panel">
      <h2 id="settings-heading">Settings</h2>
      <p>
        Keep recurring nudges useful by choosing quiet hours, workday timing,
        and the reminder categories that fit your day.
      </p>
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          saveCurrentSettings();
        }}
      >
        <label className="field">
          <span>Timezone</span>
          <input
            type="text"
            value={settings.timezone}
            onChange={(event) =>
              updateSetting("timezone", event.currentTarget.value)
            }
          />
        </label>

        <fieldset className="settings-group">
          <legend>Quiet hours</legend>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.quietHoursEnabled}
              onChange={(event) =>
                updateSetting("quietHoursEnabled", event.currentTarget.checked)
              }
            />
            <span>Quiet hours enabled</span>
          </label>
          <div className="settings-columns">
            <label className="field">
              <span>Quiet hours start</span>
              <input
                type="time"
                value={settings.quietHoursStart}
                onChange={(event) =>
                  updateSetting("quietHoursStart", event.currentTarget.value)
                }
              />
            </label>
            <label className="field">
              <span>Quiet hours end</span>
              <input
                type="time"
                value={settings.quietHoursEnd}
                onChange={(event) =>
                  updateSetting("quietHoursEnd", event.currentTarget.value)
                }
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="settings-group">
          <legend>Reminder intensity</legend>
          <div className="radio-grid">
            {reminderIntensityOptions.map((option) => (
              <label key={option.value} className="choice-card">
                <input
                  type="radio"
                  name="reminderIntensity"
                  value={option.value}
                  checked={settings.reminderIntensity === option.value}
                  onChange={() =>
                    updateSetting("reminderIntensity", option.value)
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="settings-group">
          <legend>Workday window</legend>
          <div className="settings-columns">
            <label className="field">
              <span>Workday start</span>
              <input
                type="time"
                value={settings.workdayStart}
                onChange={(event) =>
                  updateSetting("workdayStart", event.currentTarget.value)
                }
              />
            </label>
            <label className="field">
              <span>Workday end</span>
              <input
                type="time"
                value={settings.workdayEnd}
                onChange={(event) =>
                  updateSetting("workdayEnd", event.currentTarget.value)
                }
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="settings-group">
          <legend>Preferred reminder categories</legend>
          <div className="category-grid">
            {reminderList.map((reminder) => {
              const isPreferred =
                settings.preferredReminderCategories.includes(reminder.id);
              const isOnlyPreferred =
                isPreferred &&
                settings.preferredReminderCategories.length === 1;

              return (
                <label key={reminder.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={isPreferred}
                    disabled={isOnlyPreferred}
                    onChange={() => toggleReminderCategory(reminder.id)}
                  />
                  <span>{reminder.title}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="settings-actions">
          <button type="submit">Save settings</button>
          <button type="button" onClick={resetSettings}>
            Reset to defaults
          </button>
        </div>

        {status === "saved" && (
          <p className="settings-status" role="status">
            Settings saved.
          </p>
        )}
        {status === "reset" && (
          <p className="settings-status" role="status">
            Defaults restored.
          </p>
        )}
        {status === "error" && (
          <p className="settings-error" role="alert">
            Settings could not be saved. Check the values and try again.
          </p>
        )}
      </form>
    </section>
  );
}

function BacklogScreen() {
  return (
    <section className="screen-panel">
      <h2 id="backlog-heading">Backlog</h2>
      <p>Core delivery areas carried forward from the product backlog.</p>
      <ul className="backlog-list">
        {backlogCategories.map((category) => (
          <li key={category}>{category}</li>
        ))}
      </ul>
    </section>
  );
}

function WatchPreviewScreen() {
  return (
    <section className="screen-panel">
      <h2 id="watch-preview-heading">Watch Preview</h2>
      <div className="watch-preview" aria-label="Apple Watch preview card">
        <span>Hydration</span>
        <strong>Time for a small sip?</strong>
        <p>Done · Snooze · Skip</p>
      </div>
    </section>
  );
}

function AboutScreen() {
  return (
    <section className="screen-panel">
      <h2 id="about-heading">About</h2>
      <p>
        VitaLoop supports general wellness routines and everyday self-care
        reminders. It is not medical advice, diagnosis, treatment, or emergency
        guidance.
      </p>
      <p>
        Reminder data and preferences are planned as local-first user settings
        unless future work explicitly adds another storage path.
      </p>
    </section>
  );
}

export default App;
