import { Fragment } from "react";
import type { AnnualReportSummaryResponse } from "@/types";

type ProponentComparativeTablesProps = {
  tables: AnnualReportSummaryResponse["comparativeByProponent"];
  selectedAy?: string;
  selectedCategory?: "ALL" | "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING";
  selectedReviewType?: "ALL" | "EXEMPT" | "EXPEDITED" | "FULL_BOARD" | "UNCLASSIFIED" | "WITHDRAWN";
};

const formatNumber = (value: number) => value.toLocaleString("en-US");
const formatCell = (value: number) => (value === 0 ? "-" : formatNumber(value));

const categoryLabel = (value: string) => {
  if (value === "UNDERGRAD") return "UNDERGRADUATE";
  if (value === "GRAD") return "GRADUATE";
  if (value === "NON_TEACHING") return "NON-TEACHING/STAFF";
  return value;
};

const collegeLabel = (value: string) =>
  /^others\b/i.test(value.trim()) ? "OTHERS" : value;

const isOthersCollege = (value: string) => /^others\b/i.test(value.trim());
const normalizeCollegeKey = (value: string) =>
  isOthersCollege(value) ? "OTHERS" : value.trim().toUpperCase();
const PRIORITY_COLLEGE_ORDER = ["BAGCED", "CCS", "CLA", "COS", "GCOE", "RVRCOB", "SOE", "OTHERS"] as const;
const PRIORITY_COLLEGE_RANK = new Map<string, number>(
  PRIORITY_COLLEGE_ORDER.map((value, index) => [value, index] as const)
);
const DEFAULT_ROWS_BY_CATEGORY: Record<string, string[]> = {
  UNDERGRAD: ["BAGCED", "CCS", "CLA", "COS", "GCOE", "RVRCOB", "SOE", "OTHERS", "CLT-SOE"],
  GRAD: ["BAGCED", "CCS", "CLA", "COS", "GCOE", "RVRCOB", "SOE", "OTHERS"],
  FACULTY: ["BAGCED", "CCS", "CLA", "COS", "GCOE", "RVRCOB", "SOE", "OTHERS"],
};

type ComparativeRow = {
  college: string;
  exempted: Record<string, number>;
  expedited: Record<string, number>;
  fullReview: Record<string, number>;
  withdrawn: Record<string, number>;
};

const makeZeroCounts = (years: string[]) =>
  Object.fromEntries(years.map((year) => [year, 0])) as Record<string, number>;

const makeZeroRow = (college: string, years: string[]): ComparativeRow => ({
  college,
  exempted: makeZeroCounts(years),
  expedited: makeZeroCounts(years),
  fullReview: makeZeroCounts(years),
  withdrawn: makeZeroCounts(years),
});

