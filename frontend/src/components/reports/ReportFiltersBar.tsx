import type { ReportsAcademicYearOption, CommitteeSummary } from "@/types";

export type ReportsDraftFilters = {
  ay: string;
  term: "ALL" | number;
  committee: string;
  college: string;
  category: "ALL" | "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING";
  reviewType: "ALL" | "EXEMPT" | "EXPEDITED" | "FULL_BOARD" | "UNCLASSIFIED" | "WITHDRAWN";
  status: string;
  q: string;
};

const TERM_OPTIONS: Array<{ label: string; value: "ALL" | number }> = [
  { label: "All Terms", value: "ALL" },
  { label: "Term 1", value: 1 },
  { label: "Term 2", value: 2 },
  { label: "Term 3", value: 3 },
];

type ReportFiltersBarProps = {
  years: ReportsAcademicYearOption[];
  committees: CommitteeSummary[];
  filters: ReportsDraftFilters;
  availableTermValues: Set<number>;
  loading: boolean;
  selectionSummary: string;
  onChange: (key: keyof ReportsDraftFilters, value: string | number) => void;
  onApply: () => void;
  onReset: () => void;
};

export default function ReportFiltersBar({
  years,
  committees,
  filters,
  availableTermValues,
  loading,
  selectionSummary,
  onChange,
  onApply,
  onReset,
}: ReportFiltersBarProps) {
  const visibleYears = years.slice(0, 5);

  return (
    <section className="report-filters-sticky" aria-label="Report filters">
      <div className="report-filters-grid">
        <label>
          Academic Year
          <select
            value={filters.ay}
            onChange={(event) => onChange("ay", event.target.value)}
          >
            <option value="ALL">All Academic Years</option>
            {visibleYears.map((item) => (
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
                disabled={option.value !== "ALL" && !availableTermValues.has(option.value as number)}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Committee
          <select
            value={filters.committee}
            onChange={(event) => onChange("committee", event.target.value)}
          >
            <option value="ALL">ALL</option>
            {committees.map((committee) => (
              <option key={committee.id} value={committee.code}>
                {committee.code} - {committee.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Proponent Category
          <select
            value={filters.category}
            onChange={(event) => onChange("category", event.target.value)}
          >
            <option value="ALL">ALL</option>
            <option value="UNDERGRAD">UNDERGRADUATE</option>
            <option value="GRAD">GRADUATE</option>
            <option value="FACULTY">FACULTY</option>
            <option value="NON_TEACHING">NON-TEACHING/STAFF</option>
          </select>
        </label>

        <label>
          Type of Review
          <select
            value={filters.reviewType}
            onChange={(event) => onChange("reviewType", event.target.value)}
          >
            <option value="ALL">ALL</option>
            <option value="EXEMPT">EXEMPT</option>
            <option value="EXPEDITED">EXPEDITED</option>
            <option value="FULL_BOARD">FULL_BOARD</option>
            <option value="WITHDRAWN">WITHDRAWN</option>
          </select>
        </label>

        <label>
          Search
          <input
            value={filters.q}
            onChange={(event) => onChange("q", event.target.value)}
            placeholder="Project code, title, proponent..."
          />
        </label>

        <div className="report-filter-actions">
          <button type="button" className="btn-primary" onClick={onApply} disabled={loading}>
            {loading ? "Applying..." : "Apply"}
          </button>
          <button type="button" className="btn-secondary" onClick={onReset} disabled={loading}>
            Reset
          </button>
        </div>
      </div>
      <p className="report-selection-line">{selectionSummary}</p>
    </section>
  );
}
