import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App, { HomeScreen, RemindersScreen, SettingsScreen } from "../src/App";
import { reminders } from "../src/data/reminders";
import { type ReminderHistoryEntry } from "../src/domain/reminderHistory";
import { type AppSettings } from "../src/domain/schemas";
import { getDefaultAppSettings } from "../src/domain/settings";
import { type ReminderHistoryService } from "../src/services/reminderHistoryService";
import { type SettingsService } from "../src/services/settingsService";

afterEach(cleanup);

function createTestSettingsService(
  initialSettings: AppSettings = getDefaultAppSettings(),
  saveResult = true,
): SettingsService & {
  saveSettings: ReturnType<typeof vi.fn<(settings: AppSettings) => boolean>>;
} {
  let currentSettings = initialSettings;
  const saveSettings = vi.fn((settings: AppSettings) => {
    if (saveResult) {
      currentSettings = settings;
    }

    return saveResult;
  });

  return {
    loadSettings: () => currentSettings,
    saveSettings,
  };
}

function createTestHistoryService(
  initialHistory: ReminderHistoryEntry[] = [],
): ReminderHistoryService & {
  saveReminderHistory: ReturnType<
    typeof vi.fn<(history: ReminderHistoryEntry[]) => boolean>
  >;
} {
  let currentHistory = initialHistory;
  const saveReminderHistory = vi.fn((history: ReminderHistoryEntry[]) => {
    currentHistory = history;
    return true;
  });

  return {
    loadReminderHistory: () => currentHistory,
    saveReminderHistory,
  };
}

function expandCustomReminders() {
  fireEvent.click(screen.getByRole("button", { name: "Reminder categories" }));
  const customRemindersSummary = screen.getByText("Custom reminders");
  const customRemindersDetails = customRemindersSummary.closest("details");

  if (customRemindersDetails && !customRemindersDetails.hasAttribute("open")) {
    fireEvent.click(customRemindersSummary);
  }
}

function openCustomReminderWizard() {
  expandCustomReminders();
  fireEvent.click(screen.getByRole("button", { name: "Add custom reminder" }));
}

function saveCustomReminderFromWizard() {
  fireEvent.click(screen.getByRole("button", { name: "Add Reminder" }));
}

