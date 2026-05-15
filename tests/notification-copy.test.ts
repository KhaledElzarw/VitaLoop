import { describe, expect, it } from "vitest";
import { reminders } from "../src/data/reminders";
import {
  createReminderNotificationCopy,
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

  it("uses an inline extension notification icon without external assets", () => {
    expect(VITALOOP_NOTIFICATION_ICON_URL).toMatch(
      /^data:image\/svg\+xml;charset=UTF-8,/,
    );
  });
});
