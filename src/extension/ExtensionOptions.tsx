import { useEffect, useState } from "react";
import { reminders as defaultReminders } from "../data/reminders";
import { type ReminderDefinition } from "../domain/schemas";
import {
  extensionSettingsStorage,
  getDefaultExtensionSettings,
  type ExtensionSettings,
  type ExtensionSettingsStorage,
} from "./extensionSettingsStorage";

const reminderIntensityOptions = [
  { value: "gentle", label: "Gentle" },
  { value: "balanced", label: "Balanced" },
  { value: "active", label: "Active" },
] as const;

type ReminderId = ExtensionSettings["preferredReminderCategories"][number];
type OptionsStatus = "idle" | "saved" | "reset" | "error" | "category-required";

type ExtensionOptionsProps = {
  storage?: ExtensionSettingsStorage;
  reminderList?: ReminderDefinition[];
};

export function ExtensionOptions({
  storage = extensionSettingsStorage,
  reminderList = defaultReminders,
}: ExtensionOptionsProps) {
  const [settings, setSettings] = useState<ExtensionSettings>(() =>
    getDefaultExtensionSettings(),
  );
  const [status, setStatus] = useState<OptionsStatus>("idle");

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

  function updateSetting<Key extends keyof ExtensionSettings>(
    key: Key,
    value: ExtensionSettings[Key],
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
        setStatus("category-required");
        return currentSettings;
      }

      setStatus("idle");

      return {
        ...currentSettings,
        preferredReminderCategories: nextCategories,
      };
    });
  }

  async function saveCurrentSettings() {
    const didSave = await storage.saveSettings(settings);

    setStatus(didSave ? "saved" : "error");
  }

  async function resetSettings() {
    const defaultSettings = getDefaultExtensionSettings();
    const didSave = await storage.saveSettings(defaultSettings);

    setSettings(defaultSettings);
    setStatus(didSave ? "reset" : "error");
  }

  return (
    <main
      className="extension-shell extension-options"
      aria-labelledby="options-title"
    >
      <header className="extension-titlebar extension-options-titlebar">
        <div className="extension-window-controls" aria-hidden="true">
          <span className="extension-window-dot extension-window-dot-close" />
          <span className="extension-window-dot extension-window-dot-minimize" />
          <span className="extension-window-dot extension-window-dot-zoom" />
        </div>
        <div className="extension-titlebar-title">
          <p>VitaLoop</p>
          <h1 id="options-title">VitaLoop Settings</h1>
        </div>
        <span className="extension-titlebar-spacer" aria-hidden="true" />
      </header>

      <form
        className="extension-form"
        onSubmit={(event) => {
          event.preventDefault();
          void saveCurrentSettings();
        }}
      >
        <fieldset className="extension-group">
          <legend>Proactive reminders</legend>
          <div className="extension-setting-row extension-setting-row-split">
            <label className="extension-check-row">
              <input
                type="checkbox"
                checked={settings.proactiveRemindersEnabled}
                onChange={(event) =>
                  updateSetting(
                    "proactiveRemindersEnabled",
                    event.currentTarget.checked,
                  )
                }
              />
              <span>Enable proactive reminders</span>
            </label>
            <span
              className="extension-status-pill"
              data-state={
                settings.proactiveRemindersEnabled ? "enabled" : "disabled"
              }
            >
              {settings.proactiveRemindersEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <p className="extension-help-text">
            VitaLoop uses Chrome alarms and local browser notifications for
            proactive reminders. Notification permission is needed for this
            local extension feature.
          </p>
          <p className="extension-status">
            Proactive reminders are{" "}
            {settings.proactiveRemindersEnabled ? "enabled" : "disabled"}.
          </p>
        </fieldset>

        <fieldset className="extension-group">
          <legend>Quiet Hours</legend>
          <label className="extension-setting-row extension-check-row">
            <input
              type="checkbox"
              checked={settings.quietHoursEnabled}
              onChange={(event) =>
                updateSetting("quietHoursEnabled", event.currentTarget.checked)
              }
            />
            <span>Quiet hours enabled</span>
          </label>
          <div className="extension-field-grid">
            <label className="extension-setting-row extension-field">
              <span>Quiet hours start</span>
              <input
                type="time"
                value={settings.quietHoursStart}
                onChange={(event) =>
                  updateSetting("quietHoursStart", event.currentTarget.value)
                }
              />
            </label>
            <label className="extension-setting-row extension-field">
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

        <fieldset className="extension-group">
          <legend>Workday</legend>
          <div className="extension-field-grid">
            <label className="extension-setting-row extension-field">
              <span>Workday start</span>
              <input
                type="time"
                value={settings.workdayStart}
                onChange={(event) =>
                  updateSetting("workdayStart", event.currentTarget.value)
                }
              />
            </label>
            <label className="extension-setting-row extension-field">
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

        <fieldset className="extension-group">
          <legend>Intensity</legend>
          <div className="extension-choice-grid">
            {reminderIntensityOptions.map((option) => (
              <label key={option.value} className="extension-radio-card">
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

        <fieldset className="extension-group">
          <legend>Categories</legend>
          <div className="extension-category-grid">
            {reminderList.map((reminder) => {
              const isPreferred =
                settings.preferredReminderCategories.includes(reminder.id);
              const isOnlyPreferred =
                isPreferred &&
                settings.preferredReminderCategories.length === 1;

              return (
                <label
                  key={reminder.id}
                  className="extension-setting-row extension-check-row"
                >
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

        <div className="extension-save-row">
          <button type="submit">Save</button>
          <button type="button" onClick={() => void resetSettings()}>
            Reset to defaults
          </button>
        </div>

        {status === "saved" && (
          <p className="extension-live-status" role="status" aria-live="polite">
            Settings saved.
          </p>
        )}
        {status === "reset" && (
          <p className="extension-live-status" role="status" aria-live="polite">
            Defaults restored.
          </p>
        )}
        {status === "category-required" && (
          <p className="extension-live-status" role="status" aria-live="polite">
            Keep at least one category active.
          </p>
        )}
        {status === "error" && (
          <p className="extension-error" role="alert">
            Settings could not be saved.
          </p>
        )}

        <p className="extension-options-footnote">
          Settings stay local to this browser.
        </p>
      </form>
    </main>
  );
}
