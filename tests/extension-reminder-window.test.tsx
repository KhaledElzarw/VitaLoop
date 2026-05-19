import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExtensionReminderWindow } from "../src/extension/ExtensionReminderWindow";
import {
  getDefaultExtensionSettings,
  type ExtensionSettings,
  type ExtensionSettingsStorage,
} from "../src/extension/extensionSettingsStorage";

const reminderDate = new Date(2026, 4, 15, 10, 0);

function createStorageMock(
  initialSettings: ExtensionSettings = {
    ...getDefaultExtensionSettings(),
    proactiveRemindersEnabled: true,
    quietHoursEnabled: false,
  },
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

afterEach(cleanup);

describe("ExtensionReminderWindow", () => {
  it("renders a focused reminder popup with Snooze and Done actions", async () => {
    render(
      <ExtensionReminderWindow
        storage={createStorageMock()}
        currentDate={reminderDate}
        windowLocation={{ search: "?reminderId=eye-strain" }}
        onClose={vi.fn()}
      />,
    );

    const reminderPanel = screen.getByLabelText("Reminder");

    await waitFor(() => {
      expect(
        within(reminderPanel).getByRole("heading", { name: "Eye strain" }),
      ).toBeTruthy();
    });
    expect(
      within(reminderPanel).getByText(
        "Look away from the screen and soften your focus.",
      ),
    ).toBeTruthy();

    const actions = within(reminderPanel).getByLabelText("Reminder actions");

    expect(within(actions).getByRole("button", { name: "Snooze" })).toBeTruthy();
    expect(within(actions).getByRole("button", { name: "Done" })).toBeTruthy();
  });

  it("saves snooze state and closes the reminder popup", async () => {
    const storage = createStorageMock();
    const onClose = vi.fn();

    render(
      <ExtensionReminderWindow
        storage={storage}
        currentDate={reminderDate}
        windowLocation={{ search: "?reminderId=eye-strain" }}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Eye strain" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Snooze" }));

    await waitFor(() => {
      expect(storage.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          snoozedUntilByReminderId: {
            "eye-strain": new Date(2026, 4, 15, 10, 15),
          },
        }),
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Done without saving settings", async () => {
    const storage = createStorageMock();
    const onClose = vi.fn();

    render(
      <ExtensionReminderWindow
        storage={storage}
        currentDate={reminderDate}
        windowLocation={{ search: "?reminderId=eye-strain" }}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Eye strain" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(storage.saveSettings).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