describe("VitaLoop app shell", () => {
  it("renders VitaLoop branding", () => {
    render(<App />);

    expect(screen.getAllByText("VitaLoop").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Recurring wellness reminders for busy days."),
    ).toBeTruthy();
  });

  it("has a main content region and skip link", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveProperty(
      "hash",
      "#main-content",
    );
    expect(screen.getByRole("main", { name: "Today overview" })).toBeTruthy();
  });

  it("renders primary navigation labels", () => {
    render(<App />);

    const navigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });

    for (const label of [
      "Home",
      "Reminders",
      "Settings",
      "Backlog",
      "Watch Preview",
      "About",
    ]) {
      expect(within(navigation).getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("marks the active navigation item programmatically", () => {
    render(<App />);

    const remindersButton = screen.getByRole("button", { name: "Reminders" });

    fireEvent.click(remindersButton);

    expect(remindersButton.getAttribute("aria-current")).toBe("page");
    expect(
      screen.getByRole("heading", { level: 1, name: "Reminders" }),
    ).toBeTruthy();
    expect(screen.getByRole("main", { name: "Reminders" })).toBeTruthy();
  });

  it("renders reminder cards for all expected categories", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Reminders" }));

    const reminderCategories = screen.getByLabelText("Reminder categories");

    for (const reminder of reminders) {
      expect(
        within(reminderCategories).getByRole("heading", {
          name: reminder.title,
        }),
      ).toBeTruthy();
    }
  });

  it("shows the next wellness nudge on the home screen", () => {
    render(<HomeScreen reminders={reminders} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Today overview" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Next wellness nudge")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Eye strain" })).toBeTruthy();
    expect(
      screen.getByText("Calculated next reminder: 10:45 AM"),
    ).toBeTruthy();
  });

  it("shows calculated next reminder timing on the reminders screen", () => {
    render(<RemindersScreen reminders={reminders} />);

    const reminderCategories = screen.getByLabelText("Reminder categories");

    expect(
      within(reminderCategories).getByText("Next reminder preview: 10:45 AM"),
    ).toBeTruthy();
  });

  it("renders reminder action buttons", () => {
    render(<HomeScreen reminders={reminders} />);

    const actions = screen.getByLabelText("Reminder actions");

    expect(within(actions).getByRole("button", { name: "Done" })).toBeTruthy();
    expect(
      within(actions).getByRole("button", { name: "Snooze" }),
    ).toBeTruthy();
    expect(
      within(actions).getByRole("button", { name: "Skip once" }),
    ).toBeTruthy();
  });

  it("updates visible status after Done", () => {
    const historyService = createTestHistoryService();

    render(<HomeScreen reminders={reminders} historyService={historyService} />);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("status").textContent).toContain("marked done");
    expect(screen.getByRole("heading", { name: "Stand/walk" })).toBeTruthy();
    const headsUp = screen.getByLabelText("Head's up");

    expect(headsUp).toBeTruthy();
    expect(within(headsUp).getByText("Stand/walk")).toBeTruthy();
    expect(within(headsUp).getByText("1 hr · 11:00 AM")).toBeTruthy();
    expect(historyService.saveReminderHistory).toHaveBeenCalledWith([
      expect.objectContaining({
        reminderId: "eye-strain",
        reminderTitle: "Eye strain",
        actionType: "done",
      }),
    ]);
  });

  it("updates visible status after Snooze", () => {
    const historyService = createTestHistoryService();

    render(<HomeScreen reminders={reminders} historyService={historyService} />);

    fireEvent.click(screen.getByRole("button", { name: "Snooze" }));

    expect(screen.getByRole("status").textContent).toContain(
      "snoozed until 11:00 AM",
    );
    const headsUp = screen.getByLabelText("Head's up");

    expect(within(headsUp).getByText("Eye strain")).toBeTruthy();
    expect(within(headsUp).getAllByText("1 hr · 11:00 AM").length).toBeGreaterThan(
      0,
    );
    expect(within(headsUp).getByText("Snoozed")).toBeTruthy();
  });

  it("renders upcoming reminders in the heads up panel", () => {
    render(<HomeScreen reminders={reminders} />);

    const headsUp = screen.getByLabelText("Head's up");

    expect(within(headsUp).getByRole("heading", { name: "Head's up" })).toBeTruthy();
    expect(within(headsUp).getByText("Eye strain")).toBeTruthy();
    expect(within(headsUp).getByText("45 min · 10:45 AM")).toBeTruthy();
  });

  it("renders an empty heads up state", () => {
    render(
      <HomeScreen
        reminders={reminders}
        settings={{
          ...getDefaultAppSettings(),
          preferredReminderCategories: [],
        }}
      />,
    );

    expect(screen.getByLabelText("Head's up")).toBeTruthy();
    expect(screen.getByText("No upcoming reminders right now.")).toBeTruthy();
  });

  it("updates visible status after Skip once", () => {
    render(<HomeScreen reminders={reminders} />);

    fireEvent.click(screen.getByRole("button", { name: "Skip once" }));

    expect(screen.getByRole("status").textContent).toContain("skipped once");
    expect(screen.getByRole("heading", { name: "Stand/walk" })).toBeTruthy();
  });

  it("shows selected reminder details", () => {
    render(<RemindersScreen reminders={reminders} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Eye strain/i }),
    );

    const details = screen.getByRole("region", {
      name: "Selected reminder details",
    });

    expect(
      within(details).getByRole("heading", { name: "Eye strain" }),
    ).toBeTruthy();
    expect(within(details).getByText("Screen breaks")).toBeTruthy();
    expect(
      within(details).getByText(
        "Next reminder preview: Eye strain at 10:45 AM.",
      ),
    ).toBeTruthy();
  });

  it("renders an empty reminders state", () => {
    render(<RemindersScreen reminders={[]} />);

    expect(screen.getByText("No reminders to show")).toBeTruthy();
  });

  it("renders a reminders error state", () => {
    render(<RemindersScreen reminders={reminders} hasError />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Reminders are unavailable")).toBeTruthy();
  });

  it("renders settings controls", () => {
    render(
      <SettingsScreen
        service={createTestSettingsService()}
        reminderList={reminders}
      />,
    );

    expect(screen.getByRole("heading", { name: "General" })).toBeTruthy();
    expect(screen.queryByLabelText("Enable proactive reminders")).toBeNull();
    expect(screen.queryByRole("radio", { name: "Balanced" })).toBeNull();
    expect(screen.queryByRole("button", { name: "About" })).toBeNull();
    expect(screen.queryByText("👨🏻‍💻 Working Hours")).toBeNull();
    expect(screen.queryByRole("button", { name: "Schedule" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Notifications" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Appearance" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Data & privacy" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Quiet hours" }));
    expect(screen.getByLabelText("Quiet hours enabled")).toBeTruthy();
    expect(screen.getByLabelText("Quiet hours start")).toBeTruthy();
    expect(screen.getByLabelText("Quiet hours end")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reminder categories" }));
    const hydrationControl = screen.getByLabelText("Hydration");
    expect(hydrationControl).toBeTruthy();
    expect(screen.queryByLabelText("Sleep routine")).toBeNull();
    expect(screen.queryByLabelText("Mood/energy check-in")).toBeNull();
    expect(screen.queryByLabelText("Saved")).toBeNull();
    expect(screen.getByLabelText("Enable proactive reminders")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Balanced" })).toBeTruthy();
    const customRemindersSummary = screen.getByText("Custom reminders");
    const customRemindersDetails = customRemindersSummary.closest("details");
    expect(
      customRemindersDetails?.hasAttribute("open"),
    ).toBe(false);
    const hydrationRow = hydrationControl.closest("label");
    const proactiveReminderControl = screen
      .getByLabelText("Enable proactive reminders")
      .closest("label");
    const reminderIntensityControl = screen
      .getByText("Reminder intensity")
      .closest("fieldset");
    expect(
      hydrationRow && proactiveReminderControl
        ? hydrationRow.compareDocumentPosition(proactiveReminderControl) &
            Node.DOCUMENT_POSITION_FOLLOWING
        : 0,
    ).toBeTruthy();
    expect(
      proactiveReminderControl && reminderIntensityControl
        ? proactiveReminderControl.compareDocumentPosition(
            reminderIntensityControl,
          ) & Node.DOCUMENT_POSITION_FOLLOWING
        : 0,
    ).toBeTruthy();
    expect(
      reminderIntensityControl && customRemindersDetails
        ? reminderIntensityControl.compareDocumentPosition(
            customRemindersDetails,
          ) & Node.DOCUMENT_POSITION_FOLLOWING
        : 0,
    ).toBeTruthy();
    const workingHoursSummary = screen.getByText("👨🏻‍💻 Working Hours");
    const workingHoursDetails = workingHoursSummary.closest("details");
    expect(
      customRemindersDetails && workingHoursDetails
        ? customRemindersDetails.compareDocumentPosition(workingHoursDetails) &
            Node.DOCUMENT_POSITION_FOLLOWING
        : 0,
    ).toBeTruthy();
    expect(workingHoursDetails?.hasAttribute("open")).toBe(false);
    fireEvent.click(workingHoursSummary);
    expect(workingHoursDetails?.hasAttribute("open")).toBe(true);
    expect(screen.getByLabelText("Workday start")).toBeTruthy();
    expect(screen.getByLabelText("Workday end")).toBeTruthy();
    fireEvent.click(customRemindersSummary);
    expect(customRemindersDetails?.hasAttribute("open")).toBe(true);
    expect(screen.getByRole("heading", { name: "Recommended for you" })).toBeTruthy();
  });

  it("prefills a custom reminder from a recommendation", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    render(
      <SettingsScreen
        service={createTestSettingsService()}
        reminderList={reminders}
      />,
    );

    expandCustomReminders();
    fireEvent.click(screen.getByRole("button", { name: /Review calendar/ }));

    expect(screen.getByLabelText(/Title/)).toHaveProperty(
      "value",
      "Review calendar",
    );
    expect(screen.getByLabelText(/Message/)).toHaveProperty(
      "value",
      "Look over upcoming meetings and plans.",
    );

    randomSpy.mockRestore();
  });

  it("shows custom reminder character limits only near the maximum", () => {
    const service = createTestSettingsService();

    render(<SettingsScreen service={service} reminderList={reminders} />);

    expect(screen.queryByLabelText(/Title/)).toBeNull();
    openCustomReminderWizard();
    expect(screen.queryByText("0/48")).toBeNull();
    expect(
      screen.queryByText("Maximum limit of characters is 32/48"),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "A".repeat(33) },
    });
    const warningLimit = screen.getByText(
      "Maximum limit of characters is 33/48",
    );

    expect(warningLimit.className).not.toContain(
      "character-limit-hint-danger",
    );

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "A".repeat(38) },
    });
    const nearLimit = screen.getByText("Maximum limit of characters is 38/48");

    expect(nearLimit.className).toContain("character-limit-hint-danger");

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "A".repeat(32) },
    });
    expect(
      screen.queryByText("Maximum limit of characters is 32/48"),
    ).toBeNull();
  });

  it("saves updated settings", () => {
    const service = createTestSettingsService();

    render(<SettingsScreen service={service} reminderList={reminders} />);

    fireEvent.click(screen.getByRole("button", { name: "Reminder categories" }));
    fireEvent.click(screen.getByRole("radio", { name: "Active" }));
    fireEvent.click(screen.getByText("👨🏻‍💻 Working Hours"));
    fireEvent.change(screen.getByLabelText("Workday start"), {
      target: { value: "09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(service.saveSettings).toHaveBeenCalledTimes(1);
    expect(service.saveSettings.mock.calls[0][0]).toMatchObject({
      reminderIntensity: "active",
      workdayStart: "09:00",
    });
    expect(screen.getByRole("status").textContent).toContain("Settings saved.");
  });

  it("shows field-specific custom reminder validation errors", () => {
    const service = createTestSettingsService();

    render(<SettingsScreen service={service} reminderList={reminders} />);

    openCustomReminderWizard();
    saveCustomReminderFromWizard();

    expect(screen.getByText("Enter a title.")).toBeTruthy();
    expect(screen.getByText("Enter a message.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "Desk reset" },
    });
    fireEvent.change(screen.getByLabelText(/Message/), {
      target: { value: "Reset your desk and posture." },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Micro Loops" }));
    expect(screen.queryByText("Whole number, 5-1440 minutes.")).toBeNull();
    const intervalAmount = screen.getByLabelText(
      "Custom reminder interval amount",
    ) as HTMLInputElement;
    expect(fireEvent.keyDown(intervalAmount, { key: "." })).toBe(false);
    fireEvent.change(intervalAmount, {
      target: { value: "4.5" },
    });
    expect(intervalAmount.value).toBe("45");
    fireEvent.change(intervalAmount, {
      target: { value: "4" },
    });
    saveCustomReminderFromWizard();

    expect(screen.getByText("Use a whole number from 5 to 1440.")).toBeTruthy();
    expect(screen.queryByLabelText("Desk reset")).toBeNull();
    expect(service.saveSettings).not.toHaveBeenCalled();
  });

  it("creates, edits, and deletes a custom reminder in settings", () => {
    const service = createTestSettingsService();

    render(<SettingsScreen service={service} reminderList={reminders} />);

    expandCustomReminders();
    expect(
      screen.queryByRole("region", { name: "New custom reminder" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add custom reminder" }));
    expect(
      screen.getByRole("button", { name: "Cancel" }).getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      screen.getByRole("group", { name: "Manage Custom Reminders" }),
    ).toBeTruthy();
    const wizard = screen.getByRole("region", {
      name: "New custom reminder",
    });
    expect(within(wizard).getByRole("heading", { name: "Details" })).toBeTruthy();
    expect(within(wizard).getByRole("button", { name: "Add Reminder" })).toBeTruthy();
    expect(within(wizard).queryByRole("button", { name: "Back" })).toBeNull();
    expect(within(wizard).queryByRole("button", { name: "Next" })).toBeNull();
    expect(within(wizard).queryByRole("button", { name: "Review" })).toBeNull();
    expect(within(wizard).queryByRole("heading", { name: "Review" })).toBeNull();
    expect(
      within(wizard).getByRole("heading", { name: "Remind me on:" }),
    ).toBeTruthy();
    expect(within(wizard).getByLabelText("Date")).toBeTruthy();
    expect(within(wizard).getByLabelText("Time")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Frequency" })).toBeNull();
    expect(within(wizard).getByRole("heading", { name: "Frequency" })).toBeTruthy();
    expect(
      (
        within(wizard).getByRole("radio", {
          name: "Remind me once",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      within(wizard).queryByRole("radio", { name: "Date and time" }),
    ).toBeNull();
    const recurrenceLabels = within(wizard)
      .getAllByRole("radio")
      .map((radio) => radio.closest("label")?.textContent?.replace(/\s+/g, " ").trim());

    expect(recurrenceLabels).toEqual([
      expect.stringContaining("Remind me once"),
      expect.stringContaining("Weekday Routines"),
      expect.stringContaining("Micro Loops"),
      expect.stringContaining("Daily-ish"),
    ]);
    expect(recurrenceLabels[1]).toContain("🔥 Popular");
    expect(
      within(wizard).getByText(
        "Schedule fast check-in to stay on top of things throughout the day",
      ),
    ).toBeTruthy();
    expect(
      within(wizard).getByText(
        "Set reminders on daily, weekly or monthly intervals... keep up with your car recurring maintenance or dental cleaning",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("region", { name: "New custom reminder" }),
    ).toBeNull();
    openCustomReminderWizard();
    const reopenedWizard = screen.getByRole("region", {
      name: "New custom reminder",
    });
    fireEvent.click(
      within(reopenedWizard).getByRole("radio", { name: "Weekday Routines" }),
    );
    const weekdayTimeField = within(reopenedWizard)
      .getByLabelText("Time")
      .closest("label");
    const weekdayGroup = within(reopenedWizard).getByRole("group", {
      name: "Repeat on",
    });
    expect(
      (weekdayTimeField?.compareDocumentPosition(weekdayGroup) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(within(reopenedWizard).getByRole("radio", { name: "Daily-ish" }));
    expect(within(reopenedWizard).queryByLabelText("Date")).toBeNull();
    expect(within(reopenedWizard).queryByLabelText("Time")).toBeNull();
    expect(
      within(reopenedWizard).queryByLabelText("Repeat every days"),
    ).toBeNull();
    expect(within(reopenedWizard).queryByLabelText("Time of day")).toBeNull();
    expect(within(reopenedWizard).getByText("Every")).toBeTruthy();
    expect(
      (within(reopenedWizard).getByLabelText(
        "Custom reminder daily interval amount",
      ) as HTMLInputElement).value,
    ).toBe("1");
    expect(
      within(reopenedWizard).getByLabelText("Custom reminder daily interval unit"),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "Desk reset" },
    });
    fireEvent.change(screen.getByLabelText(/Message/), {
      target: { value: "Reset your desk and posture." },
    });
    fireEvent.click(within(reopenedWizard).getByRole("radio", { name: "Micro Loops" }));
    fireEvent.change(screen.getByLabelText("Custom reminder interval unit"), {
      target: { value: "hours" },
    });
    expect(
      (screen.getByLabelText("Custom reminder interval amount") as HTMLInputElement)
        .value,
    ).toBe("1");
    fireEvent.change(screen.getByLabelText("Custom reminder interval amount"), {
      target: { value: "2" },
    });
    saveCustomReminderFromWizard();

    expect(screen.getByLabelText("Desk reset")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const savedSettings = service.saveSettings.mock.calls[0][0];

    expect(savedSettings.customReminders).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^custom-/),
        title: "Desk reset",
        description: "Reset your desk and posture.",
        schedule: {
          type: "interval",
          intervalMinutes: 120,
        },
        respectReminderWindows: true,
      }),
    ]);
    expect(savedSettings.preferredReminderCategories).toContain(
      savedSettings.customReminders[0].id,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Desk reset" }));
    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "Desk walk" },
    });
    saveCustomReminderFromWizard();

    expect(screen.getByLabelText("Desk walk")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete Desk walk" }));
    expect(screen.getByText("Delete Desk walk?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Desk walk")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete Desk walk" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByText("No custom reminders yet.")).toBeTruthy();
    expect(screen.getByText("Custom reminder removed. Save settings to apply.")).toBeTruthy();
  });

  it("creates a weekday custom reminder in settings", () => {
    const service = createTestSettingsService();

    render(<SettingsScreen service={service} reminderList={reminders} />);

    openCustomReminderWizard();
    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "Water plants" },
    });
    fireEvent.change(screen.getByLabelText(/Message/), {
      target: { value: "Check plant soil." },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Weekday Routines" }));
    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "08:30" },
    });
    saveCustomReminderFromWizard();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const savedSettings = service.saveSettings.mock.calls[0][0];

    expect(savedSettings.customReminders[0]).toMatchObject({
      title: "Water plants",
      schedule: {
        type: "weekdayInterval",
        weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        timeOfDay: "08:30",
      },
    });
  });

  it("creates a daily-ish custom reminder in settings", () => {
    const service = createTestSettingsService();

    render(<SettingsScreen service={service} reminderList={reminders} />);

    openCustomReminderWizard();
    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "Plan review" },
    });
    fireEvent.change(screen.getByLabelText(/Message/), {
      target: { value: "Review the next plan cycle." },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Daily-ish" }));
    fireEvent.change(screen.getByLabelText("Custom reminder daily interval unit"), {
      target: { value: "weeks" },
    });
    expect(
      (screen.getByLabelText(
        "Custom reminder daily interval amount",
      ) as HTMLInputElement).value,
    ).toBe("1");
    fireEvent.change(
      screen.getByLabelText("Custom reminder daily interval amount"),
      {
        target: { value: "2" },
      },
    );
    saveCustomReminderFromWizard();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const savedSettings = service.saveSettings.mock.calls[0][0];

    expect(savedSettings.customReminders[0]).toMatchObject({
      title: "Plan review",
      schedule: {
        type: "dailyInterval",
        dayIntervalDays: 14,
        timeOfDay: "09:00",
      },
    });
  });

  it("resets settings to defaults", () => {
    const service = createTestSettingsService({
      ...getDefaultAppSettings(),
      reminderIntensity: "active",
      timezone: "America/New_York",
    });

    render(<SettingsScreen service={service} reminderList={reminders} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    fireEvent.click(screen.getByRole("button", { name: "Reminder categories" }));

    const balancedOption = screen.getByRole("radio", {
      name: "Balanced",
    }) as HTMLInputElement;

    expect(service.saveSettings).toHaveBeenCalledWith(getDefaultAppSettings());
    expect(balancedOption.checked).toBe(true);
    expect(screen.getByRole("status").textContent).toContain(
      "Defaults restored.",
    );
  });

  it("resets only today's progress history in settings", () => {
    const service = createTestSettingsService();
    const todayEntry = {
      id: "today-entry",
      reminderId: "eye-strain",
      reminderTitle: "Eye strain",
      actionType: "done",
      occurredAt: new Date(2026, 4, 15, 9, 0),
    } satisfies ReminderHistoryEntry;
    const olderEntry = {
      id: "older-entry",
      reminderId: "hydration",
      reminderTitle: "Hydration",
      actionType: "snooze",
      occurredAt: new Date(2026, 4, 14, 23, 30),
      snoozedUntil: new Date(2026, 4, 15, 0, 0),
    } satisfies ReminderHistoryEntry;
    const historyService = createTestHistoryService([todayEntry, olderEntry]);

    render(
      <SettingsScreen
        service={service}
        historyService={historyService}
        currentDate={new Date(2026, 4, 15, 12, 0)}
        reminderList={reminders}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Reset today's progress" }),
    );

    expect(historyService.saveReminderHistory).toHaveBeenCalledWith([
      olderEntry,
    ]);
    expect(service.saveSettings).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain(
      "Today's progress reset.",
    );
  });

  it("renders core backlog categories", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Backlog" }));

    for (const category of [
      "P0 Foundation",
      "P0 Core Screens",
      "P0 Reminder Categories",
      "P1 Settings",
      "P2 Mobile Packaging",
      "P2 Apple Watch",
    ]) {
      expect(screen.getByText(category)).toBeTruthy();
    }
  });
});
