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
    const recentActivity = screen.getByLabelText("Recent activity");

    expect(recentActivity).toBeTruthy();
    expect(within(recentActivity).getByText("10:00 AM · Done")).toBeTruthy();
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
    expect(screen.getByText("10:00 AM · Snoozed")).toBeTruthy();
    expect(screen.getByText("Until 11:00 AM")).toBeTruthy();
  });

  it("renders an empty recent activity state", () => {
    render(<HomeScreen reminders={reminders} />);

    expect(screen.getByLabelText("Recent activity")).toBeTruthy();
    expect(screen.getByText("No reminder activity yet.")).toBeTruthy();
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

    expect(screen.getByLabelText("Timezone")).toBeTruthy();
    expect(screen.getByLabelText("Quiet hours enabled")).toBeTruthy();
    expect(screen.getByLabelText("Quiet hours start")).toBeTruthy();
    expect(screen.getByLabelText("Quiet hours end")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Balanced" })).toBeTruthy();
    expect(screen.getByLabelText("Workday start")).toBeTruthy();
    expect(screen.getByLabelText("Workday end")).toBeTruthy();
    expect(screen.getByLabelText("Hydration")).toBeTruthy();
  });

  it("saves updated settings", () => {
    const service = createTestSettingsService();

    render(<SettingsScreen service={service} reminderList={reminders} />);

    fireEvent.click(screen.getByRole("radio", { name: "Active" }));
    fireEvent.change(screen.getByLabelText("Workday start"), {
      target: { value: "09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Add custom reminder" }));

    expect(screen.getByText("Enter a title.")).toBeTruthy();
    expect(screen.getByText("Enter a message.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Custom reminder title/), {
      target: { value: "Desk reset" },
    });
    fireEvent.change(screen.getByLabelText(/Custom reminder message/), {
      target: { value: "Reset your desk and posture." },
    });
    fireEvent.change(screen.getByLabelText(/Custom reminder frequency minutes/), {
      target: { value: "4.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add custom reminder" }));

    expect(screen.getByText("Use a whole number from 5 to 1440.")).toBeTruthy();
    expect(screen.queryByLabelText("Desk reset")).toBeNull();
    expect(service.saveSettings).not.toHaveBeenCalled();
  });

  it("creates, edits, and deletes a custom reminder in settings", () => {
    const service = createTestSettingsService();

    render(<SettingsScreen service={service} reminderList={reminders} />);

    fireEvent.change(screen.getByLabelText(/Custom reminder title/), {
      target: { value: "Desk reset" },
    });
    fireEvent.change(screen.getByLabelText(/Custom reminder message/), {
      target: { value: "Reset your desk and posture." },
    });
    fireEvent.change(screen.getByLabelText(/Custom reminder frequency minutes/), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add custom reminder" }));

    expect(screen.getByLabelText("Desk reset")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    const savedSettings = service.saveSettings.mock.calls[0][0];

    expect(savedSettings.customReminders).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^custom-/),
        title: "Desk reset",
        description: "Reset your desk and posture.",
        customFrequencyMinutes: 25,
      }),
    ]);
    expect(savedSettings.preferredReminderCategories).toContain(
      savedSettings.customReminders[0].id,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/Custom reminder title/), {
      target: { value: "Desk walk" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Update custom reminder" }),
    );

    expect(screen.getByLabelText("Desk walk")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete Desk walk?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Desk walk")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByText("No custom reminders yet.")).toBeTruthy();
    expect(screen.getByText("Custom reminder removed. Save settings to apply.")).toBeTruthy();
  });

  it("resets settings to defaults", () => {
    const service = createTestSettingsService({
      ...getDefaultAppSettings(),
      reminderIntensity: "active",
      timezone: "America/New_York",
    });

    render(<SettingsScreen service={service} reminderList={reminders} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

    const balancedOption = screen.getByRole("radio", {
      name: "Balanced",
    }) as HTMLInputElement;

    expect(service.saveSettings).toHaveBeenCalledWith(getDefaultAppSettings());
    expect(balancedOption.checked).toBe(true);
    expect(screen.getByRole("status").textContent).toContain(
      "Defaults restored.",
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
