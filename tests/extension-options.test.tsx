import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExtensionOptions } from "../src/extension/ExtensionOptions";
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
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ExtensionOptions", () => {
  it("renders key settings controls by accessible label", () => {
    render(<ExtensionOptions storage={createStorageMock()} />);

    expect(screen.getByLabelText("Enable proactive reminders")).toBeTruthy();
    expect(screen.getByLabelText("Quiet hours enabled")).toBeTruthy();
    expect(screen.getByLabelText("Quiet hours start")).toBeTruthy();
    expect(screen.getByLabelText("Quiet hours end")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Balanced" })).toBeTruthy();
    expect(screen.getByLabelText("Workday start")).toBeTruthy();
    expect(screen.getByLabelText("Workday end")).toBeTruthy();
    expect(screen.getByLabelText("Hydration")).toBeTruthy();
    expect(screen.getByLabelText("Eye strain")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Send test notification" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "VitaLoop uses local browser alarms and notifications for proactive reminders in Chromium-based browsers. Notification permission is needed for this local extension feature.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Proactive reminders are disabled.")).toBeTruthy();
  });

  it("saves settings through the storage adapter", async () => {
    const storage = createStorageMock();

    render(<ExtensionOptions storage={storage} />);

    fireEvent.click(screen.getByLabelText("Enable proactive reminders"));
    fireEvent.click(screen.getByRole("radio", { name: "Active" }));
    fireEvent.change(screen.getByLabelText("Workday start"), {
      target: { value: "09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(storage.saveSettings).toHaveBeenCalledTimes(1);
    });
    expect(storage.saveSettings.mock.calls[0][0]).toMatchObject({
      proactiveRemindersEnabled: true,
      reminderIntensity: "active",
      workdayStart: "09:00",
    });
    expect(screen.getByRole("status").textContent).toContain("Settings saved.");
  });

  it("creates, edits, deletes, and saves custom reminders", async () => {
    const storage = createStorageMock();

    render(<ExtensionOptions storage={storage} />);

    await waitFor(() => {
      expect(screen.getByText("Proactive reminders are disabled.")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Custom reminder title"), {
      target: { value: "Desk reset" },
    });
    fireEvent.change(screen.getByLabelText("Custom reminder message"), {
      target: { value: "Reset your desk and posture." },
    });
    fireEvent.change(screen.getByLabelText("Custom reminder frequency minutes"), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add custom reminder" }));

    expect(screen.getByLabelText("Desk reset")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(storage.saveSettings).toHaveBeenCalledTimes(1);
    });

    const savedSettings = storage.saveSettings.mock.calls[0][0];

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
    fireEvent.change(screen.getByLabelText("Custom reminder title"), {
      target: { value: "Desk walk" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Update custom reminder" }),
    );

    expect(screen.getByLabelText("Desk walk")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("No custom reminders yet.")).toBeTruthy();
  });

  it("resets settings to defaults", async () => {
    const storage = createStorageMock({
      ...getDefaultExtensionSettings(),
      proactiveRemindersEnabled: true,
      reminderIntensity: "active",
      workdayStart: "09:00",
    });

    render(<ExtensionOptions storage={storage} />);

    await waitFor(() => {
      expect(
        (screen.getByRole("radio", { name: "Active" }) as HTMLInputElement)
          .checked,
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

    await waitFor(() => {
      expect(storage.saveSettings).toHaveBeenCalledWith(
        getDefaultExtensionSettings(),
      );
    });
    expect(
      (screen.getByRole("radio", { name: "Balanced" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(screen.getByRole("status").textContent).toContain(
      "Defaults restored.",
    );
  });

  it("sends a test notification through the extension notification api", async () => {
    const createNotification = vi.fn(
      (
        _notificationId: string,
        _options: unknown,
        callback?: () => void,
      ) => {
        callback?.();
      },
    );

    vi.stubGlobal("chrome", {
      notifications: {
        create: createNotification,
        getPermissionLevel: vi.fn(
          (callback: (permissionLevel: "granted") => void) => {
            callback("granted");
          },
        ),
      },
      runtime: {
        getURL: (path: string) => `chrome-extension://vitaloop/${path}`,
      },
    });

    render(<ExtensionOptions storage={createStorageMock()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Send test notification" }),
    );

    await waitFor(() => {
      expect(createNotification).toHaveBeenCalledWith(
        expect.stringMatching(/^vitaloop-test-notification-\d+$/),
        expect.objectContaining({
          type: "basic",
          title: "VitaLoop: Eye strain",
          message: "Look away from the screen and soften your focus.",
          contextMessage: "Local browser reminder",
          iconUrl:
            "chrome-extension://vitaloop/assets/app-icons/vitaloop-notification-logo.png",
          requireInteraction: true,
          buttons: [{ title: "Done" }, { title: "Snooze" }],
        }),
        expect.any(Function),
      );
    });
    expect(screen.getByRole("status").textContent).toContain(
      "Browser accepted the test notification.",
    );
  });

  it("disables the test notification button while a send is pending", async () => {
    const getPermissionLevel = vi.fn();

    vi.stubGlobal("chrome", {
      notifications: {
        create: vi.fn(),
        getPermissionLevel,
      },
      runtime: {
        getURL: (path: string) => `chrome-extension://vitaloop/${path}`,
      },
    });

    render(<ExtensionOptions storage={createStorageMock()} />);

    const testButton = screen.getByRole("button", {
      name: "Send test notification",
    }) as HTMLButtonElement;

    fireEvent.click(testButton);

    await waitFor(() => {
      expect(testButton.disabled).toBe(true);
    });
    expect(screen.getByRole("status").textContent).toContain(
      "Preparing notification check",
    );

    fireEvent.click(testButton);

    expect(getPermissionLevel).toHaveBeenCalledTimes(1);
  });

  it("shows permission guidance when browser notifications are denied", () => {
    vi.stubGlobal("chrome", {
      notifications: {
        create: vi.fn(),
        getPermissionLevel: vi.fn(
          (callback: (permissionLevel: "denied") => void) => {
            callback("denied");
          },
        ),
      },
      runtime: {},
    });

    render(<ExtensionOptions storage={createStorageMock()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Send test notification" }),
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Browser notification permission is denied.",
    );
  });

  it("falls back to a page-level notification when extension notifications are unavailable", async () => {
    const sentNotifications: Array<{
      title: string;
      options?: NotificationOptions;
    }> = [];

    class FakeNotification {
      static permission = "granted" as NotificationPermission;

      constructor(title: string, options?: NotificationOptions) {
        sentNotifications.push({ title, options });
      }
    }

    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://vitaloop/${path}`,
      },
    });
    vi.stubGlobal("Notification", FakeNotification);

    render(<ExtensionOptions storage={createStorageMock()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Send test notification" }),
    );

    await waitFor(() => {
      expect(sentNotifications).toEqual([
        {
          title: "VitaLoop: Eye strain",
          options: expect.objectContaining({
            body: "Look away from the screen and soften your focus.",
            icon:
              "chrome-extension://vitaloop/assets/app-icons/vitaloop-notification-logo.png",
            requireInteraction: true,
          }),
        },
      ]);
    });
    expect(screen.getByRole("status").textContent).toContain(
      "Fallback browser notification was sent",
    );
  });

  it("shows an unavailable state when test notifications cannot be created", () => {
    vi.stubGlobal("chrome", undefined);
    vi.stubGlobal("Notification", undefined);

    render(<ExtensionOptions storage={createStorageMock()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Send test notification" }),
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "The extension notification API is unavailable",
    );
  });
});