export default function ProponentComparativeTables({
  tables,
  selectedAy = "ALL",
  selectedCategory = "ALL",
  selectedReviewType = "ALL",
}: ProponentComparativeTablesProps) {
  if (!tables || tables.length === 0) return null;

  const allStatusColumns = [
    { label: "EXEMPTED", getCounts: (row: { exempted: Record<string, number> }) => row.exempted },
    { label: "EXPEDITED", getCounts: (row: { expedited: Record<string, number> }) => row.expedited },
    { label: "FULL REVIEW", getCounts: (row: { fullReview: Record<string, number> }) => row.fullReview },
    { label: "WITHDRAWN", getCounts: (row: { withdrawn: Record<string, number> }) => row.withdrawn },
  ] as const;

  const statusColumns = allStatusColumns.filter((column) => {
    if (selectedReviewType === "ALL") return true;
    if (selectedReviewType === "EXEMPT") return column.label === "EXEMPTED";
    if (selectedReviewType === "EXPEDITED") return column.label === "EXPEDITED";
    if (selectedReviewType === "WITHDRAWN") return column.label === "WITHDRAWN";
    if (selectedReviewType === "UNCLASSIFIED") return true;
    return column.label === "FULL REVIEW";
  });

  const toneClass = (category: string) => {
    if (category === "UNDERGRAD") return "proponent-undergrad";
    if (category === "GRAD") return "proponent-grad";
    if (category === "FACULTY") return "proponent-faculty";
    return "proponent-others";
  };

  const visibleTables =
    selectedCategory === "ALL"
      ? tables
      : tables.filter((table) => table.category === selectedCategory);

  return (
    <div>
      {visibleTables.map((table) => (
        <div key={table.category} className={`proponent-comparative ${toneClass(table.category)}`}>
          {(() => {
            const displayedYears =
              selectedAy === "ALL" && table.years.length > 3 ? table.years.slice(0, 3) : table.years;
            const rowMap = new Map(table.rows.map((row) => [row.college, row] as const));
            const baselineRows = DEFAULT_ROWS_BY_CATEGORY[table.category] ?? [];
            for (const college of baselineRows) {
              if (!Array.from(rowMap.keys()).some((key) => normalizeCollegeKey(key) === normalizeCollegeKey(college))) {
                rowMap.set(college, makeZeroRow(college, table.years));
              }
            }
            const mergedRows = Array.from(rowMap.values());
            const usePriorityGrouping = table.category !== "NON_TEACHING";
            const sortedRows = mergedRows.sort((a, b) => {
              if (!usePriorityGrouping) return a.college.localeCompare(b.college);
              const keyA = normalizeCollegeKey(a.college);
              const keyB = normalizeCollegeKey(b.college);
              const rankA = PRIORITY_COLLEGE_RANK.get(keyA);
              const rankB = PRIORITY_COLLEGE_RANK.get(keyB);
              const inPriorityA = rankA !== undefined;
              const inPriorityB = rankB !== undefined;
              if (inPriorityA && inPriorityB) return (rankA as number) - (rankB as number);
              if (inPriorityA && !inPriorityB) return -1;
              if (!inPriorityA && inPriorityB) return 1;
              return a.college.localeCompare(b.college);
            });
            const primaryRows = usePriorityGrouping ? sortedRows.filter(
              (row) => PRIORITY_COLLEGE_RANK.has(normalizeCollegeKey(row.college))
            ) : [];
            const secondaryRows = usePriorityGrouping ? sortedRows.filter(
              (row) => !PRIORITY_COLLEGE_RANK.has(normalizeCollegeKey(row.college))
            ) : sortedRows;
            const groupedRows = [...primaryRows, ...secondaryRows];
            const showPerYearColumns = selectedAy === "ALL" && displayedYears.length > 1;
            const metricColumnCount = showPerYearColumns
              ? statusColumns.length * displayedYears.length
              : statusColumns.length;
            const totalColumns = 1 + metricColumnCount;
            const rowLabelHeader = table.category === "NON_TEACHING" ? "DEPARTMENT" : "COLLEGE / SERVICE UNIT";

            return (
          <div className="report-table-wrap">
            <table
              className={`report-table proponent-comparative-table ${
                showPerYearColumns ? "all-years-layout" : "single-year-layout"
              }`}
            >
              <colgroup>
                <col className="col-college-wide" />
                {showPerYearColumns
                  ? Array.from({ length: metricColumnCount }).map((_, index) => (
                      <col key={`metric-${table.category}-${index}`} className="col-year-metric" />
                    ))
                  : statusColumns.map((column) => (
                      <col key={`metric-${table.category}-${column.label}`} className="col-metric" />
                    ))}
              </colgroup>
              <thead>
                <tr>
                  <th colSpan={totalColumns}>{categoryLabel(table.category)}</th>
                </tr>
                {showPerYearColumns ? (
                  <>
                    <tr>
                      <th className="col-college" rowSpan={2}>
                        {rowLabelHeader}
                      </th>
                      {statusColumns.map((column) => (
                        <th key={`status-${table.category}-${column.label}`} className="num" colSpan={displayedYears.length}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {statusColumns.flatMap((column) =>
                        displayedYears.map((year) => (
                          <th key={`year-${table.category}-${column.label}-${year}`} className="num">
                            {year}
                          </th>
                        ))
                      )}
                    </tr>
                  </>
                ) : (
                  <>
                    <tr>
                      <th colSpan={totalColumns}>{displayedYears.join(" • ")}</th>
                    </tr>
                    <tr>
                      <th className="col-college">{rowLabelHeader}</th>
                      {statusColumns.map((column) => (
                        <th key={`status-single-${table.category}-${column.label}`} className="num">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </>
                )}
              </thead>
              <tbody>
                {groupedRows.map((row, index) => {
                  const isSecondary = index >= primaryRows.length;
                  return (
                  <Fragment key={`${table.category}-${row.college}`}>
                  <tr>
                    <td className={`col-college ${isSecondary ? "group-secondary" : "group-primary"}`}>{collegeLabel(row.college)}</td>
                    {showPerYearColumns
                      ? statusColumns.flatMap((column) =>
                          displayedYears.map((year) => (
                            <td
                              key={`cell-${table.category}-${row.college}-${column.label}-${year}`}
                              className={`num ${isSecondary ? "group-secondary" : "group-primary"}`}
                            >
                              {formatCell(column.getCounts(row)[year] ?? 0)}
                            </td>
                          ))
                        )
                      : statusColumns.map((column) => (
                          <td
                            key={`cell-single-${table.category}-${row.college}-${column.label}`}
                            className={`num ${isSecondary ? "group-secondary" : "group-primary"}`}
                          >
                            {formatCell(
                              displayedYears.reduce((sum, year) => sum + (column.getCounts(row)[year] ?? 0), 0)
                            )}
                          </td>
                        ))}
                  </tr>
                  </Fragment>
                );})}
                <tr className="totals-row">
                  <td className="col-college">{table.totals.college}</td>
                  {showPerYearColumns
                      ? statusColumns.flatMap((column) =>
                          displayedYears.map((year) => (
                          <td key={`total-${table.category}-${column.label}-${year}`} className="num">
                            {formatCell(column.getCounts(table.totals)[year] ?? 0)}
                          </td>
                        ))
                      )
                    : statusColumns.map((column) => (
                        <td key={`total-single-${table.category}-${column.label}`} className="num">
                          {formatCell(
                            displayedYears.reduce((sum, year) => sum + (column.getCounts(table.totals)[year] ?? 0), 0)
                          )}
                        </td>
                      ))}
                </tr>
              </tbody>
            </table>
          </div>
            );
          })()}
        </div>
      ))}
    </div>
  );
}
