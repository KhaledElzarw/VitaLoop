import { describe, expect, it } from "vitest";
import {
  CUSTOM_REMINDER_CATEGORY_MAX_LENGTH,
  CUSTOM_REMINDER_MESSAGE_MAX_LENGTH,
  CUSTOM_REMINDER_TITLE_MAX_LENGTH,
  defaultCustomReminderDraft,
  validateCustomReminderDraft,
} from "../src/domain/customReminders";

describe("custom reminder draft validation", () => {
  it("rejects blank title and message fields", () => {
    const result = validateCustomReminderDraft({
      ...defaultCustomReminderDraft,
      title: " ",
      description: " ",
    });

    expect(result.success).toBe(false);
    expect(result.errors).toMatchObject({
      title: "Enter a title.",
      description: "Enter a message.",
    });
  });

  it.each([Number.NaN, 4, 4.5, 1441])(
    "rejects invalid frequency %s",
    (frequencyMinutes) => {
      const result = validateCustomReminderDraft({
        ...defaultCustomReminderDraft,
        title: "Desk reset",
        description: "Reset your desk and posture.",
        frequencyMinutes,
      });

      expect(result.success).toBe(false);
      expect(result.errors.frequencyMinutes).toBe(
        "Use a whole number from 5 to 1440.",
      );
    },
  );

  it("rejects over-limit title, message, and category text", () => {
    const result = validateCustomReminderDraft({
      ...defaultCustomReminderDraft,
      title: "T".repeat(CUSTOM_REMINDER_TITLE_MAX_LENGTH + 1),
      description: "M".repeat(CUSTOM_REMINDER_MESSAGE_MAX_LENGTH + 1),
      category: "C".repeat(CUSTOM_REMINDER_CATEGORY_MAX_LENGTH + 1),
    });

    expect(result.success).toBe(false);
    expect(result.errors).toMatchObject({
      title: `Keep the title to ${CUSTOM_REMINDER_TITLE_MAX_LENGTH} characters or fewer.`,
      description: `Keep the message to ${CUSTOM_REMINDER_MESSAGE_MAX_LENGTH} characters or fewer.`,
      category: `Keep the category to ${CUSTOM_REMINDER_CATEGORY_MAX_LENGTH} characters or fewer.`,
    });
  });

  it("returns a trimmed normalized draft for valid input", () => {
    const result = validateCustomReminderDraft({
      ...defaultCustomReminderDraft,
      title: "  Desk reset  ",
      description: "  Reset your desk and posture.  ",
      category: "  Office  ",
      frequencyMinutes: 25,
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected valid custom reminder draft.");
    }

    expect(result.draft).toMatchObject({
      title: "Desk reset",
      description: "Reset your desk and posture.",
      category: "Office",
      frequencyMinutes: 25,
    });
  });
});
