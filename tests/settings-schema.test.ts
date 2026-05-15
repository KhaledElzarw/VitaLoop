import { describe, expect, it } from "vitest";
import { appSettingsSchema } from "../src/domain/schemas";
import { getDefaultAppSettings } from "../src/domain/settings";

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

  it("rejects invalid reminder intensity values", () => {
    const result = appSettingsSchema.safeParse({
      ...getDefaultAppSettings(),
      reminderIntensity: "clinical",
    });

    expect(result.success).toBe(false);
  });
});
