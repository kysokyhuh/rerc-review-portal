import { useMemo, useState } from "react";
import type { ReportsAcademicYearOption, CommitteeSummary } from "@/types";

export type ReportsDraftFilters = {
  periodMode: "ACADEMIC" | "CUSTOM";
  ay: string;
  term: "ALL" | number;
  startDate: string;
  endDate: string;
  committee: string;
  college: string;
  category: "ALL" | "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING";
  reviewType: "ALL" | "EXEMPT" | "EXPEDITED" | "FULL_BOARD" | "UNCLASSIFIED" | "WITHDRAWN";
  compareMode: "NONE" | "PRIOR_EQUIVALENT" | "CUSTOM";
  compareStartDate: string;
  compareEndDate: string;
  status: string;
  q: string;
};

const TERM_OPTIONS: Array<{ label: string; value: "ALL" | number }> = [
  { label: "All Terms", value: "ALL" },
  { label: "Term 1", value: 1 },
  { label: "Term 2", value: 2 },
  { label: "Term 3", value: 3 },
];

const CATEGORY_LABELS: Record<ReportsDraftFilters["category"], string> = {
  ALL: "All categories",
  UNDERGRAD: "Undergraduate",
  GRAD: "Graduate",
  FACULTY: "Faculty",
  NON_TEACHING: "Non-teaching / Staff",
};

const REVIEW_TYPE_LABELS: Record<ReportsDraftFilters["reviewType"], string> = {
  ALL: "All review paths",
  EXEMPT: "Exempt",
  EXPEDITED: "Expedited",
  FULL_BOARD: "Full review",
  UNCLASSIFIED: "Unclassified",
  WITHDRAWN: "Withdrawn",
};

type ReportFiltersBarProps = {
  years: ReportsAcademicYearOption[];
  committees: CommitteeSummary[];
  filters: ReportsDraftFilters;
  defaults: ReportsDraftFilters;
  availableTermValues: Set<number>;
  loading: boolean;
  selectionSummary: string;
  onChange: (key: keyof ReportsDraftFilters, value: string | number) => void;
  onApply: (nextFilters?: ReportsDraftFilters) => void;
  onReset: () => void;
};

