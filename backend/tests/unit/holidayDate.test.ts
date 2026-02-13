import {
  normalizeHolidayName,
  parseHolidayDateInput,
  toUtcStartOfDay,
} from "../../src/utils/holidayDate";

describe("holidayDate utils", () => {
  it("parses YYYY-MM-DD into UTC midnight", () => {
    const parsed = parseHolidayDateInput("2026-12-25");
    expect(parsed).toBeTruthy();
    expect(parsed?.toISOString()).toBe("2026-12-25T00:00:00.000Z");
  });

  it("rejects invalid calendar date", () => {
    const parsed = parseHolidayDateInput("2026-02-30");
    expect(parsed).toBeNull();
  });

  it("normalizes datetime input to UTC day start", () => {
    const parsed = parseHolidayDateInput("2026-12-25T14:30:00.000Z");
    expect(parsed?.toISOString()).toBe("2026-12-25T00:00:00.000Z");
  });

  it("normalizes holiday names", () => {
    expect(normalizeHolidayName("  New Year  ")).toBe("New Year");
    expect(normalizeHolidayName("   ")).toBeNull();
  });

  it("converts arbitrary date to UTC day start", () => {
    const value = new Date("2026-06-15T23:59:59.999Z");
    expect(toUtcStartOfDay(value).toISOString()).toBe("2026-06-15T00:00:00.000Z");
  });
});
