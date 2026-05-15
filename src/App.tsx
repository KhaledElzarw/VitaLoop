import { useState } from "react";
import { reminders } from "./data/reminders";
import { type AppSettings } from "./domain/schemas";

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
        {activeScreen === "home" && <HomeScreen />}
        {activeScreen === "reminders" && <RemindersScreen />}
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

function HomeScreen() {
  const enabledCount = reminders.filter(
    (reminder) => reminder.enabledByDefault,
  ).length;

  return (
    <section className="screen-panel">
      <h2 id="home-heading">A calmer way to remember small breaks</h2>
      <p>
        VitaLoop keeps recurring wellness nudges simple, optional, and easy to
        adjust around a full day.
      </p>
      <div className="summary-grid" aria-label="Foundation summary">
        <div>
          <strong>{reminders.length}</strong>
          <span>Reminder types planned</span>
        </div>
        <div>
          <strong>{enabledCount}</strong>
          <span>Enabled by default</span>
        </div>
        <div>
          <strong>Local</strong>
          <span>Current data direction</span>
        </div>
      </div>
    </section>
  );
}

function RemindersScreen() {
  return (
    <section className="screen-panel">
      <h2 id="reminders-heading">Reminders</h2>
      <p>Mocked reminders for the first web foundation.</p>
      <div className="reminder-list">
        {reminders.map((reminder) => (
          <article key={reminder.id} className="reminder-card">
            <div>
              <h3>{reminder.title}</h3>
              <p>{reminder.prompt}</p>
            </div>
            <span>{reminder.cadenceMinutes} min</span>
          </article>
        ))}
      </div>
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