export default function ReportFiltersBar({
  years,
  committees,
  filters,
  defaults,
  availableTermValues,
  loading,
  selectionSummary: _selectionSummary,
  onChange,
  onApply,
  onReset,
}: ReportFiltersBarProps) {
  void _selectionSummary;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isCustomPeriod = filters.periodMode === "CUSTOM";
  const compareRequiresDates = filters.compareMode === "CUSTOM";
  const hasInvalidPrimaryRange =
    isCustomPeriod &&
    (!filters.startDate || !filters.endDate || filters.endDate < filters.startDate);
  const hasInvalidCompareRange =
    compareRequiresDates &&
    (!filters.compareStartDate ||
      !filters.compareEndDate ||
      filters.compareEndDate < filters.compareStartDate);
  const canApply = !loading && !hasInvalidPrimaryRange && !hasInvalidCompareRange;

  const committeeLabelMap = useMemo(
    () =>
      new Map(
        committees.map((committee) => [
          committee.code,
          `${committee.code} · ${committee.name}`,
        ] as const)
      ),
    [committees]
  );

  const activeChips = useMemo(() => {
    const chips: Array<{
      key: keyof ReportsDraftFilters;
      label: string;
      value: string;
      resetValue: string | number;
    }> = [];

    if (filters.periodMode !== defaults.periodMode) {
      chips.push({
        key: "periodMode",
        label: "Period type",
        value: filters.periodMode === "ACADEMIC" ? "Academic year" : "Custom range",
        resetValue: defaults.periodMode,
      });
    }

    if (filters.periodMode === "ACADEMIC" && filters.ay !== defaults.ay) {
      chips.push({
        key: "ay",
        label: "Academic year",
        value: filters.ay,
        resetValue: defaults.ay,
      });
    }

    if (filters.periodMode === "ACADEMIC" && filters.term !== defaults.term) {
      chips.push({
        key: "term",
        label: "Term",
        value: filters.term === "ALL" ? "All terms" : `Term ${filters.term}`,
        resetValue: defaults.term,
      });
    }

    if (filters.periodMode === "CUSTOM" && filters.startDate) {
      chips.push({
        key: "startDate",
        label: "Start date",
        value: filters.startDate,
        resetValue: "",
      });
    }

    if (filters.periodMode === "CUSTOM" && filters.endDate) {
      chips.push({
        key: "endDate",
        label: "End date",
        value: filters.endDate,
        resetValue: "",
      });
    }

    if (filters.committee !== defaults.committee) {
      chips.push({
        key: "committee",
        label: "Committee",
        value: committeeLabelMap.get(filters.committee) ?? filters.committee,
        resetValue: defaults.committee,
      });
    }

    if (filters.category !== defaults.category) {
      chips.push({
        key: "category",
        label: "Category",
        value: CATEGORY_LABELS[filters.category],
        resetValue: defaults.category,
      });
    }

    if (filters.reviewType !== defaults.reviewType) {
      chips.push({
        key: "reviewType",
        label: "Review path",
        value: REVIEW_TYPE_LABELS[filters.reviewType],
        resetValue: defaults.reviewType,
      });
    }

    if (filters.compareMode !== defaults.compareMode) {
      chips.push({
        key: "compareMode",
        label: "Comparison",
        value:
          filters.compareMode === "PRIOR_EQUIVALENT"
            ? "Prior equivalent period"
            : filters.compareMode === "CUSTOM"
            ? "Custom comparison"
            : "None",
        resetValue: defaults.compareMode,
      });
    }

    if (filters.compareStartDate) {
      chips.push({
        key: "compareStartDate",
        label: "Compare start",
        value: filters.compareStartDate,
        resetValue: "",
      });
    }

    if (filters.compareEndDate) {
      chips.push({
        key: "compareEndDate",
        label: "Compare end",
        value: filters.compareEndDate,
        resetValue: "",
      });
    }

    if (filters.q.trim()) {
      chips.push({
        key: "q",
        label: "Search",
        value: filters.q.trim(),
        resetValue: "",
      });
    }

    return chips;
  }, [
    committeeLabelMap,
    defaults.ay,
    defaults.category,
    defaults.committee,
    defaults.compareMode,
    defaults.periodMode,
    defaults.reviewType,
    defaults.term,
    filters,
  ]);

  const advancedActive =
    filters.committee !== defaults.committee ||
    filters.category !== defaults.category ||
    filters.reviewType !== defaults.reviewType ||
    filters.compareMode !== defaults.compareMode ||
    !!filters.compareStartDate ||
    !!filters.compareEndDate;

  return (
    <section className="report-filters-sticky" aria-label="Report filters">
      <div className="report-filters-header">
        <div>
          <p className="report-filters-kicker">Filter scope</p>
          <h2>Start with the essentials, then refine only if needed.</h2>
        </div>
        <div className="report-filter-actions">
          <button
            type="button"
            className={`report-btn-toggle ${showAdvanced || advancedActive ? "active" : ""}`}
            onClick={() => setShowAdvanced((prev) => !prev)}
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? "Hide advanced filters" : "Show advanced filters"}
          </button>
          <button
            type="button"
            className="report-btn-primary"
            onClick={() => onApply()}
            disabled={!canApply}
          >
            {loading ? "Applying..." : "Apply"}
          </button>
          <button type="button" className="report-btn-secondary" onClick={onReset} disabled={loading}>
            Reset
          </button>
        </div>
      </div>

      <div className="report-filters-grid report-filters-grid-primary">
        <label>
          Period type
          <select
            value={filters.periodMode}
            onChange={(event) => onChange("periodMode", event.target.value)}
          >
            <option value="ACADEMIC">Academic year</option>
            <option value="CUSTOM">Custom date range</option>
          </select>
        </label>

        {isCustomPeriod ? (
          <>
            <label>
              Start date
              <input
                type="date"
                value={filters.startDate}
                onChange={(event) => onChange("startDate", event.target.value)}
              />
            </label>

            <label>
              End date
              <input
                type="date"
                value={filters.endDate}
                onChange={(event) => onChange("endDate", event.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Academic year
              <select
                value={filters.ay}
                onChange={(event) => onChange("ay", event.target.value)}
              >
                <option value="ALL">All academic years</option>
                {years.map((item) => (
                  <option key={item.academicYear} value={item.academicYear}>
                    {item.academicYear}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Term
              <select
                value={String(filters.term)}
                onChange={(event) =>
                  onChange("term", event.target.value === "ALL" ? "ALL" : Number(event.target.value))
                }
              >
                {TERM_OPTIONS.map((option) => (
                  <option
                    key={String(option.value)}
                    value={String(option.value)}
                    disabled={
                      option.value !== "ALL" && !availableTermValues.has(option.value as number)
                    }
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <label className="report-filter-search">
          Search
          <input
            value={filters.q}
            onChange={(event) => onChange("q", event.target.value)}
            placeholder="Project code, title, or principal investigator"
          />
        </label>
      </div>

      {showAdvanced ? (
        <div className="report-filters-grid report-filters-grid-advanced">
          <label>
            Committee
            <select
              value={filters.committee}
              onChange={(event) => onChange("committee", event.target.value)}
            >
              <option value="ALL">All committees</option>
              {committees.map((committee) => (
                <option key={committee.id} value={committee.code}>
                  {committee.code} · {committee.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Proponent category
            <select
              value={filters.category}
              onChange={(event) => onChange("category", event.target.value)}
            >
              <option value="ALL">All categories</option>
              <option value="UNDERGRAD">Undergraduate</option>
              <option value="GRAD">Graduate</option>
              <option value="FACULTY">Faculty</option>
              <option value="NON_TEACHING">Non-teaching / Staff</option>
            </select>
          </label>

          <label>
            Review path
            <select
              value={filters.reviewType}
              onChange={(event) => onChange("reviewType", event.target.value)}
            >
              <option value="ALL">All review paths</option>
              <option value="EXEMPT">Exempt</option>
              <option value="EXPEDITED">Expedited</option>
              <option value="FULL_BOARD">Full review</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
          </label>

          <label>
            Compare to
            <select
              value={filters.compareMode}
              onChange={(event) => onChange("compareMode", event.target.value)}
            >
              <option value="NONE">No comparison</option>
              <option
                value="PRIOR_EQUIVALENT"
                disabled={!isCustomPeriod && filters.ay === "ALL"}
              >
                {isCustomPeriod ? "Same dates last year" : "Prior equivalent period"}
              </option>
              <option value="CUSTOM">Custom comparison range</option>
            </select>
          </label>

          {compareRequiresDates ? (
            <>
              <label>
                Compare start
                <input
                  type="date"
                  value={filters.compareStartDate}
                  onChange={(event) => onChange("compareStartDate", event.target.value)}
                />
              </label>

              <label>
                Compare end
                <input
                  type="date"
                  value={filters.compareEndDate}
                  onChange={(event) => onChange("compareEndDate", event.target.value)}
                />
              </label>
            </>
          ) : null}
        </div>
      ) : null}

      {hasInvalidPrimaryRange ? (
        <p className="report-filters-note">
          Enter a valid start and end date before applying a custom range.
        </p>
      ) : null}

      {hasInvalidCompareRange ? (
        <p className="report-filters-note">
          Enter a valid comparison start and end date before applying the custom comparison.
        </p>
      ) : null}

      {activeChips.length ? (
        <div className="report-filter-chip-row" aria-label="Active filters">
          {activeChips.map((chip) => (
            <button
              key={`${chip.key}-${chip.value}`}
              type="button"
              className="report-filter-chip"
              onClick={() =>
                onApply({
                  ...filters,
                  [chip.key]: chip.resetValue,
                } as ReportsDraftFilters)
              }
            >
              <span>{chip.label}</span>
              <strong>{chip.value}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
