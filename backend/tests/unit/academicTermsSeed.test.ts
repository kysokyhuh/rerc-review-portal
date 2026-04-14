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
