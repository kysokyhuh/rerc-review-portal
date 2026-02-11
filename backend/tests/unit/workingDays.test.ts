import { computeWorkingDaysBetween } from "../../src/utils/workingDays";

describe("computeWorkingDaysBetween", () => {
  it("excludes weekends", () => {
    const start = new Date("2026-02-09T00:00:00.000Z"); // Monday
    const end = new Date("2026-02-16T00:00:00.000Z"); // Next Monday

    expect(computeWorkingDaysBetween(start, end)).toBe(5);
  });

  it("excludes configured holidays", () => {
    const start = new Date("2026-02-09T00:00:00.000Z");
    const end = new Date("2026-02-12T00:00:00.000Z");
    const holidays = [new Date("2026-02-10T00:00:00.000Z")];

    expect(computeWorkingDaysBetween(start, end, holidays)).toBe(2);
  });
});
