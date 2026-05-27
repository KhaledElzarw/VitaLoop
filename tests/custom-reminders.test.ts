import { describe, expect, it } from "vitest";
import {
  CUSTOM_REMINDER_CATEGORY_MAX_LENGTH,
  CUSTOM_REMINDER_EMOJI_OPTIONS,
  CUSTOM_REMINDER_MESSAGE_MAX_LENGTH,
  CUSTOM_REMINDER_TITLE_MAX_LENGTH,
  createDefaultCustomReminderSchedule,
  customReminderRecommendations,
  DEFAULT_CUSTOM_REMINDER_EMOJI,
  defaultCustomReminderDraft,
  formatCustomReminderTitleWithEmoji,
  formatCustomReminderSchedule,
  getCustomReminderCharacterLimitStatus,
  getCustomReminderTitleEmoji,
  getRecommendedCustomReminders,
  stripCustomReminderTitleEmoji,
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
    (intervalMinutes) => {
      const result = validateCustomReminderDraft({
        ...defaultCustomReminderDraft,
        title: "Desk reset",
        description: "Reset your desk and posture.",
        schedule: {
          type: "interval",
          intervalMinutes,
        },
      });

      expect(result.success).toBe(false);
      expect(result.errors.intervalMinutes).toBe(
        "Use a whole number from 5 to 1440.",
      );
    },
  );

  it("validates daily, weekday, and one-time recurrence inputs", () => {
    expect(
      validateCustomReminderDraft({
        ...defaultCustomReminderDraft,
        title: "Plan",
        description: "Plan the next day.",
        schedule: {
          type: "dailyInterval",
          dayIntervalDays: 0,
          timeOfDay: "09:00",
          startDate: "2026-01-01",
        },
      }).errors.dayIntervalDays,
    ).toBe("Use a whole number from 1 to 365.");

    expect(
      validateCustomReminderDraft({
        ...defaultCustomReminderDraft,
        title: "Trash",
        description: "Take out the trash.",
        schedule: {
          type: "weekdayInterval",
          weekdays: [],
          timeOfDay: "09:00",
        },
      }).errors.weekdays,
    ).toBe("Choose at least one weekday.");

    expect(
      validateCustomReminderDraft(
        {
          ...defaultCustomReminderDraft,
          title: "Appointment",
          description: "Prepare for the appointment.",
          schedule: {
            type: "oneTime",
            date: "2026-01-01",
            timeOfDay: "09:00",
          },
        },
        new Date(2026, 0, 1, 10, 0),
      ).errors.date,
    ).toBe("Choose a future date and time.");
  });

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

  it("shows character limit status only near the limit", () => {
    expect(getCustomReminderCharacterLimitStatus("A".repeat(32), 48)).toBeNull();
    expect(getCustomReminderCharacterLimitStatus("A".repeat(33), 48)).toEqual({
      message: "Maximum limit of characters is 33/48",
      tone: "warning",
    });
    expect(getCustomReminderCharacterLimitStatus("A".repeat(38), 48)).toEqual({
      message: "Maximum limit of characters is 38/48",
      tone: "near-limit",
    });
  });

  it("formats custom reminder titles with a selected emoji prefix", () => {
    expect(CUSTOM_REMINDER_EMOJI_OPTIONS).toContain(
      DEFAULT_CUSTOM_REMINDER_EMOJI,
    );
    expect(formatCustomReminderTitleWithEmoji("🛒", "Grocery list")).toBe(
      "🛒 Grocery list",
    );
    expect(formatCustomReminderTitleWithEmoji("🛒", "📝 Grocery list")).toBe(
      "🛒 Grocery list",
    );
    expect(formatCustomReminderTitleWithEmoji("not-an-emoji", "Plan")).toBe(
      `${DEFAULT_CUSTOM_REMINDER_EMOJI} Plan`,
    );
    expect(formatCustomReminderTitleWithEmoji("🛒", " ")).toBe("");
    expect(stripCustomReminderTitleEmoji("🛒 Grocery list")).toBe(
      "Grocery list",
    );
    expect(getCustomReminderTitleEmoji("🛒 Grocery list")).toBe("🛒");
    expect(getCustomReminderTitleEmoji("Grocery list")).toBe(
      DEFAULT_CUSTOM_REMINDER_EMOJI,
    );
  });

  it("returns a trimmed normalized draft for valid input", () => {
    const result = validateCustomReminderDraft({
      ...defaultCustomReminderDraft,
      title: "  Desk reset  ",
      description: "  Reset your desk and posture.  ",
      category: "  Office  ",
      schedule: {
        type: "interval",
        intervalMinutes: 25,
      },
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected valid custom reminder draft.");
    }

    expect(result.draft).toMatchObject({
      title: "Desk reset",
      description: "Reset your desk and posture.",
      category: "Office",
      schedule: {
        type: "interval",
        intervalMinutes: 25,
      },
    });
  });

  it("stores exactly 20 mixed recommendations and selects three with one top-ten item", () => {
    const recommendations = getRecommendedCustomReminders(() => 0.1);
    const excludedRecommendationTerms =
      /hydration|eye strain|eye rest|stretch|stand|walk|posture|breath|sleep|mood|energy|water break/i;

    expect(customReminderRecommendations).toHaveLength(20);
    expect(
      customReminderRecommendations.some((recommendation) =>
        excludedRecommendationTerms.test(
          `${recommendation.id} ${recommendation.title} ${recommendation.description}`,
        ),
      ),
    ).toBe(false);
    expect(recommendations).toHaveLength(3);
    expect(new Set(recommendations.map((item) => item.id)).size).toBe(3);
    expect(recommendations.some((item) => item.priority <= 10)).toBe(true);
  });

  it("defaults weekday custom recurrence to Monday through Friday", () => {
    expect(createDefaultCustomReminderSchedule("weekdayInterval")).toMatchObject({
      type: "weekdayInterval",
      weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    });
  });

  it("formats custom reminder schedules", () => {
    expect(
      formatCustomReminderSchedule({
        type: "weekdayInterval",
        weekdays: ["monday", "wednesday"],
        timeOfDay: "08:30",
      }),
    ).toBe("Monday and Wednesday at 8:30 AM");
  });
});
