/**
 * Shared Prisma "where" builder for dashboard filter query params.
 *
 * Used by the queues, overdue, and due-soon endpoints so every dashboard
 * view applies the same filter semantics consistently.
 *
 * All filters are optional — callers that pass no params get the same
 * unfiltered results as before.
 */

export interface DashboardFilterParams {
  /** Exact match on Project.piAffiliation (college) */
  college?: string;
  /** Enum match on Classification.reviewType (EXEMPT | EXPEDITED | FULL_BOARD) */
  reviewType?: string;
  /** Case-insensitive substring on Project.piName */
  proponent?: string;
  /** Enum match on Project.researchTypePHREB */
  researchType?: string;
  /** Enum match on Submission.status */
  status?: string;
}

/**
 * Extract filter params from an Express-style query object.
 */
export function parseDashboardFilterParams(
  query: Record<string, unknown>
): DashboardFilterParams {
  const str = (key: string): string | undefined => {
    const v = query[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    return undefined;
  };

  return {
    college: str("college"),
    reviewType: str("reviewType"),
    proponent: str("proponent"),
    researchType: str("researchType"),
    status: str("status"),
  };
}

/**
 * Build a Prisma "where" fragment for Submission queries that filters by
 * the dashboard parameters.
 *
 * The returned object is designed to be spread into a `prisma.submission.findMany`
 * where clause that already has a project→committee condition.
 *
 * @example
 * const filters = parseDashboardFilterParams(req.query);
 * const where = buildDashboardFiltersWhere(filters);
 * prisma.submission.findMany({ where: { ...baseWhere, ...where } });
 */
export function buildDashboardFiltersWhere(params: DashboardFilterParams) {
  const where: Record<string, unknown> = {};
  const projectConditions: Record<string, unknown> = {};

  // college → case-insensitive match on project.piAffiliation
  if (params.college) {
    projectConditions.piAffiliation = {
      equals: params.college,
      mode: "insensitive",
    };
  }

  // proponent → case-insensitive substring on project.piName
  if (params.proponent) {
    projectConditions.piName = {
      contains: params.proponent,
      mode: "insensitive",
    };
  }

  // researchType → enum match on project.researchTypePHREB
  if (params.researchType) {
    projectConditions.researchTypePHREB = params.researchType;
  }

  if (Object.keys(projectConditions).length > 0) {
    where.project = projectConditions;
  }

  // reviewType → enum match on classification.reviewType
  if (params.reviewType) {
    where.classification = { reviewType: params.reviewType };
  }

  // status → enum match on submission.status
  if (params.status) {
    where.status = params.status;
  }

  return where;
}

/**
 * Deep-merge a base where clause with the dashboard filters.
 *
 * Handles the common case where base already has `project: { committee: ... }`
 * and filters add more `project` conditions.
 */
export function mergeDashboardWhere(
  base: Record<string, any>,
  filters: Record<string, any>
): Record<string, any> {
  const merged = { ...base };

  for (const [key, value] of Object.entries(filters)) {
    if (key === "project" && merged.project) {
      // Merge project sub-conditions
      merged.project = { ...merged.project, ...value };
    } else {
      merged[key] = value;
    }
  }

  return merged;
}
