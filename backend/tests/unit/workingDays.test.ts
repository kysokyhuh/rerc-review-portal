/**
 * Unit test: Working-day calculations
 * Tests the core SLA timeline math: Mon–Fri only, exclude start, include end
 */

import { workingDaysBetween } from "../../src/utils/slaUtils";

describe("workingDaysBetween", () => {
  describe("Same-day calculations", () => {
    test("Same weekday = 0 working days", () => {
      const mon = new Date("2025-12-01T00:00:00Z"); // Monday
      const result = workingDaysBetween(mon, mon);
      expect(result).toBe(0);
    });
  });

  describe("Single working day spans", () => {
    test("Mon→Tue = 1 working day", () => {
      const mon = new Date("2025-12-01T00:00:00Z"); // Monday
      const tue = new Date("2025-12-02T00:00:00Z"); // Tuesday
      const result = workingDaysBetween(mon, tue);
      expect(result).toBe(1);
    });

    test("Tue→Wed = 1 working day", () => {
      const tue = new Date("2025-12-02T00:00:00Z");
      const wed = new Date("2025-12-03T00:00:00Z");
      const result = workingDaysBetween(tue, wed);
      expect(result).toBe(1);
    });
  });

  describe("Weekend skipping", () => {
    test("Fri→Mon (weekend between) = 1 working day", () => {
      const fri = new Date("2025-12-05T00:00:00Z"); // Friday
      const mon = new Date("2025-12-08T00:00:00Z"); // Monday (3 days later)
      const result = workingDaysBetween(fri, mon);
      expect(result).toBe(1);
    });

    test("Sat→Mon (weekend included) = 0 working days", () => {
      const sat = new Date("2025-12-06T00:00:00Z"); // Saturday
      const mon = new Date("2025-12-08T00:00:00Z"); // Monday
      const result = workingDaysBetween(sat, mon);
      expect(result).toBe(0);
    });

    test("Sun→Mon = 0 working days", () => {
      const sun = new Date("2025-12-07T00:00:00Z"); // Sunday
      const mon = new Date("2025-12-08T00:00:00Z"); // Monday
      const result = workingDaysBetween(sun, mon);
      expect(result).toBe(0);
    });
  });

  describe("Full week", () => {
    test("Mon→next Mon (5 business days) = 5 working days", () => {
      const mon1 = new Date("2025-12-01T00:00:00Z"); // Monday Dec 1
      const mon2 = new Date("2025-12-08T00:00:00Z"); // Monday Dec 8 (7 calendar days)
      const result = workingDaysBetween(mon1, mon2);
      expect(result).toBe(5); // Dec 2, 3, 4, 5, 8
    });

    test("Mon→Fri (full week) = 4 working days", () => {
      const mon = new Date("2025-12-01T00:00:00Z");
      const fri = new Date("2025-12-05T00:00:00Z");
      const result = workingDaysBetween(mon, fri);
      expect(result).toBe(4); // Dec 2, 3, 4, 5
    });
  });

  describe("Edge cases", () => {
    test("Start after end date returns 0 or negative", () => {
      const tue = new Date("2025-12-02T00:00:00Z");
      const mon = new Date("2025-12-01T00:00:00Z");
      const result = workingDaysBetween(tue, mon);
      expect(result).toBeLessThanOrEqual(0);
    });
  });

  describe("Multi-week spans", () => {
    test("Mon Dec 1 → Mon Dec 22 (3 weeks)", () => {
      const start = new Date("2025-12-01T00:00:00Z"); // Mon
      const end = new Date("2025-12-22T00:00:00Z"); // Mon (21 calendar days)
      const result = workingDaysBetween(start, end);
      // Dec 2-5 (4) + Dec 8-12 (5) + Dec 15-19 (5) + Dec 22 (1) = 15 working days
      expect(result).toBe(15);
    });
  });
});
