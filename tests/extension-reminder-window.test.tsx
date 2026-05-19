import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExtensionReminderWindow } from "../src/extension/ExtensionReminderWindow";
import {
  getDefaultExtensionSettings,
  type ExtensionSettings,
  type ExtensionSettingsStorage,
} from "../src/extension/extensionSettingsStorage";

function createStorageMock(
  initialSettings: ExtensionSettings = getDefaultExtensionSettings(),
): ExtensionSettingsStorage & {
  loadSettings: ReturnType<typeof vi.fn<() => Promise<ExtensionSettings>>>;
  saveSettings: ReturnType<
    typeof vi.fn<(settings: ExtensionSettings) => Promise<boolean>>
  >;
} {
  let currentSettings = initialSettings;

  return {
    loadSettings: vi.fn(async () => currentSettings),
    saveSettings: vi.fn(async (settings: ExtensionSettings) => {
      currentSettings = settings;
      return true;
    }),
  };
}

afterEach(() => {
  cleanup();
});

describe("ExtensionReminderWindow", () => {
  it("renders the custom reminder surface with inline Done and Snooze buttons", async () => {
    render(
      <ExtensionReminderWindow
        storage={createStorageMock()}
        currentDate={new Date(2026, 4, 15, 10, 0)}
        windowLocation={{ search: "?reminderId=eye-strain" }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "VitaLoop: Eye strain" }),
    ).toBeTruthy();
    expect(screen.getByText("Local browser reminder")).toBeTruthy();
    expect(
      screen.getByText("Look away from the screen and soften your focus."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Snooze" })).toBeTruthy();

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "Done" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
  });

  it("closes without persisting settings when Done is clicked", async () => {
    const storage = createStorageMock();
    const onClose = vi.fn();

    render(
      <ExtensionReminderWindow
        storage={storage}
        currentDate={new Date(2026, 4, 15, 10, 0)}
        windowLocation={{ search: "?reminderId=eye-strain" }}
        onClose={onClose}
      />,
    );

    const doneButton = screen.getByRole("button", { name: "Done" });

    await waitFor(() => {
      expect((doneButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(doneButton);

    expect(storage.saveSettings).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("persists a snooze update and closes when Snooze is clicked", async () => {
    const storage = createStorageMock({
      ...getDefaultExtensionSettings(),
      proactiveRemindersEnabled: true,
      quietHoursEnabled: false,
    });
    const onClose = vi.fn();

    render(
      <ExtensionReminderWindow
        storage={storage}
        currentDate={new Date(2026, 4, 15, 10, 0)}
        windowLocation={{ search: "?reminderId=eye-strain" }}
        onClose={onClose}
      />,
    );

    const snoozeButton = screen.getByRole("button", { name: "Snooze" });

    await waitFor(() => {
      expect((snoozeButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(snoozeButton);

    await waitFor(() => {
      expect(storage.saveSettings).toHaveBeenCalledTimes(1);
    });
    expect(storage.saveSettings.mock.calls[0][0]).toMatchObject({
      snoozedUntilByReminderId: {
        "eye-strain": new Date(2026, 4, 15, 10, 15),
      },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state when the reminder id is unavailable", () => {
    render(
      <ExtensionReminderWindow
        storage={createStorageMock()}
        currentDate={new Date(2026, 4, 15, 10, 0)}
        windowLocation={{ search: "?reminderId=unknown" }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No reminders due right now." }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });
});
