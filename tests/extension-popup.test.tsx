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
  activityFunFactsByReminderId,
  getActivityFunFact,
} from "../src/extension/activityFunFacts";
import {
  getDefaultExtensionSettings,
  type ExtensionSettings,
  type ExtensionSettingsStorage,
} from "../src/extension/extensionSettingsStorage";

const previewDate = new Date(2026, 4, 15, 10, 0);
const firstEyeStrainFact = activityFunFactsByReminderId["eye-strain"][0];

const activityIconAssetById: Record<string, string> = {
  hydration: "/assets/activity-icons/hydration.png",
  "eye-strain": "/assets/activity-icons/eye-strain.png",
  stretch: "/assets/activity-icons/stretch.png",
  "stand-walk": "/assets/activity-icons/stand-walk.png",
  posture: "/assets/activity-icons/posture.png",
  "breathing-reset": "/assets/activity-icons/breathing-reset.png",
  "sleep-routine": "/assets/activity-icons/sleep-routine.png",
  "mood-energy": "/assets/activity-icons/mood-energy.png",
};

function createStorageMock(
  settings: ExtensionSettings = getDefaultExtensionSettings(),
): ExtensionSettingsStorage {
  return {
    loadSettings: vi.fn(async () => settings),
    saveSettings: vi.fn(async () => true),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ExtensionPopup", () => {
  it("renders VitaLoop branding and the next nudge", async () => {
    const onOpenOptions = vi.fn();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { container } = render(
      <ExtensionPopup
        storage={createStorageMock()}
        currentDate={previewDate}
        onOpenOptions={onOpenOptions}
      />,
    );

    const titlebar = container.querySelector(".extension-titlebar");

    expect(titlebar).toBeTruthy();
    expect(
      within(titlebar as HTMLElement).getByRole("heading", {
        level: 1,
        name: "VitaLoop",
      }),
    ).toBeTruthy();
    expect(titlebar?.querySelector(".extension-window-dot")).toBeNull();
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
    expect(within(nextNudge).getByText("45 min")).toBeTruthy();
    expect(within(nextNudge).getByText("10:45 AM")).toBeTruthy();
    expect(
      within(nextNudge).getByLabelText("Next reminder in 45 min at 10:45 AM"),
    ).toBeTruthy();
    expect(within(nextNudge).getByText(firstEyeStrainFact)).toBeTruthy();

    const activityIcon = nextNudge.querySelector(
      "[data-activity-icon='eye-strain']",
    );

    expect(activityIcon).toBeTruthy();
    expect(activityIcon?.getAttribute("aria-hidden")).toBe("true");

    const activityImage = activityIcon?.querySelector("img");

    expect(activityImage?.getAttribute("src")).toBe(
      activityIconAssetById["eye-strain"],
    );
    expect(activityImage?.getAttribute("alt")).toBe("");
    expect(activityImage?.getAttribute("aria-hidden")).toBe("true");
    expect(within(nextNudge).queryByText("Screen breaks")).toBeNull();
    expect(
      within(nextNudge).queryByText(
        "Look away from the screen and soften your focus.",
      ),
    ).toBeNull();
    expect(
      within(nextNudge).getByText(
        "Suggested around 10:45 AM on a 45 minute rhythm.",
      ),
    ).toBeTruthy();
  });

  it.each(reminders)(
    "renders a decorative activity icon for $title",
    async (reminder) => {
      render(
        <ExtensionPopup
          storage={createStorageMock({
            ...getDefaultExtensionSettings(),
            preferredReminderCategories: [reminder.id],
          })}
          reminderList={[reminder]}
          currentDate={previewDate}
          onOpenOptions={vi.fn()}
        />,
      );

      const nextNudge = screen.getByLabelText("Next wellness nudge");

      await waitFor(() => {
        expect(
          within(nextNudge).getByRole("heading", { name: reminder.title }),
        ).toBeTruthy();
      });

      const activityIcon = nextNudge.querySelector(
        `[data-activity-icon='${reminder.id}']`,
      );

      expect(activityIcon).toBeTruthy();
      expect(activityIcon?.getAttribute("aria-hidden")).toBe("true");

      const activityImage = activityIcon?.querySelector("img");

      expect(activityImage?.getAttribute("src")).toBe(
        activityIconAssetById[reminder.id],
      );
      expect(activityImage?.getAttribute("alt")).toBe("");
      expect(activityImage?.getAttribute("aria-hidden")).toBe("true");
    },
  );

  it("defines ten activity facts for each built-in reminder", () => {
    expect(Object.keys(activityFunFactsByReminderId).sort()).toEqual(
      reminders.map((reminder) => reminder.id).sort(),
    );

    for (const facts of Object.values(activityFunFactsByReminderId)) {
      expect(facts).toHaveLength(10);
      expect(new Set(facts).size).toBe(10);
      expect(
        facts.every((fact) => fact.length >= 40 && fact.length <= 120),
      ).toBe(true);
    }
  });

  it("selects built-in activity facts by open seed", () => {
    const hydrationReminder = reminders.find(
      (reminder) => reminder.id === "hydration",
    );

    if (!hydrationReminder) {
      throw new Error("Expected Hydration reminder fixture.");
    }

    expect(getActivityFunFact(hydrationReminder, 0)).toBe(
      activityFunFactsByReminderId.hydration[0],
    );
    expect(getActivityFunFact(hydrationReminder, 0.999)).toBe(
      activityFunFactsByReminderId.hydration[9],
    );
  });

  it("renders custom reminders with the fallback activity icon", async () => {
    const customReminder = {
      id: "custom-123e4567-e89b-42d3-a456-426614174000",
      title: "Desk reset",
      category: "Custom",
      description: "Reset your desk and posture.",
      suggestedFrequency: "Every 25 minutes",
      enabledByDefault: true,
      wellnessIntent: "Reset your desk and posture.",
      displayPriority: 9,
      schedule: {
        type: "interval",
        intervalMinutes: 25,
      },
      respectReminderWindows: true,
    } as const;

    render(
      <ExtensionPopup
        storage={createStorageMock({
          ...getDefaultExtensionSettings(),
          preferredReminderCategories: [customReminder.id],
          customReminders: [customReminder],
        })}
        reminderList={[]}
        currentDate={previewDate}
        onOpenOptions={vi.fn()}
      />,
    );

    const nextNudge = screen.getByLabelText("Next wellness nudge");

    await waitFor(() => {
      expect(
        within(nextNudge).getByRole("heading", { name: "Desk reset" }),
      ).toBeTruthy();
    });
    expect(
      nextNudge.querySelector("[data-activity-icon='fallback']"),
    ).toBeTruthy();
    expect(
      within(nextNudge).getByText("Reset your desk and posture."),
    ).toBeTruthy();
    expect(getActivityFunFact(customReminder)).toBe(
      "Reset your desk and posture.",
    );
    expect(
      within(nextNudge).getByText(
        "Suggested around 10:25 AM on a 25 minute rhythm.",
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
    const storage = createStorageMock();

    render(
      <ExtensionPopup
        storage={storage}
        currentDate={previewDate}
        onOpenOptions={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("status").textContent).toContain("marked done");
    expect(screen.getByRole("heading", { name: "Stand/walk" })).toBeTruthy();
    const headsUp = screen.getByLabelText("Head's up");

    expect(headsUp).toBeTruthy();
    expect(within(headsUp).getByText("Stand/walk")).toBeTruthy();
    expect(within(headsUp).getByText("1 hr")).toBeTruthy();
    expect(within(headsUp).getByText("Scheduled for 11:00 AM")).toBeTruthy();
    expect(storage.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        reminderHistory: [
          expect.objectContaining({
            reminderId: "eye-strain",
            reminderTitle: "Eye strain",
            actionType: "done",
          }),
        ],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip once" }));

    expect(screen.getByRole("status").textContent).toContain("skipped once");
  });

  it("renders upcoming reminders instead of stored history", async () => {
    render(
      <ExtensionPopup
        storage={createStorageMock({
          ...getDefaultExtensionSettings(),
          reminderHistory: [
            {
              id: "history-1",
              reminderId: "hydration",
              reminderTitle: "Hydration",
              actionType: "snooze",
              occurredAt: previewDate,
              snoozedUntil: new Date(2026, 4, 15, 10, 15),
            },
          ],
        })}
        currentDate={previewDate}
        onOpenOptions={vi.fn()}
      />,
    );

    const headsUp = screen.getByLabelText("Head's up");

    await waitFor(() => {
      expect(within(headsUp).getByText("Eye strain")).toBeTruthy();
    });
    expect(within(headsUp).getByText("45 min")).toBeTruthy();
    expect(within(headsUp).getByText("Scheduled for 10:45 AM")).toBeTruthy();
    expect(within(headsUp).queryByText("10:00 AM · Snoozed")).toBeNull();
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
    const headsUp = screen.getByLabelText("Head's up");

    expect(within(headsUp).getByText("Eye strain")).toBeTruthy();
    expect(within(headsUp).getByText("1 hr")).toBeTruthy();
    expect(within(headsUp).getByText("Snoozed until 11:00 AM")).toBeTruthy();
  });
});
