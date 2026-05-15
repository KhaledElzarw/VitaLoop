import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDefaultAppSettings } from "../src/domain/settings";
import { ExtensionPopup } from "../src/extension/ExtensionPopup";
import { type ExtensionSettingsStorage } from "../src/extension/extensionSettingsStorage";

const previewDate = new Date(2026, 4, 15, 10, 0);

function createStorageMock(
  settings = getDefaultAppSettings(),
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

    expect(
      screen.getByRole("heading", { level: 1, name: "VitaLoop" }),
    ).toBeTruthy();
    expect(
      container.querySelector(".extension-brand-mark")?.getAttribute("src"),
    ).toBe("/assets/vitaloop-logo-source.png");
    expect(
      container.querySelector(".extension-brand-mark")?.getAttribute("alt"),
    ).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Options" }));

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
