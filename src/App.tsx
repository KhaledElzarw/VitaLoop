import { useState } from "react";
import { reminders } from "./data/reminders";
import { type AppSettings, type ReminderDefinition } from "./domain/schemas";

const tagline = "Recurring wellness reminders for busy days.";

const screens = [
  { id: "home", label: "Home" },
  { id: "reminders", label: "Reminders" },
  { id: "settings", label: "Settings" },
  { id: "backlog", label: "Backlog" },
  { id: "watch-preview", label: "Watch Preview" },
  { id: "about", label: "About" },
] as const;

type ScreenId = (typeof screens)[number]["id"];

const defaultSettings: AppSettings = {
  quietHours: {
    enabled: true,
    start: "21:30",
    end: "07:00",
  },
  workdayWindow: {
    start: "08:30",
    end: "18:00",
  },
  reminderIntensity: "balanced",
  enabledReminderIds: reminders
    .filter((reminder) => reminder.enabledByDefault)
    .map((reminder) => reminder.id),
};

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

function SettingsScreen() {
  return (
    <section className="screen-panel">
      <h2 id="settings-heading">Settings</h2>
      <dl className="settings-list">
        <div>
          <dt>Quiet hours</dt>
          <dd>
            {defaultSettings.quietHours.start} to{" "}
            {defaultSettings.quietHours.end}
          </dd>
        </div>
        <div>
          <dt>Workday window</dt>
          <dd>
            {defaultSettings.workdayWindow.start} to{" "}
            {defaultSettings.workdayWindow.end}
          </dd>
        </div>
        <div>
          <dt>Reminder intensity</dt>
          <dd>{defaultSettings.reminderIntensity}</dd>
        </div>
      </dl>
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
