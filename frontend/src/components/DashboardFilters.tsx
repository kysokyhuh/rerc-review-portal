/**
 * DashboardFilters – collapsible filter bar for the main dashboard.
 *
 * Renders inputs for college, review type, proponent, research type, and status.
 * Filter state is read from / written to URL query params so links are shareable.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

// ── Filter key definitions ──────────────────────────────────────────────────

export interface DashboardFilterValues {
  college: string;
  reviewType: string;
  proponent: string;
  researchType: string;
  status: string;
}

const EMPTY_FILTERS: DashboardFilterValues = {
  college: "",
  reviewType: "",
  proponent: "",
  researchType: "",
  status: "",
};

const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as (keyof DashboardFilterValues)[];

const REVIEW_TYPE_OPTIONS = [
  { value: "", label: "All review types" },
  { value: "EXEMPT", label: "Exempt" },
  { value: "EXPEDITED", label: "Expedited" },
  { value: "FULL_BOARD", label: "Full Board" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "RECEIVED", label: "Received" },
  { value: "UNDER_COMPLETENESS_CHECK", label: "Under Completeness Check" },
  { value: "AWAITING_CLASSIFICATION", label: "Awaiting Classification" },
  { value: "UNDER_CLASSIFICATION", label: "Under Classification" },
  { value: "CLASSIFIED", label: "Classified" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "AWAITING_REVISIONS", label: "Awaiting Revisions" },
  { value: "REVISION_SUBMITTED", label: "Revision Submitted" },
  { value: "CLOSED", label: "Closed" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

const RESEARCH_TYPE_OPTIONS = [
  { value: "", label: "All research types" },
  { value: "BIOMEDICAL", label: "Biomedical" },
  { value: "SOCIAL_BEHAVIORAL", label: "Social/Behavioral" },
  { value: "PUBLIC_HEALTH", label: "Public Health" },
  { value: "CLINICAL_TRIAL", label: "Clinical Trial" },
  { value: "EPIDEMIOLOGICAL", label: "Epidemiological" },
  { value: "OTHER", label: "Other" },
];

// ── Helper: read filters from URL ──────────────────────────────────────────

export function readFiltersFromParams(
  searchParams: URLSearchParams
): DashboardFilterValues {
  const filters = { ...EMPTY_FILTERS };
  for (const key of FILTER_KEYS) {
    const val = searchParams.get(key);
    if (val) filters[key] = val;
  }
  return filters;
}

/** Build a URLSearchParams-compatible record (omits empty values). */
export function filtersToParams(
  filters: DashboardFilterValues
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    if (filters[key]) result[key] = filters[key];
  }
  return result;
}

/** Build a query-string fragment for the API (only non-empty keys). */
export function filtersToQueryString(filters: DashboardFilterValues): string {
  const parts: string[] = [];
  for (const key of FILTER_KEYS) {
    if (filters[key]) {
      parts.push(`${key}=${encodeURIComponent(filters[key])}`);
    }
  }
  return parts.join("&");
}

export function hasActiveFilters(filters: DashboardFilterValues): boolean {
  return FILTER_KEYS.some((k) => !!filters[k]);
}

// ── Component ──────────────────────────────────────────────────────────────

interface DashboardFiltersProps {
  onChange: (filters: DashboardFilterValues) => void;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  onChange,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [expanded, setExpanded] = useState(() =>
    FILTER_KEYS.some((k) => !!searchParams.get(k))
  );
  const [filters, setFilters] = useState<DashboardFilterValues>(() =>
    readFiltersFromParams(searchParams)
  );

  // Sync URL → state on mount (only)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    onChange(filters);
  }, []); // fire once on mount

  /** Write to URL and notify parent */
  const commit = useCallback(
    (next: DashboardFilterValues) => {
      setFilters(next);
      // Preserve non-filter search params
      const newParams = new URLSearchParams(searchParams);
      for (const key of FILTER_KEYS) {
        if (next[key]) {
          newParams.set(key, next[key]);
        } else {
          newParams.delete(key);
        }
      }
      setSearchParams(newParams, { replace: true });
      onChange(next);
    },
    [searchParams, setSearchParams, onChange]
  );

  const handleChange = (key: keyof DashboardFilterValues, value: string) => {
    commit({ ...filters, [key]: value });
  };

  const handleClear = () => {
    commit({ ...EMPTY_FILTERS });
  };

  const activeCount = FILTER_KEYS.filter((k) => !!filters[k]).length;

  return (
    <div className="dashboard-filters">
      <button
        type="button"
        className="dashboard-filters-toggle"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ width: 16, height: 16 }}
        >
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
        </svg>
        Filters{activeCount > 0 && ` (${activeCount})`}
        <span className="dashboard-filters-chevron" aria-hidden="true">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="dashboard-filters-body">
          <div className="dashboard-filters-row">
            {/* College */}
            <label className="dashboard-filter-field">
              <span className="dashboard-filter-label">College</span>
              <input
                type="text"
                placeholder="e.g. CLA, COS, GCOE"
                value={filters.college}
                onChange={(e) => handleChange("college", e.target.value)}
              />
            </label>

            {/* Review Type */}
            <label className="dashboard-filter-field">
              <span className="dashboard-filter-label">Review type</span>
              <select
                value={filters.reviewType}
                onChange={(e) => handleChange("reviewType", e.target.value)}
              >
                {REVIEW_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Proponent */}
            <label className="dashboard-filter-field">
              <span className="dashboard-filter-label">Proponent / PI</span>
              <input
                type="text"
                placeholder="Name (substring)"
                value={filters.proponent}
                onChange={(e) => handleChange("proponent", e.target.value)}
              />
            </label>

            {/* Research Type */}
            <label className="dashboard-filter-field">
              <span className="dashboard-filter-label">Research type</span>
              <select
                value={filters.researchType}
                onChange={(e) => handleChange("researchType", e.target.value)}
              >
                {RESEARCH_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Status */}
            <label className="dashboard-filter-field">
              <span className="dashboard-filter-label">Status</span>
              <select
                value={filters.status}
                onChange={(e) => handleChange("status", e.target.value)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {activeCount > 0 && (
            <div className="dashboard-filters-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={handleClear}
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
