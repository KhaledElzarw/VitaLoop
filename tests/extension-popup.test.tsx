import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reminders } from "../src/data/reminders";
import { ExtensionPopup } from "../src/extension/ExtensionPopup";
import {
  getDefaultExtensionSettings,
  type ExtensionSettings,
  type ExtensionSettingsStorage,
} from "../src/extension/extensionSettingsStorage";

const previewDate = new Date(2026, 4, 15, 10, 0);

function createStorageMock(
  settings: ExtensionSettings = getDefaultExtensionSettings(),
): ExtensionSettingsStorage {
  return {
    loadSettings: vi.fn(async () => settings),
    saveSettings: vi.fn(async () => true),
  };
}

afterEach(cleanup);

describe("ExtensionPopup", () => {
  it("renders VitaLoop branding and the next nudge", async () => {
    const onOpenOptions = vi.fn();
    const { container } = render(
      <ExtensionPopup
        storage={createStorageMock()}
        currentDate={previewDate}
        onOpenOptions={onOpenOptions}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "VitaLoop" })).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();

    const brandMark = container.querySelector(".extension-brand-mark");

    expect(brandMark?.getAttribute("src")).toBe(
      "/assets/vitaloop-logo-source.png",
    );
    expect(brandMark?.getAttribute("alt")).toBe("");
    expect(brandMark?.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Open options" }));

    expect(onOpenOptions).toHaveBeenCalledTimes(1);

    const nextNudge = screen.getByLabelText("Next wellness nudge");

    await waitFor(() => {
      expect(
        within(nextNudge).getByRole("heading", { name: "Eye strain" }),
      ).toBeTruthy();
    });
    expect(within(nextNudge).getByText("Screen breaks")).toBeTruthy();
    expect(
      within(nextNudge).getByText(
        "Suggested around 10:45 AM on a 45 minute rhythm.",
      ),
    ).toBeTruthy();
  });

  it("renders Done, Snooze, and Skip once actions", () => {
    render(
      <ExtensionPopup
        storage={createStorageMock()}
        currentDate={previewDate}
        onOpenOptions={vi.fn()}
      />,
    );

    const actions = screen.getByLabelText("Reminder actions");

    expect(within(actions).getByRole("button", { name: "Done" })).toBeTruthy();
    expect(within(actions).getByRole("button", { name: "Snooze" })).toBeTruthy();
    expect(
      within(actions).getByRole("button", { name: "Skip once" }),
    ).toBeTruthy();
  });

  it("shows proactive reminder status", async () => {
    render(
      <ExtensionPopup
        storage={createStorageMock()}
        currentDate={previewDate}
        onOpenOptions={vi.fn()}
      />,
    );

    const statusPanel = screen.getByLabelText("Proactive reminder status");

    await waitFor(() => {
      expect(within(statusPanel).getByText("Disabled")).toBeTruthy();
    });
    expect(
      within(statusPanel).getByText(
        "Enable proactive reminders in Options to use local browser notifications.",
      ),
    ).toBeTruthy();
  });

  it("updates visible in-session status after reminder actions", () => {
    render(
      <ExtensionPopup
        storage={createStorageMock()}
        currentDate={previewDate}
        onOpenOptions={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("status").textContent).toContain("marked done");
    expect(screen.getByRole("heading", { name: "Stand/walk" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Skip once" }));

    expect(screen.getByRole("status").textContent).toContain("skipped once");
  });

  it("does not immediately reselect a snoozed reminder", async () => {
    render(
      <ExtensionPopup
        storage={createStorageMock()}
        currentDate={previewDate}
        onOpenOptions={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Eye strain" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Snooze" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "snoozed until 11:00 AM",
      );
      expect(screen.getByRole("heading", { name: "Stand/walk" })).toBeTruthy();
    });
  });

  it("shows an upcoming state when every current reminder is snoozed", async () => {
    const eyeStrainReminder = reminders.filter(
      (reminder) => reminder.id === "eye-strain",
    );

    render(
      <ExtensionPopup
        storage={createStorageMock()}
        reminderList={eyeStrainReminder}
        currentDate={previewDate}
        onOpenOptions={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Eye strain" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Snooze" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "No reminders due right now." }),
      ).toBeTruthy();
    });
    expect(screen.getByText("Next reminder: Eye strain at 11:00 AM.")).toBeTruthy();
  });
});
