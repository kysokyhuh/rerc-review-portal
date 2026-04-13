import {
  buildAcademicTermSeedRecords,
  seedAcademicTerms,
} from "../../src/config/academicTermsSeed";

describe("academic term seed helper", () => {
  it("builds five academic years of term rows from the reference date", () => {
    const result = buildAcademicTermSeedRecords(
      new Date("2026-04-13T00:00:00.000Z")
    );

    expect(result.firstStartYear).toBe(2021);
    expect(result.startYear).toBe(2025);
    expect(result.terms).toHaveLength(15);
    expect(result.terms[0]).toMatchObject({
      academicYear: "2021-2022",
      term: 1,
      startDate: new Date("2021-09-01T00:00:00.000Z"),
      endDate: new Date("2021-12-31T00:00:00.000Z"),
    });
    expect(result.terms[result.terms.length - 1]).toMatchObject({
      academicYear: "2025-2026",
      term: 3,
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-08-31T00:00:00.000Z"),
    });
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
            academicYear: "2021-2022",
            term: 1,
          },
        },
      })
    );
    expect(upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          academicYear_term: {
            academicYear: "2025-2026",
            term: 3,
          },
        },
      })
    );
  });
});
