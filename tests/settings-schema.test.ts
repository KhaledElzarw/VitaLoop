import { describe, expect, it } from "vitest";
import { appSettingsSchema } from "../src/domain/schemas";

const validSettings = {
  quietHours: {
    enabled: true,
    start: "21:30",
    end: "07:00",
  },
  workdayWindow: {
    start: "08:30",
    end: "18:00",
  },
  reminderIntensity: "balanced",
  enabledReminderIds: ["hydration", "eye-strain", "stretch"],
};

describe("app settings schema", () => {
  it("accepts valid settings", () => {
    expect(appSettingsSchema.safeParse(validSettings).success).toBe(true);
  });

  it("rejects invalid settings", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      quietHours: {
        enabled: true,
        start: "25:00",
        end: "07:00",
      },
      reminderIntensity: "clinical",
    });

    expect(result.success).toBe(false);
  });
});
