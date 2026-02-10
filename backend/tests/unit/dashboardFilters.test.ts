import {
  buildDashboardFiltersWhere,
  parseDashboardFilterParams,
  mergeDashboardWhere,
} from "../../src/utils/dashboardFilters";

describe("parseDashboardFilterParams", () => {
  it("extracts known filter params", () => {
    const result = parseDashboardFilterParams({
      college: "CCS",
      proponent: "John",
      researchType: "BIOMEDICAL",
      reviewType: "EXEMPT",
      status: "UNDER_REVIEW",
      page: "1", // unknown — ignored
    });
    expect(result).toEqual({
      college: "CCS",
      proponent: "John",
      researchType: "BIOMEDICAL",
      reviewType: "EXEMPT",
      status: "UNDER_REVIEW",
    });
  });

  it("returns empty object when no filter params", () => {
    const result = parseDashboardFilterParams({ committeeCode: "RERC-HUMAN" });
    expect(result).toEqual({});
  });
});

describe("buildDashboardFiltersWhere", () => {
  it("builds project-level filters for college", () => {
    const where = buildDashboardFiltersWhere({ college: "CLA" });
    expect(where).toEqual({
      project: { piAffiliation: "CLA" },
    });
  });

  it("builds case-insensitive proponent filter", () => {
    const where = buildDashboardFiltersWhere({ proponent: "Maria" });
    expect(where).toEqual({
      project: {
        piName: { contains: "Maria", mode: "insensitive" },
      },
    });
  });

  it("builds research type filter", () => {
    const where = buildDashboardFiltersWhere({ researchType: "PUBLIC_HEALTH" });
    expect(where).toEqual({
      project: { researchTypePHREB: "PUBLIC_HEALTH" },
    });
  });

  it("builds classification-level review type filter", () => {
    const where = buildDashboardFiltersWhere({ reviewType: "FULL_BOARD" });
    expect(where).toEqual({
      classification: { reviewType: "FULL_BOARD" },
    });
  });

  it("builds submission-level status filter", () => {
    const where = buildDashboardFiltersWhere({ status: "UNDER_REVIEW" });
    expect(where).toEqual({
      status: "UNDER_REVIEW",
    });
  });

  it("combines multiple filters", () => {
    const where = buildDashboardFiltersWhere({
      college: "COS",
      reviewType: "EXPEDITED",
      status: "RECEIVED",
    });
    expect(where).toEqual({
      project: { piAffiliation: "COS" },
      classification: { reviewType: "EXPEDITED" },
      status: "RECEIVED",
    });
  });

  it("returns empty object when no params", () => {
    const where = buildDashboardFiltersWhere({});
    expect(where).toEqual({});
  });
});

describe("mergeDashboardWhere", () => {
  it("deep-merges project conditions", () => {
    const base = { project: { committee: { code: "RERC-HUMAN" } } };
    const filters = { project: { piAffiliation: "CCS" } };
    const merged = mergeDashboardWhere(base, filters);
    expect(merged.project.committee).toEqual({ code: "RERC-HUMAN" });
    expect(merged.project.piAffiliation).toBe("CCS");
  });

  it("returns base when filters are empty", () => {
    const base = { status: "RECEIVED", project: { committee: { code: "X" } } };
    const merged = mergeDashboardWhere(base, {});
    expect(merged).toEqual(base);
  });

  it("adds classification filter to base", () => {
    const base = { project: { committee: { code: "RERC-HUMAN" } } };
    const filters = { classification: { reviewType: "EXEMPT" } };
    const merged = mergeDashboardWhere(base, filters);
    expect(merged.classification).toEqual({ reviewType: "EXEMPT" });
    expect(merged.project).toEqual({ committee: { code: "RERC-HUMAN" } });
  });
});
