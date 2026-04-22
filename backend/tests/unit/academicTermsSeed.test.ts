import {
  buildAcademicTermSeedRecords,
  seedAcademicTerms,
} from "../../src/config/academicTermsSeed";

describe("academic term seed helper", () => {
  it("builds five academic years of term rows from the reference date", () => {
    const result = buildAcademicTermSeedRecords(
      new Date("2026-04-13T00:00:00.000Z")
    );

    expect(result.firstStartYear).toBe(2022);
    expect(result.startYear).toBe(2026);
    expect(result.terms).toHaveLength(15);
    expect(result.terms[0]).toMatchObject({
      academicYear: "2022-2023",
      term: 2,
      startDate: new Date("2022-01-01T00:00:00.000Z"),
      endDate: new Date("2022-04-30T00:00:00.000Z"),
    });
    expect(result.terms[result.terms.length - 1]).toMatchObject({
      academicYear: "2026-2027",
      term: 1,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
    });
  });

  it("uses custom term dates for 2023-2024 and 2024-2025", () => {
    const result = buildAcademicTermSeedRecords(
      new Date("2026-04-13T00:00:00.000Z")
    );

    expect(result.terms).toEqual(
      expect.arrayContaining([
        {
          academicYear: "2023-2024",
          term: 1,
          startDate: new Date("2023-09-24T00:00:00.000Z"),
          endDate: new Date("2023-12-11T00:00:00.000Z"),
        },
        {
          academicYear: "2023-2024",
          term: 2,
          startDate: new Date("2024-01-08T00:00:00.000Z"),
          endDate: new Date("2024-04-16T00:00:00.000Z"),
        },
        {
          academicYear: "2023-2024",
          term: 3,
          startDate: new Date("2024-05-02T00:00:00.000Z"),
          endDate: new Date("2024-08-09T00:00:00.000Z"),
        },
        {
          academicYear: "2024-2025",
          term: 1,
          startDate: new Date("2024-09-02T00:00:00.000Z"),
          endDate: new Date("2024-12-09T00:00:00.000Z"),
        },
        {
          academicYear: "2024-2025",
          term: 2,
          startDate: new Date("2025-01-06T00:00:00.000Z"),
          endDate: new Date("2025-04-12T00:00:00.000Z"),
        },
        {
          academicYear: "2024-2025",
          term: 3,
          startDate: new Date("2025-05-05T00:00:00.000Z"),
          endDate: new Date("2025-08-13T00:00:00.000Z"),
        },
      ])
    );
  });

  it("upserts every generated term row", async () => {
    const upsert = jest.fn().mockResolvedValue(null);

    const result = await seedAcademicTerms(
      {
        academicTerm: {
          upsert,
        },
      } as any,
      new Date("2026-04-13T00:00:00.000Z")
    );

    expect(result.termCount).toBe(15);
    expect(upsert).toHaveBeenCalledTimes(15);
    expect(upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          academicYear_term: {
            academicYear: "2022-2023",
            term: 2,
          },
        },
      })
    );
    expect(upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          academicYear_term: {
            academicYear: "2026-2027",
            term: 1,
          },
        },
      })
    );
  });
});
