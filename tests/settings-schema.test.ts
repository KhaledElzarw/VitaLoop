import { describe, expect, it } from "vitest";
import { appSettingsSchema } from "../src/domain/schemas";
import { getDefaultAppSettings } from "../src/domain/settings";

const malformedTimeCases = [
  ["quietHoursStart", "7:00"],
  ["quietHoursEnd", "07:0"],
  ["workdayStart", "07-00"],
  ["workdayEnd", "07:000"],
] as const;

describe("app settings schema", () => {
  it("accepts valid settings", () => {
    const validSettings = getDefaultAppSettings();

    expect(appSettingsSchema.safeParse(validSettings).success).toBe(true);
  });

  it("rejects invalid quiet hours values", () => {
    const result = appSettingsSchema.safeParse({
      ...getDefaultAppSettings(),
      quietHoursStart: "25:00",
    });

    expect(result.success).toBe(false);
  });

  it.each(malformedTimeCases)(
    "rejects malformed time strings for %s",
    (fieldName, timeValue) => {
      const result = appSettingsSchema.safeParse({
        ...getDefaultAppSettings(),
        [fieldName]: timeValue,
      });

      expect(result.success).toBe(false);
    },
  );

  it("rejects invalid reminder intensity values", () => {
    const result = appSettingsSchema.safeParse({
      ...getDefaultAppSettings(),
      reminderIntensity: "clinical",
    });

    expect(result.success).toBe(false);
  });

  it("keeps at least one preferred category in default settings", () => {
    expect(
      getDefaultAppSettings().preferredReminderCategories.length,
    ).toBeGreaterThan(0);
  });
});
