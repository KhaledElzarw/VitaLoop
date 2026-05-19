import { describe, expect, it } from "vitest";
import { reminders } from "../src/data/reminders";
import {
  createReminderNotificationCopy,
  REMINDER_NOTIFICATION_BUTTONS,
  VITALOOP_NOTIFICATION_ICON_URL,
} from "../src/extension/notificationCopy";

const prohibitedMedicalClaims = [
  "diagnose",
  "diagnosis",
  "treat",
  "treatment",
  "prevent",
  "prevention",
  "cure",
  "clinical",
  "emergency",
  "medical advice",
];

describe("notification copy", () => {
  it("generates calm local notification copy for every reminder", () => {
    for (const reminder of reminders) {
      const copy = createReminderNotificationCopy(reminder);

      expect(copy.title).toBe(`VitaLoop: ${reminder.title}`);
      expect(copy.message.length).toBeGreaterThan(0);
      expect(copy.contextMessage).toBe("Local browser reminder");
    }
  });

  it("avoids medical, clinical, or emergency claims", () => {
    const copyText = reminders
      .map((reminder) => {
        const copy = createReminderNotificationCopy(reminder);

        return `${copy.title} ${copy.message} ${copy.contextMessage}`;
      })
      .join(" ")
      .toLowerCase();

    for (const claim of prohibitedMedicalClaims) {
      expect(copyText).not.toContain(claim);
    }
  });

  it("uses custom reminder descriptions as notification messages", () => {
    const copy = createReminderNotificationCopy({
      id: "custom-123e4567-e89b-42d3-a456-426614174000",
      title: "Desk reset",
      category: "Custom",
      description: "Reset your desk and posture.",
      suggestedFrequency: "Every 25 minutes",
      enabledByDefault: true,
      wellnessIntent: "Reset your desk and posture.",
      displayPriority: 9,
      customFrequencyMinutes: 25,
    });

    expect(copy).toMatchObject({
      title: "VitaLoop: Desk reset",
      message: "Reset your desk and posture.",
      contextMessage: "Local browser reminder",
    });
  });

  it("uses the packaged extension notification icon without external assets", () => {
    expect(VITALOOP_NOTIFICATION_ICON_URL).toBe(
      "assets/app-icons/vitaloop-notification-logo.png",
    );
    expect(VITALOOP_NOTIFICATION_ICON_URL).not.toMatch(/^https?:\/\//);
  });

  it("defines the two supported notification action buttons", () => {
    expect(REMINDER_NOTIFICATION_BUTTONS).toEqual([
      { title: "Done" },
      { title: "Snooze" },
    ]);
  });
});
