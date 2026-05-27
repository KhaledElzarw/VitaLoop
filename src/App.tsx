import { useState } from "react";
import { reminders } from "./data/reminders";
import {
  CUSTOM_REMINDER_CATEGORY_MAX_LENGTH,
  CUSTOM_REMINDER_MESSAGE_MAX_LENGTH,
  CUSTOM_REMINDER_TITLE_MAX_LENGTH,
  createCustomReminderDefinition,
  createDefaultCustomReminderSchedule,
  defaultCustomReminderDraft,
  deleteCustomReminderSettings,
  formatCustomReminderSchedule,
  formatDateInputValue,
  getCustomReminderDraft,
  getCustomReminderDraftFromRecommendation,
  getCustomReminderCharacterLimitStatus,
  getRecommendedCustomReminders,
  getReminderListWithCustomReminders,
  upsertCustomReminderSettings,
  validateCustomReminderDraft,
  weekdayLabels,
  weekdayOrder,
  type CustomReminderDraft,
  type CustomReminderDraftErrors,
  type CharacterLimitStatus,
} from "./domain/customReminders";
import {
  applyReminderAction,
  createReminderActionState,
  getActionAwareNextReminder,
  getActionAwareUpcomingReminders,
  type ActionAwareUpcomingReminder,
  type ReminderActionType,
} from "./domain/reminderActions";
import {
  appendReminderHistoryEntry,
  createReminderHistoryEntry,
  removeReminderHistoryEntriesForDate,
  type ReminderHistoryEntry,
} from "./domain/reminderHistory";
import {
  formatReminderTime,
  formatReminderCountdown,
  getEnabledReminders as getScheduledEnabledReminders,
  getReminderSchedule,
} from "./domain/scheduling";
import {
  type AppSettings,
  type CustomReminderSchedule,
  type ReminderDefinition,
  type Weekday,
} from "./domain/schemas";
import { getDefaultAppSettings } from "./domain/settings";
import {
  settingsService,
  type SettingsService,
} from "./services/settingsService";
import {
  reminderHistoryService,
  type ReminderHistoryService,
} from "./services/reminderHistoryService";

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

const customReminderScheduleOptions = [
  { value: "interval", label: "Time interval" },
  { value: "dailyInterval", label: "Day interval" },
  { value: "weekdayInterval", label: "Weekdays" },
  { value: "oneTime", label: "Date and time" },
] as const;

type ScreenId = (typeof screens)[number]["id"];
type ReminderId = AppSettings["preferredReminderCategories"][number];
type SettingsPanelId =
  | "general"
  | "quiet-hours"
  | "categories"
  | "advanced";
type CustomReminderWizardStep = "details" | "recurrence" | "review";

const defaultPreviewDate = new Date(2026, 4, 15, 10, 0);

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

function getCharacterLimitHintClassName(status: CharacterLimitStatus) {
  return status.tone === "near-limit"
    ? "character-limit-hint character-limit-hint-danger"
    : "character-limit-hint";
}

function SettingsIcon({ label }: { label: string }) {
  const glyph = label.slice(0, 1).toUpperCase();

  return (
    <span className="settings-icon" aria-hidden="true">
      {glyph}
    </span>
  );
}

