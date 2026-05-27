import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
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

function expandCustomReminders() {
  fireEvent.click(screen.getByRole("button", { name: "Reminders" }));
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

describe("ExtensionOptions", () => {
  it("renders key settings controls by accessible label", () => {
    render(<ExtensionOptions storage={createStorageMock()} />);

    expect(screen.queryByLabelText("Enable proactive reminders")).toBeNull();
    expect(screen.queryByLabelText("Reminder intensity")).toBeNull();
    expect(screen.queryByRole("button", { name: "About" })).toBeNull();
    expect(screen.queryByText("👨🏻‍💻 Working Hours")).toBeNull();
    expect(screen.queryByRole("button", { name: "Schedule" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Notifications" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Appearance" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Data & privacy" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Custom reminders" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reminders" }));
    expect(
      screen.getByRole("heading", { name: "Manage Your VitaLoops" }),
    ).toBeTruthy();
    const hydrationControl = screen.getByLabelText("Hydration");
    expect(hydrationControl).toBeTruthy();
    expect(screen.getByLabelText("Eye strain")).toBeTruthy();
    expect(screen.queryByLabelText("Sleep routine")).toBeNull();
    expect(screen.queryByLabelText("Mood/energy check-in")).toBeNull();
    expect(screen.queryByLabelText("Saved")).toBeNull();
    expect(screen.getByLabelText("Enable proactive reminders")).toBeTruthy();
    expect(
      (screen.getByLabelText("Reminder intensity") as HTMLSelectElement).value,
    ).toBe("balanced");
    const customRemindersSummary = screen.getByText("Custom reminders");
    const customRemindersDetails = customRemindersSummary.closest("details");
    expect(
      customRemindersDetails?.hasAttribute("open"),
    ).toBe(false);
    const proactiveReminderControl = screen
      .getByLabelText("Enable proactive reminders")
      .closest("label");
    const reminderIntensityControl = screen
      .getByLabelText("Reminder intensity")
      .closest("label");
    const hydrationRow = hydrationControl.closest("label");
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
    fireEvent.click(screen.getByRole("button", { name: "General" }));
    expect(screen.queryByLabelText("Enable proactive reminders")).toBeNull();
    expect(screen.queryByLabelText("Reminder intensity")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Send test notification" }),
    ).toBeTruthy();
    expect(screen.getByText("Quick actions")).toBeTruthy();
    expect(screen.queryByText("Local status")).toBeNull();
  });

  it("saves settings through the storage adapter", async () => {
    const storage = createStorageMock();

    render(<ExtensionOptions storage={storage} />);

    fireEvent.click(screen.getByRole("button", { name: "Reminders" }));
    fireEvent.click(screen.getByLabelText("Enable proactive reminders"));
    fireEvent.change(screen.getByLabelText("Reminder intensity"), {
      target: { value: "active" },
    });
    fireEvent.click(screen.getByText("👨🏻‍💻 Working Hours"));
    fireEvent.change(screen.getByLabelText("Workday start"), {
      target: { value: "09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

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

  it("shows field-specific custom reminder validation errors", async () => {
    const storage = createStorageMock();

    render(<ExtensionOptions storage={storage} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Options" })).toBeTruthy();
    });

    openCustomReminderWizard();
    fireEvent.click(
      screen.getByRole("button", { name: "Add Reminder" }),
    );

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
    expect(storage.saveSettings).not.toHaveBeenCalled();
  });

  it("shows custom reminder character limits only near the maximum", async () => {
    const storage = createStorageMock();

    render(<ExtensionOptions storage={storage} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Options" })).toBeTruthy();
    });

    expect(screen.queryByLabelText(/Title/)).toBeNull();
    openCustomReminderWizard();
    expect(screen.queryByText("0/48")).toBeNull();

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "A".repeat(33) },
    });
    const warningLimit = screen.getByText(
      "Maximum limit of characters is 33/48",
    );

    expect(warningLimit.className).not.toContain(
      "extension-character-limit-hint-danger",
    );

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "A".repeat(38) },
    });

    expect(
      screen.getByText("Maximum limit of characters is 38/48").className,
    ).toContain("extension-character-limit-hint-danger");

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "A".repeat(32) },
    });

    expect(
      screen.queryByText("Maximum limit of characters is 32/48"),
    ).toBeNull();
  });

  it("creates, edits, deletes, and saves custom reminders", async () => {
    const storage = createStorageMock();

    render(<ExtensionOptions storage={storage} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Options" })).toBeTruthy();
    });

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

    await waitFor(() => {
      expect(storage.saveSettings).toHaveBeenCalledTimes(1);
    });

    const savedSettings = storage.saveSettings.mock.calls[0][0];

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
    expect(
      screen.getByText("Custom reminder removed. Save settings to apply."),
    ).toBeTruthy();
  });

  it("creates and saves a one-time custom reminder", async () => {
    const storage = createStorageMock();

    render(<ExtensionOptions storage={storage} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Options" })).toBeTruthy();
    });

    openCustomReminderWizard();
    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "Appointment prep" },
    });
    fireEvent.change(screen.getByLabelText(/Message/), {
      target: { value: "Gather appointment notes." },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-12-31" },
    });
    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "10:15" },
    });
    fireEvent.click(
      screen.getByLabelText("Respect quiet hours and workday"),
    );
    saveCustomReminderFromWizard();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(storage.saveSettings).toHaveBeenCalledTimes(1);
    });
    expect(storage.saveSettings.mock.calls[0][0].customReminders[0]).toMatchObject({
      title: "Appointment prep",
      schedule: {
        type: "oneTime",
        date: "2026-12-31",
        timeOfDay: "10:15",
      },
      respectReminderWindows: false,
    });
  });

  it("creates and saves a daily-ish custom reminder", async () => {
    const storage = createStorageMock();

    render(<ExtensionOptions storage={storage} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Options" })).toBeTruthy();
    });

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

    await waitFor(() => {
      expect(storage.saveSettings).toHaveBeenCalledTimes(1);
    });

    expect(storage.saveSettings.mock.calls[0][0].customReminders[0]).toMatchObject({
      title: "Plan review",
      schedule: {
        type: "dailyInterval",
        dayIntervalDays: 14,
        timeOfDay: "09:00",
      },
    });
  });

  it("resets settings to defaults", async () => {
    const storage = createStorageMock({
      ...getDefaultExtensionSettings(),
      proactiveRemindersEnabled: true,
      reminderIntensity: "active",
      workdayStart: "09:00",
    });

    render(<ExtensionOptions storage={storage} />);

    fireEvent.click(screen.getByRole("button", { name: "Reminders" }));

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Reminder intensity") as HTMLSelectElement)
          .value,
      ).toBe("active");
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

    await waitFor(() => {
      expect(storage.saveSettings).toHaveBeenCalledWith(
        getDefaultExtensionSettings(),
      );
    });
    expect(
      (screen.getByLabelText("Reminder intensity") as HTMLSelectElement).value,
    ).toBe("balanced");
    expect(screen.getByRole("status").textContent).toContain(
      "Defaults restored.",
    );
  });

  it("resets only today's progress through the storage adapter", async () => {
    const todayEntry = {
      id: "today-entry",
      reminderId: "eye-strain",
      reminderTitle: "Eye strain",
      actionType: "done",
      occurredAt: new Date(2026, 4, 15, 9, 0),
    } satisfies ExtensionSettings["reminderHistory"][number];
    const olderEntry = {
      id: "older-entry",
      reminderId: "hydration",
      reminderTitle: "Hydration",
      actionType: "snooze",
      occurredAt: new Date(2026, 4, 14, 23, 30),
      snoozedUntil: new Date(2026, 4, 15, 0, 0),
    } satisfies ExtensionSettings["reminderHistory"][number];
    const storage = createStorageMock({
      ...getDefaultExtensionSettings(),
      proactiveRemindersEnabled: true,
      snoozedUntilByReminderId: {
        "eye-strain": new Date(2026, 4, 15, 10, 15),
      },
      reminderHistory: [todayEntry, olderEntry],
    });

    render(
      <ExtensionOptions
        storage={storage}
        currentDate={new Date(2026, 4, 15, 12, 0)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reminders" }));

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Enable proactive reminders") as HTMLInputElement)
          .checked,
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "General" }));

    fireEvent.click(
      screen.getByRole("button", { name: "Reset today's progress" }),
    );

    await waitFor(() => {
      expect(storage.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          proactiveRemindersEnabled: true,
          snoozedUntilByReminderId: {},
          reminderHistory: [olderEntry],
        }),
      );
    });
    expect(screen.getByRole("status").textContent).toContain(
      "Today's progress reset.",
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
