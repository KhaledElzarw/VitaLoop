import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App, { HomeScreen, RemindersScreen, SettingsScreen } from "../src/App";
import { reminders } from "../src/data/reminders";
import { type AppSettings } from "../src/domain/schemas";
import { getDefaultAppSettings } from "../src/domain/settings";
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

describe("VitaLoop app shell", () => {
  it("renders VitaLoop branding", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "VitaLoop" })).toBeTruthy();
    expect(
      screen.getByText("Recurring wellness reminders for busy days."),
    ).toBeTruthy();
  });

  it("renders primary navigation labels", () => {
    render(<App />);

    const navigation = screen.getByRole("navigation", { name: "Primary" });

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

  it("updates visible status after a reminder action", () => {
    render(<HomeScreen reminders={reminders} />);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("status").textContent).toContain("marked done");
    expect(screen.getByRole("heading", { name: "Stand/walk" })).toBeTruthy();
  });

  it("shows selected reminder details", () => {
    render(<RemindersScreen reminders={reminders} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Show Eye strain details/i }),
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
