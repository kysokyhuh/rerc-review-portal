import {
  listAcademicYears,
  parseTermSelector,
  resolveAcademicTermRange,
} from "../../src/services/reports/academicTerms";

describe("academicTerms utilities", () => {
  const terms = [
    {
      academicYear: "2025-2026",
      term: 1,
      startDate: new Date("2025-06-01T00:00:00.000Z"),
      endDate: new Date("2025-09-30T00:00:00.000Z"),
    },
    {
      academicYear: "2025-2026",
      term: 2,
      startDate: new Date("2025-10-01T00:00:00.000Z"),
      endDate: new Date("2026-01-31T00:00:00.000Z"),
    },
  ];

  it("lists years grouped with sorted terms", () => {
    expect(listAcademicYears(terms)).toEqual([
      {
        academicYear: "2025-2026",
        terms: [1, 2],
      },
    ]);
  });

  it("resolves an ALL-term range", () => {
    const resolved = resolveAcademicTermRange(terms, "2025-2026", "ALL");
    expect(resolved.selectedTerms).toEqual([1, 2]);
    expect(resolved.startDate.toISOString()).toBe("2025-06-01T00:00:00.000Z");
    expect(resolved.endDate.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("resolves a specific term", () => {
    const resolved = resolveAcademicTermRange(terms, "2025-2026", 2);
    expect(resolved.selectedTerms).toEqual([2]);
    expect(resolved.startDate.toISOString()).toBe("2025-10-01T00:00:00.000Z");
    expect(resolved.endDate.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("parses term selector values", () => {
    expect(parseTermSelector("ALL")).toBe("ALL");
    expect(parseTermSelector("2")).toBe(2);
  });
});