function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("home");
  const [appSettings, setAppSettings] = useState<AppSettings>(() =>
    settingsService.loadSettings(),
  );
  const [currentDate] = useState(() => new Date(defaultPreviewDate));
  const appReminders = getReminderListWithCustomReminders(
    reminders,
    appSettings,
  );
  const activeLabel = screens.find((screen) => screen.id === activeScreen)?.label;

  return (
    <div className={`app-shell app-screen-${activeScreen}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <div>
          <p className="eyebrow">VitaLoop</p>
          <p className="brand-title">VitaLoop</p>
          <p>{tagline}</p>
        </div>
      </header>

      <main
        id="main-content"
        className="app-main"
        aria-labelledby={`${activeScreen}-heading`}
        tabIndex={-1}
      >
        <p className="screen-label">{activeLabel}</p>
        {activeScreen === "home" && (
          <HomeScreen
            reminders={appReminders}
            settings={appSettings}
            currentDate={currentDate}
          />
        )}
        {activeScreen === "reminders" && (
          <RemindersScreen
            reminders={appReminders}
            settings={appSettings}
            currentDate={currentDate}
          />
        )}
        {activeScreen === "settings" && (
          <SettingsScreen
            initialSettings={appSettings}
            onSettingsChange={setAppSettings}
          />
        )}
        {activeScreen === "backlog" && <BacklogScreen />}
        {activeScreen === "watch-preview" && <WatchPreviewScreen />}
        {activeScreen === "about" && <AboutScreen />}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {screens.map((screen) => (
          <button
            key={screen.id}
            type="button"
            aria-controls="main-content"
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
  settings?: AppSettings;
  currentDate?: Date;
  hasError?: boolean;
  historyService?: ReminderHistoryService;
  initialHistory?: ReminderHistoryEntry[];
};

type HeadsUpProps = {
  upcomingReminders: ActionAwareUpcomingReminder[];
  currentDate: Date;
};

function HeadsUp({ upcomingReminders, currentDate }: HeadsUpProps) {
  return (
    <section className="heads-up" aria-label="Head's up">
      <h2>Head's up</h2>
      {upcomingReminders.length > 0 ? (
        <ul>
          {upcomingReminders.slice(0, 3).map((schedule) => (
            <li key={schedule.reminder.id}>
              <strong>{schedule.reminder.title}</strong>
              <span>
                {formatReminderCountdown(schedule.nextAt, currentDate)} ·{" "}
                {formatReminderTime(schedule.nextAt)}
              </span>
              {schedule.isSnoozed ? (
                <span>Snoozed</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>No upcoming reminders right now.</p>
      )}
    </section>
  );
}

export function HomeScreen({
  reminders,
  settings = getDefaultAppSettings(),
  currentDate = defaultPreviewDate,
  historyService = reminderHistoryService,
  initialHistory,
}: ReminderScreenProps) {
  const [actionState, setActionState] = useState(createReminderActionState);
  const [actionStatus, setActionStatus] = useState("");
  const [history, setHistory] = useState<ReminderHistoryEntry[]>(() =>
    initialHistory ?? historyService.loadReminderHistory(),
  );
  const enabledReminders = getScheduledEnabledReminders(reminders, settings);
  const nextSchedule = getActionAwareNextReminder(
    reminders,
    settings,
    currentDate,
    actionState,
  );
  const upcomingReminders = getActionAwareUpcomingReminders(
    reminders,
    settings,
    currentDate,
    actionState,
  );

  function handleReminderAction(actionType: ReminderActionType) {
    if (!nextSchedule) {
      return;
    }

    const result = applyReminderAction(
      actionType,
      nextSchedule,
      settings,
      currentDate,
      actionState,
    );

    setActionState(result.state);
    setActionStatus(result.message);

    const historyEntry = createReminderHistoryEntry({
      actionType,
      schedule: nextSchedule,
      result,
      occurredAt: currentDate,
    });
    const nextHistory = appendReminderHistoryEntry(history, historyEntry);

    setHistory(nextHistory);
    historyService.saveReminderHistory(nextHistory);
  }

  return (
    <section className="screen-panel">
      <h1 id="home-heading">Today overview</h1>
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
          <strong>{nextSchedule?.reminder.title ?? "None"}</strong>
          <span>Next wellness nudge</span>
        </div>
        <div>
          <strong>Gentle</strong>
          <span>Wellness rhythm</span>
        </div>
      </div>
      {nextSchedule ? (
        <article className="next-nudge" aria-label="Next wellness nudge">
          <p className="eyebrow">Next wellness nudge</p>
          <h3>{nextSchedule.reminder.title}</h3>
          <p>{nextSchedule.reminder.description}</p>
          <div className="schedule-tags">
            <span>
              Calculated next reminder:{" "}
              {formatReminderTime(nextSchedule.nextAt)}
            </span>
            <span>{nextSchedule.frequencyMinutes} min rhythm</span>
          </div>
          <div className="nudge-actions" aria-label="Reminder actions">
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
        </article>
      ) : (
        <p className="empty-copy">
          No active reminders are available in this mocked view yet.
        </p>
      )}
      {actionStatus && (
        <p className="action-status" role="status" aria-live="polite">
          {actionStatus}
        </p>
      )}
      <HeadsUp
        upcomingReminders={upcomingReminders}
        currentDate={currentDate}
      />
      <p className="rhythm-summary">
        Current rhythm: {settings.reminderIntensity} reminders stay inside your
        workday window and pause during quiet hours.
      </p>
    </section>
  );
}

export function RemindersScreen({
  reminders,
  settings = getDefaultAppSettings(),
  currentDate = defaultPreviewDate,
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
        <h1 id="reminders-heading">Reminders</h1>
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
        <h1 id="reminders-heading">Reminders</h1>
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
      <h1 id="reminders-heading">Reminders</h1>
      <p>
        Preview the recurring wellness categories VitaLoop can suggest during a
        busy day.
      </p>
      <div className="reminder-list" aria-label="Reminder categories">
        {orderedReminders.map((reminder) => {
          const schedule = getReminderSchedule(reminder, settings, currentDate);
          const isEnabled =
            settings.preferredReminderCategories.includes(reminder.id);

          return (
            <button
              key={reminder.id}
              type="button"
              className="reminder-card"
              aria-pressed={selectedReminder?.id === reminder.id}
              onClick={() => setSelectedReminderId(reminder.id)}
            >
              <div>
                <span className="category-label">{reminder.category}</span>
                <h3>{reminder.title}</h3>
                <p>{reminder.wellnessIntent}</p>
                <p className="next-preview">
                  {schedule.nextAt
                    ? `Next reminder preview: ${formatReminderTime(
                        schedule.nextAt,
                      )}`
                    : "Not scheduled while this category is paused."}
                </p>
              </div>
              <div className="card-meta">
                <span>{schedule.frequencyMinutes} min</span>
                <span
                  className={isEnabled ? "status-enabled" : "status-muted"}
                >
                  {isEnabled ? "Enabled" : "Paused"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {selectedReminder && (
        <ReminderDetails
          reminder={selectedReminder}
          settings={settings}
          currentDate={currentDate}
        />
      )}
    </section>
  );
}

function ReminderDetails({
  reminder,
  settings,
  currentDate,
}: {
  reminder: ReminderDefinition;
  settings: AppSettings;
  currentDate: Date;
}) {
  const schedule = getReminderSchedule(reminder, settings, currentDate);

  return (
    <aside
      className="details-panel"
      role="region"
      aria-label="Selected reminder details"
    >
      <p className="eyebrow">Selected reminder</p>
      <h3 id="selected-reminder-heading">{reminder.title}</h3>
      <p>{reminder.description}</p>
      <dl>
        <div>
          <dt>Category</dt>
          <dd>{reminder.category}</dd>
        </div>
        <div>
          <dt>Frequency</dt>
          <dd>{schedule.frequencyMinutes} minutes</dd>
        </div>
        <div>
          <dt>Next reminder</dt>
          <dd>
            {schedule.nextAt
              ? `Next reminder preview: ${reminder.title} at ${formatReminderTime(
                  schedule.nextAt,
                )}.`
              : `${reminder.title} is paused in preferences.`}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

type SettingsScreenProps = {
  service?: SettingsService;
  reminderList?: ReminderDefinition[];
  initialSettings?: AppSettings;
  onSettingsChange?: (settings: AppSettings) => void;
  historyService?: ReminderHistoryService;
  currentDate?: Date;
};

type SettingsStatus =
  | "idle"
  | "saved"
  | "reset"
  | "progress-reset"
  | "error"
  | "custom-error"
  | "custom-removed";

export function SettingsScreen({
  service = settingsService,
  reminderList = reminders,
  initialSettings,
  onSettingsChange,
  historyService = reminderHistoryService,
  currentDate = new Date(),
}: SettingsScreenProps) {
  const [settings, setSettings] = useState<AppSettings>(() =>
    initialSettings ?? service.loadSettings(),
  );
  const [status, setStatus] = useState<SettingsStatus>("idle");
  const [customDraft, setCustomDraft] = useState<CustomReminderDraft>({
    ...defaultCustomReminderDraft,
  });
  const [activeSettingsPanel, setActiveSettingsPanel] =
    useState<SettingsPanelId>("general");
  const [isCustomReminderWizardOpen, setIsCustomReminderWizardOpen] =
    useState(false);
  const [customReminderWizardStep, setCustomReminderWizardStep] =
    useState<CustomReminderWizardStep>("recurrence");
  const [customRecommendations, setCustomRecommendations] = useState(() =>
    getRecommendedCustomReminders(),
  );
  const [customDraftErrors, setCustomDraftErrors] =
    useState<CustomReminderDraftErrors>({});
  const [pendingDeleteCustomReminderId, setPendingDeleteCustomReminderId] =
    useState<ReminderId | null>(null);
  const reminderCategories = getOrderedReminders(reminderList);
  const titleLimitStatus = getCustomReminderCharacterLimitStatus(
    customDraft.title,
    CUSTOM_REMINDER_TITLE_MAX_LENGTH,
  );
  const categoryLimitStatus = getCustomReminderCharacterLimitStatus(
    customDraft.category,
    CUSTOM_REMINDER_CATEGORY_MAX_LENGTH,
  );
  const messageLimitStatus = getCustomReminderCharacterLimitStatus(
    customDraft.description,
    CUSTOM_REMINDER_MESSAGE_MAX_LENGTH,
  );
  const titleDescriptionIds = [
    titleLimitStatus ? "custom-reminder-title-limit" : "",
    customDraftErrors.title ? "custom-reminder-title-error" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const categoryDescriptionIds = [
    categoryLimitStatus ? "custom-reminder-category-limit" : "",
    customDraftErrors.category ? "custom-reminder-category-error" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const messageDescriptionIds = [
    messageLimitStatus ? "custom-reminder-message-limit" : "",
    customDraftErrors.description ? "custom-reminder-message-error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  function updateSetting<Key extends keyof AppSettings>(
    key: Key,
    value: AppSettings[Key],
  ) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }));
    setStatus("idle");
    setPendingDeleteCustomReminderId(null);
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
    setPendingDeleteCustomReminderId(null);
  }

  function updateCustomDraft<Key extends keyof CustomReminderDraft>(
    key: Key,
    value: CustomReminderDraft[Key],
  ) {
    setCustomDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }));
    setCustomDraftErrors({});
    setStatus("idle");
  }

  function updateCustomSchedule(schedule: CustomReminderSchedule) {
    setCustomDraft((currentDraft) => ({
      ...currentDraft,
      schedule,
    }));
    setCustomDraftErrors({});
    setStatus("idle");
  }

  function updateCustomScheduleType(type: CustomReminderSchedule["type"]) {
    updateCustomSchedule(createDefaultCustomReminderSchedule(type));
  }

  function updateCustomIntervalMinutes(intervalMinutes: number) {
    updateCustomSchedule({
      type: "interval",
      intervalMinutes,
    });
  }

  function updateCustomDayInterval(dayIntervalDays: number) {
    if (customDraft.schedule.type !== "dailyInterval") {
      return;
    }

    updateCustomSchedule({
      ...customDraft.schedule,
      dayIntervalDays,
    });
  }

  function updateCustomDailyTime(timeOfDay: string) {
    if (customDraft.schedule.type !== "dailyInterval") {
      return;
    }

    updateCustomSchedule({
      ...customDraft.schedule,
      timeOfDay,
    });
  }

  function updateCustomWeekdayTime(timeOfDay: string) {
    if (customDraft.schedule.type !== "weekdayInterval") {
      return;
    }

    updateCustomSchedule({
      ...customDraft.schedule,
      timeOfDay,
    });
  }

  function updateCustomOneTimeDate(date: string) {
    if (customDraft.schedule.type !== "oneTime") {
      return;
    }

    updateCustomSchedule({
      ...customDraft.schedule,
      date,
    });
  }

  function updateCustomOneTimeTime(timeOfDay: string) {
    if (customDraft.schedule.type !== "oneTime") {
      return;
    }

    updateCustomSchedule({
      ...customDraft.schedule,
      timeOfDay,
    });
  }

  function isCustomWeekdaySelected(weekday: Weekday) {
    return (
      customDraft.schedule.type === "weekdayInterval" &&
      customDraft.schedule.weekdays.includes(weekday)
    );
  }

  function toggleCustomWeekday(weekday: Weekday) {
    if (customDraft.schedule.type !== "weekdayInterval") {
      return;
    }

    const weekdays = customDraft.schedule.weekdays.includes(weekday)
      ? customDraft.schedule.weekdays.filter((candidate) => candidate !== weekday)
      : [...customDraft.schedule.weekdays, weekday];

    updateCustomSchedule({
      ...customDraft.schedule,
      weekdays,
    });
  }

  function applyCustomRecommendation(
    recommendation: (typeof customRecommendations)[number],
  ) {
    setCustomDraft(getCustomReminderDraftFromRecommendation(recommendation));
    setCustomDraftErrors({});
    setPendingDeleteCustomReminderId(null);
    setStatus("idle");
    setCustomReminderWizardStep("recurrence");
    setIsCustomReminderWizardOpen(true);
  }

  function resetCustomDraft() {
    setCustomDraft({ ...defaultCustomReminderDraft });
    setCustomRecommendations(getRecommendedCustomReminders());
    setCustomDraftErrors({});
  }

  function openNewCustomReminderWizard() {
    resetCustomDraft();
    setPendingDeleteCustomReminderId(null);
    setStatus("idle");
    setCustomReminderWizardStep("recurrence");
    setIsCustomReminderWizardOpen(true);
  }

  function closeCustomReminderWizard() {
    setIsCustomReminderWizardOpen(false);
    setCustomDraftErrors({});
  }

  function saveCustomReminder() {
    const validationResult = validateCustomReminderDraft(customDraft);

    if (!validationResult.success) {
      setCustomDraftErrors(validationResult.errors);
      setStatus("custom-error");
      setCustomReminderWizardStep(
        validationResult.errors.title ||
          validationResult.errors.category ||
          validationResult.errors.description
          ? "details"
          : "recurrence",
      );
      return;
    }

    setSettings((currentSettings) => {
      const existingReminder = currentSettings.customReminders.find(
        (reminder) => reminder.id === customDraft.id,
      );
      const reminder = createCustomReminderDefinition({
        draft: validationResult.draft,
        displayPriority:
          existingReminder?.displayPriority ??
          reminderList.length + currentSettings.customReminders.length + 1,
      });

      return upsertCustomReminderSettings({
        settings: currentSettings,
        reminder,
        enabled: customDraft.enabled,
      });
    });
    resetCustomDraft();
    setPendingDeleteCustomReminderId(null);
    setIsCustomReminderWizardOpen(false);
    setStatus("idle");
  }

  function editCustomReminder(reminderId: ReminderId) {
    const reminder = settings.customReminders.find(
      (candidate) => candidate.id === reminderId,
    );

    if (!reminder) {
      return;
    }

    setCustomDraft(
      getCustomReminderDraft(
        reminder,
        settings.preferredReminderCategories.includes(reminder.id),
      ),
    );
    setCustomDraftErrors({});
    setPendingDeleteCustomReminderId(null);
    setStatus("idle");
    setCustomReminderWizardStep("recurrence");
    setIsCustomReminderWizardOpen(true);
  }

  function deleteCustomReminder(reminderId: ReminderId) {
    setPendingDeleteCustomReminderId(reminderId);
    setStatus("idle");
  }

  function confirmDeleteCustomReminder(reminderId: ReminderId) {
    setSettings((currentSettings) =>
      deleteCustomReminderSettings(currentSettings, reminderId),
    );

    if (customDraft.id === reminderId) {
      resetCustomDraft();
    }

    setPendingDeleteCustomReminderId(null);
    setStatus("custom-removed");
  }

  function cancelDeleteCustomReminder() {
    setPendingDeleteCustomReminderId(null);
    setStatus("idle");
  }

  function saveCurrentSettings() {
    const didSave = service.saveSettings(settings);

    if (didSave) {
      onSettingsChange?.(settings);
    }

    setStatus(didSave ? "saved" : "error");
  }

  function resetSettings() {
    const defaultSettings = getDefaultAppSettings();
    const didSave = service.saveSettings(defaultSettings);

    setSettings(defaultSettings);

    if (didSave) {
      onSettingsChange?.(defaultSettings);
    }

    setStatus(didSave ? "reset" : "error");
  }

  function resetTodaysProgress() {
    const nextHistory = removeReminderHistoryEntriesForDate(
      historyService.loadReminderHistory(),
      currentDate,
    );
    const didSave = historyService.saveReminderHistory(nextHistory);

    setStatus(didSave ? "progress-reset" : "error");
  }

  const settingsNavItems: Array<{ id: SettingsPanelId; label: string }> = [
    { id: "general", label: "General" },
    { id: "quiet-hours", label: "Quiet hours" },
    { id: "categories", label: "Reminder categories" },
    { id: "advanced", label: "Advanced" },
  ];

  const customReminderForm = (
    <>
      <div className="settings-columns">
        <label className="field">
          <span>Custom reminder title</span>
          <input
            type="text"
            maxLength={CUSTOM_REMINDER_TITLE_MAX_LENGTH}
            value={customDraft.title}
            onChange={(event) =>
              updateCustomDraft("title", event.currentTarget.value)
            }
            aria-describedby={titleDescriptionIds || undefined}
            aria-invalid={Boolean(customDraftErrors.title)}
          />
          {titleLimitStatus ? (
            <small
              id="custom-reminder-title-limit"
              className={getCharacterLimitHintClassName(titleLimitStatus)}
            >
              {titleLimitStatus.message}
            </small>
          ) : null}
          {customDraftErrors.title ? (
            <small id="custom-reminder-title-error" className="field-error">
              {customDraftErrors.title}
            </small>
          ) : null}
        </label>
        <label className="field">
          <span>Custom reminder category</span>
          <input
            type="text"
            maxLength={CUSTOM_REMINDER_CATEGORY_MAX_LENGTH}
            value={customDraft.category}
            onChange={(event) =>
              updateCustomDraft("category", event.currentTarget.value)
            }
            aria-describedby={categoryDescriptionIds || undefined}
            aria-invalid={Boolean(customDraftErrors.category)}
          />
          {categoryLimitStatus ? (
            <small
              id="custom-reminder-category-limit"
              className={getCharacterLimitHintClassName(categoryLimitStatus)}
            >
              {categoryLimitStatus.message}
            </small>
          ) : null}
          {customDraftErrors.category ? (
            <small id="custom-reminder-category-error" className="field-error">
              {customDraftErrors.category}
            </small>
          ) : null}
        </label>
      </div>
      <label className="field">
        <span>Custom reminder message</span>
        <input
          type="text"
          maxLength={CUSTOM_REMINDER_MESSAGE_MAX_LENGTH}
          value={customDraft.description}
          onChange={(event) =>
            updateCustomDraft("description", event.currentTarget.value)
          }
          aria-describedby={messageDescriptionIds || undefined}
          aria-invalid={Boolean(customDraftErrors.description)}
        />
        {messageLimitStatus ? (
          <small
            id="custom-reminder-message-limit"
            className={getCharacterLimitHintClassName(messageLimitStatus)}
          >
            {messageLimitStatus.message}
          </small>
        ) : null}
        {customDraftErrors.description ? (
          <small id="custom-reminder-message-error" className="field-error">
            {customDraftErrors.description}
          </small>
        ) : null}
      </label>
    </>
  );

  const recurrenceControls = (
    <div className="wizard-recurrence-grid">
      <div className="wizard-recurrence-options">
        {customReminderScheduleOptions.map((option) => (
          <label key={option.value} className="wizard-recurrence-card">
            <input
              type="radio"
              aria-label={option.label}
              name="customReminderScheduleType"
              checked={customDraft.schedule.type === option.value}
              onChange={() => updateCustomScheduleType(option.value)}
            />
            <span>{option.label}</span>
            <small>
              {option.value === "interval"
                ? "Repeat every X minutes"
                : option.value === "dailyInterval"
                  ? "Repeat every X days"
                  : option.value === "weekdayInterval"
                    ? "Repeat on specific weekdays"
                    : "Set a single date and time"}
            </small>
          </label>
        ))}
      </div>
      <div className="wizard-recurrence-detail">
        {customDraft.schedule.type === "interval" ? (
          <label className="field">
            <span>Repeat every minutes</span>
            <input
              type="number"
              aria-label="Custom reminder interval minutes"
              min="5"
              max="1440"
              step="1"
              value={customDraft.schedule.intervalMinutes}
              onChange={(event) =>
                updateCustomIntervalMinutes(Number(event.currentTarget.value))
              }
              aria-describedby={`custom-reminder-interval-hint${
                customDraftErrors.intervalMinutes
                  ? " custom-reminder-interval-error"
                  : ""
              }`}
              aria-invalid={Boolean(customDraftErrors.intervalMinutes)}
            />
            <small id="custom-reminder-interval-hint" className="field-hint">
              Whole number, 5-1440 minutes.
            </small>
            {customDraftErrors.intervalMinutes ? (
              <small id="custom-reminder-interval-error" className="field-error">
                {customDraftErrors.intervalMinutes}
              </small>
            ) : null}
          </label>
        ) : null}
        {customDraft.schedule.type === "dailyInterval" ? (
          <div className="settings-columns">
            <label className="field">
              <span>Repeat every days</span>
              <input
                type="number"
                min="1"
                max="365"
                step="1"
                value={customDraft.schedule.dayIntervalDays}
                onChange={(event) =>
                  updateCustomDayInterval(Number(event.currentTarget.value))
                }
                aria-invalid={Boolean(customDraftErrors.dayIntervalDays)}
              />
              {customDraftErrors.dayIntervalDays ? (
                <small className="field-error">
                  {customDraftErrors.dayIntervalDays}
                </small>
              ) : null}
            </label>
            <label className="field">
              <span>Time of day</span>
              <input
                type="time"
                aria-label="Reminder time"
                value={customDraft.schedule.timeOfDay}
                onChange={(event) =>
                  updateCustomDailyTime(event.currentTarget.value)
                }
                aria-invalid={Boolean(customDraftErrors.timeOfDay)}
              />
            </label>
          </div>
        ) : null}
        {customDraft.schedule.type === "weekdayInterval" ? (
          <>
            <fieldset className="settings-subgroup">
              <legend>Repeat on</legend>
              <div className="weekday-pill-grid">
                {weekdayOrder.map((weekday) => (
                  <label key={weekday} className="weekday-pill">
                    <input
                      type="checkbox"
                      checked={isCustomWeekdaySelected(weekday)}
                      onChange={() => toggleCustomWeekday(weekday)}
                    />
                    <span>{weekdayLabels[weekday].slice(0, 3)}</span>
                  </label>
                ))}
              </div>
              {customDraftErrors.weekdays ? (
                <small className="field-error">{customDraftErrors.weekdays}</small>
              ) : null}
            </fieldset>
            <label className="field wizard-time-field">
              <span>Time of day</span>
              <input
                type="time"
                aria-label="Reminder time"
                value={customDraft.schedule.timeOfDay}
                onChange={(event) =>
                  updateCustomWeekdayTime(event.currentTarget.value)
                }
                aria-invalid={Boolean(customDraftErrors.timeOfDay)}
              />
            </label>
          </>
        ) : null}
        {customDraft.schedule.type === "oneTime" ? (
          <div className="settings-columns">
            <label className="field">
              <span>Reminder date</span>
              <input
                type="date"
                min={formatDateInputValue(new Date())}
                value={customDraft.schedule.date}
                onChange={(event) =>
                  updateCustomOneTimeDate(event.currentTarget.value)
                }
                aria-invalid={Boolean(customDraftErrors.date)}
              />
              {customDraftErrors.date ? (
                <small className="field-error">{customDraftErrors.date}</small>
              ) : null}
            </label>
            <label className="field">
              <span>Time of day</span>
              <input
                type="time"
                aria-label="Reminder time"
                value={customDraft.schedule.timeOfDay}
                onChange={(event) =>
                  updateCustomOneTimeTime(event.currentTarget.value)
                }
                aria-invalid={Boolean(customDraftErrors.timeOfDay)}
              />
            </label>
          </div>
        ) : null}
        <label className="settings-switch-row wizard-window-row">
          <span>
            <strong>Respect quiet hours and workday</strong>
            <small>Delay reminders to allowed times.</small>
          </span>
          <input
            type="checkbox"
            aria-label="Respect quiet hours and workday"
            checked={customDraft.respectReminderWindows}
            onChange={(event) =>
              updateCustomDraft(
                "respectReminderWindows",
                event.currentTarget.checked,
              )
            }
          />
        </label>
        {customDraftErrors.timeOfDay ? (
          <small className="field-error">{customDraftErrors.timeOfDay}</small>
        ) : null}
      </div>
    </div>
  );

  const customRemindersSection = (
    <section
      className="settings-custom-screen settings-reminders-subsection"
      aria-labelledby="custom-reminders-heading"
    >
      <div className="settings-section-heading">
        <h2 id="custom-reminders-heading">Custom reminders</h2>
        <button type="button" className="icon-button" aria-label="Saved">
          ✓
        </button>
      </div>
      <div className="custom-recommendation-header">
        <h3>Recommended for you</h3>
        <button
          type="button"
          onClick={() => setCustomRecommendations(getRecommendedCustomReminders())}
        >
          Refresh
        </button>
      </div>
      <div
        className="custom-recommendation-grid"
        aria-label="Recommended custom reminders"
      >
        {customRecommendations.map((recommendation) => (
          <button
            key={recommendation.id}
            type="button"
            className="custom-recommendation"
            onClick={() => applyCustomRecommendation(recommendation)}
          >
            <span className="recommendation-icon">◇</span>
            <strong>{recommendation.title}</strong>
            <small>{recommendation.description}</small>
            <span>{formatCustomReminderSchedule(recommendation.schedule)}</span>
            <em>Use</em>
          </button>
        ))}
      </div>
      <div className="settings-actions custom-reminder-actions">
        <button
          type="button"
          aria-label="Add custom reminder"
          onClick={openNewCustomReminderWizard}
        >
          + Add custom reminder
        </button>
      </div>
      <fieldset className="settings-subgroup custom-reminder-management">
        <legend>Manage Custom Reminders</legend>
        {settings.customReminders.length > 0 ? (
          <ul className="custom-reminder-list" aria-label="Custom reminders">
            {settings.customReminders.map((reminder) => (
              <li key={reminder.id} aria-label={reminder.title}>
                {pendingDeleteCustomReminderId === reminder.id ? (
                  <>
                    <div>
                      <strong>Delete {reminder.title}?</strong>
                      <span>Save settings to apply.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => confirmDeleteCustomReminder(reminder.id)}
                    >
                      Confirm delete
                    </button>
                    <button type="button" onClick={cancelDeleteCustomReminder}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>{reminder.title}</strong>
                      <span>
                        {formatCustomReminderSchedule(reminder.schedule)}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Edit ${reminder.title}`}
                      onClick={() => editCustomReminder(reminder.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${reminder.title}`}
                      onClick={() => deleteCustomReminder(reminder.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No custom reminders yet.</p>
        )}
      </fieldset>
    </section>
  );

  return (
    <section className="web-settings-shell" aria-labelledby="settings-heading">
      <aside className="web-app-sidebar" aria-label="App navigation">
        <div className="web-sidebar-brand">VitaLoop</div>
        {["Dashboard", "Reminders", "Backlog", "Insights", "Settings"].map(
          (item) => (
            <button
              key={item}
              type="button"
              className={item === "Settings" ? "is-active" : ""}
            >
              <SettingsIcon label={item} />
              {item}
            </button>
          ),
        )}
        <div className="web-sidebar-spacer" />
        <button type="button">Help</button>
      </aside>
      <div className="web-settings-content">
        <h1 id="settings-heading">Settings</h1>
        <form
          className="settings-workspace"
          onSubmit={(event) => {
            event.preventDefault();
            saveCurrentSettings();
          }}
        >
          <nav className="settings-side-nav" aria-label="Settings sections">
            {settingsNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeSettingsPanel === item.id ? "is-active" : ""}
                onClick={() => setActiveSettingsPanel(item.id)}
              >
                <SettingsIcon label={item.label} />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="settings-primary-column">
            {activeSettingsPanel === "general" ? (
              <section className="settings-card">
                <h2>General</h2>
                <label className="settings-switch-row">
                  <span>
                    <strong>Proactive reminders</strong>
                    <small>Enable local proactive reminders.</small>
                  </span>
                  <input
                        type="checkbox"
                        aria-label="Enable proactive reminders"
                        checked
                        readOnly
                      />
                </label>
                <fieldset className="settings-inline-fieldset">
                  <legend>Reminder intensity</legend>
                  {reminderIntensityOptions.map((option) => (
                    <label key={option.value} className="settings-radio-row">
                      <input
                          type="radio"
                          aria-label={option.label}
                          name="reminderIntensity"
                          value={option.value}
                          checked={settings.reminderIntensity === option.value}
                        onChange={() =>
                          updateSetting("reminderIntensity", option.value)
                        }
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <small>
                          {option.value === "balanced"
                            ? "Recommended"
                            : option.value === "gentle"
                              ? "Fewer reminders"
                              : "More frequent reminders"}
                        </small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <label className="settings-switch-row">
                  <span>
                    <strong>Daily summary</strong>
                    <small>Show a summary of your day.</small>
                  </span>
                  <input type="checkbox" checked readOnly />
                </label>
                <label className="settings-switch-row">
                  <span>
                    <strong>Start with system</strong>
                    <small>Launch VitaLoop when you start your browser.</small>
                  </span>
                  <input type="checkbox" disabled />
                </label>
                <details className="settings-schedule-subsection">
                  <summary>
                    <span>👨🏻‍💻 Working Hours</span>
                    <small>Set the workday window for reminders.</small>
                  </summary>
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
                </details>
              </section>
            ) : null}

            {activeSettingsPanel !== "general" ? (
              <section className="settings-card">
                <h2>
                  {
                    settingsNavItems.find((item) => item.id === activeSettingsPanel)
                      ?.label
                  }
                </h2>
                {activeSettingsPanel === "quiet-hours" ? (
                  <>
                    <label className="settings-switch-row">
                      <span>
                        <strong>Quiet hours enabled</strong>
                        <small>Pause reminders during quiet hours.</small>
                      </span>
                      <input
                        type="checkbox"
                        aria-label="Quiet hours enabled"
                        checked={settings.quietHoursEnabled}
                        onChange={(event) =>
                          updateSetting(
                            "quietHoursEnabled",
                            event.currentTarget.checked,
                          )
                        }
                      />
                    </label>
                    <div className="settings-columns">
                      <label className="field">
                        <span>Quiet hours start</span>
                        <input
                          type="time"
                          value={settings.quietHoursStart}
                          onChange={(event) =>
                            updateSetting(
                              "quietHoursStart",
                              event.currentTarget.value,
                            )
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
                  </>
                ) : null}
                {activeSettingsPanel === "categories" ? (
                  <>
                    <div className="category-grid">
                      {reminderCategories.map((reminder) => {
                        const isPreferred =
                          settings.preferredReminderCategories.includes(
                            reminder.id,
                          );
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
                    {customRemindersSection}
                  </>
                ) : null}
                {activeSettingsPanel === "advanced" ? (
                  <p>Settings stay local to this browser.</p>
                ) : null}
              </section>
            ) : null}
            <div className="settings-actions settings-footer-actions">
              <button type="button" onClick={resetSettings}>
                Reset to defaults
              </button>
              <button type="submit">Save changes</button>
            </div>
            {status === "saved" && (
              <p className="settings-status" role="status" aria-live="polite">
                Settings saved.
              </p>
            )}
            {status === "reset" && (
              <p className="settings-status" role="status" aria-live="polite">
                Defaults restored.
              </p>
            )}
            {status === "progress-reset" && (
              <p className="settings-status" role="status" aria-live="polite">
                Today's progress reset.
              </p>
            )}
            {status === "error" && (
              <p className="settings-error" role="alert">
                Settings could not be saved. Check the values and try again.
              </p>
            )}
            {status === "custom-error" && (
              <p className="settings-error" role="alert">
                Check the highlighted custom reminder fields and try again.
              </p>
            )}
            {status === "custom-removed" && (
              <p className="settings-status" role="status" aria-live="polite">
                Custom reminder removed. Save settings to apply.
              </p>
            )}
          </div>
          <aside className="settings-support-column" aria-label="Settings status">
            <section className="settings-card">
              <h2>Local services</h2>
              <dl className="status-list">
                <div>
                  <dt>Alarms</dt>
                  <dd>Active</dd>
                </div>
                <div>
                  <dt>Notifications</dt>
                  <dd>Enabled</dd>
                </div>
                <div>
                  <dt>Storage</dt>
                  <dd>Local only</dd>
                </div>
              </dl>
            </section>
            <section className="settings-card">
              <h2>Actions</h2>
              <button type="button" className="secondary-action">
                Send test notification
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={resetTodaysProgress}
              >
                Reset today's progress
              </button>
            </section>
          </aside>
        </form>
      </div>

      {isCustomReminderWizardOpen ? (
        <div className="custom-wizard-backdrop" role="presentation">
          <section
            className="custom-wizard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-wizard-heading"
          >
            <header className="custom-wizard-header">
              <h2 id="custom-wizard-heading">New custom reminder</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Close custom reminder wizard"
                onClick={closeCustomReminderWizard}
              >
                ×
              </button>
            </header>
            <div className="custom-wizard-body">
              <nav className="custom-wizard-steps" aria-label="Custom reminder steps">
                {(["details", "recurrence", "review"] as const).map((step, index) => (
                  <button
                    key={step}
                    type="button"
                    aria-label={
                      step === "details"
                        ? "Details"
                        : step === "recurrence"
                          ? "Recurrence"
                          : "Review"
                    }
                    className={customReminderWizardStep === step ? "is-active" : ""}
                    onClick={() => setCustomReminderWizardStep(step)}
                  >
                    <span aria-hidden="true">{index + 1}</span>
                    {step === "details"
                      ? "Details"
                      : step === "recurrence"
                        ? "Recurrence"
                        : "Review"}
                  </button>
                ))}
              </nav>
              <div className="custom-wizard-panel">
                {customReminderWizardStep === "details" ? (
                  <>
                    <h3>Details</h3>
                    {customReminderForm}
                  </>
                ) : null}
                {customReminderWizardStep === "recurrence" ? (
                  <>
                    <h3>Recurrence</h3>
                    <p>Choose how often this reminder repeats.</p>
                    {recurrenceControls}
                  </>
                ) : null}
                {customReminderWizardStep === "review" ? (
                  <>
                    <h3>Review</h3>
                    <dl className="status-list">
                      <div>
                        <dt>Title</dt>
                        <dd>{customDraft.title || "Untitled reminder"}</dd>
                      </div>
                      <div>
                        <dt>Schedule</dt>
                        <dd>{formatCustomReminderSchedule(customDraft.schedule)}</dd>
                      </div>
                    </dl>
                    <label className="settings-switch-row">
                      <span>
                        <strong>Enable custom reminder</strong>
                        <small>Show this reminder in your active rhythm.</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={customDraft.enabled}
                        onChange={(event) =>
                          updateCustomDraft("enabled", event.currentTarget.checked)
                        }
                      />
                    </label>
                  </>
                ) : null}
              </div>
            </div>
            <footer className="custom-wizard-footer">
              <button
                type="button"
                onClick={() =>
                  setCustomReminderWizardStep(
                    customReminderWizardStep === "review" ? "recurrence" : "details",
                  )
                }
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (customReminderWizardStep === "review") {
                    saveCustomReminder();
                    return;
                  }

                  setCustomReminderWizardStep(
                    customReminderWizardStep === "details" ? "recurrence" : "review",
                  );
                }}
              >
                {customReminderWizardStep === "review" ? "Save custom reminder" : "Next"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function BacklogScreen() {
  return (
    <section className="screen-panel">
      <h1 id="backlog-heading">Backlog</h1>
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
      <h1 id="watch-preview-heading">Watch Preview</h1>
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
      <h1 id="about-heading">About</h1>
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
