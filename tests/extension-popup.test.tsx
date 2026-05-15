import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExtensionPopup } from "../src/extension/ExtensionPopup";
import {
  getDefaultExtensionSettings,
  type ExtensionSettingsStorage,
} from "../src/extension/extensionSettingsStorage";

const previewDate = new Date(2026, 4, 15, 10, 0);

function createStorageMock(): ExtensionSettingsStorage {
  return {
    loadSettings: vi.fn(async () => getDefaultExtensionSettings()),
    saveSettings: vi.fn(async () => true),
  };
}

afterEach(cleanup);

describe("ExtensionPopup", () => {
  it("renders VitaLoop branding and the next nudge", async () => {
    render(
      <ExtensionPopup
        storage={createStorageMock()}
        currentDate={previewDate}
        onOpenOptions={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "VitaLoop" })).toBeTruthy();

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
});
