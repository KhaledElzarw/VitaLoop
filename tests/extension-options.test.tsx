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

afterEach(cleanup);

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
});
