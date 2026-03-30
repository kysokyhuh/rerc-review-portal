import { useState } from "react";
import type { AnnualReportSummaryResponse } from "@/types";

const formatNumber = (value: number) => value.toLocaleString("en-US");

type CollegeBreakdownTableProps = {
  rows: AnnualReportSummaryResponse["breakdownByCollege"];
  onDrilldown: (filters: {
    college?: string;
    category?: "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING";
    reviewType?: "EXEMPT" | "EXPEDITED" | "FULL_BOARD";
  }) => void;
};

const categoryColors: Record<string, string> = {
  UNDERGRAD: "cat-undergrad",
  GRAD: "cat-grad",
  FACULTY: "cat-faculty",
  NON_TEACHING: "cat-non-teaching",
};
const toCategoryLabel = (value: string) => {
  if (value === "UNDERGRAD") return "UNDERGRADUATE";
  if (value === "GRAD") return "GRADUATE";
  if (value === "NON_TEACHING") return "NON-TEACHING/STAFF";
  return value;
};

export default function CollegeBreakdownTable({
  rows,
  onDrilldown,
}: CollegeBreakdownTableProps) {
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const isOthersCollege = (value: string) => /^others\b/i.test(value.trim());
  const toCollegeLabel = (value: string) => (isOthersCollege(value) ? "OTHERS" : value);
  const sortedRows = [...rows].sort((a, b) => {
    const aOthers = isOthersCollege(a.college);
    const bOthers = isOthersCollege(b.college);
    if (aOthers && !bOthers) return 1;
    if (!aOthers && bOthers) return -1;
    return 0;
  });

  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th>COLLEGE / SERVICE UNIT</th>
            <th className="num">Received</th>
            <th className="num">Exempted</th>
            <th className="num">Expedited</th>
            <th className="num">Full Review</th>
            <th className="num">Withdrawn</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const isOpen = !!openRows[row.college];
            return (
              <tr key={row.college}>
                <td>{toCollegeLabel(row.college)}</td>
                <td className="num">{formatNumber(row.received)}</td>
                <td className="num">
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => onDrilldown({ college: row.college, reviewType: "EXEMPT" })}
                  >
                    {formatNumber(row.exempted)}
                  </button>
                </td>
                <td className="num">
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => onDrilldown({ college: row.college, reviewType: "EXPEDITED" })}
                  >
                    {formatNumber(row.expedited)}
                  </button>
                </td>
                <td className="num">
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => onDrilldown({ college: row.college, reviewType: "FULL_BOARD" })}
                  >
                    {formatNumber(row.fullReview)}
                  </button>
                </td>
                <td className="num">{formatNumber(row.withdrawn)}</td>
                <td>
                  <button
                    type="button"
                    className="report-btn-tertiary"
                    onClick={() =>
                      setOpenRows((prev) => ({ ...prev, [row.college]: !prev[row.college] }))
                    }
                  >
                    {isOpen ? "Hide" : "Show"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {sortedRows.map((row) => {
        if (!openRows[row.college]) return null;
        return (
          <div key={`${row.college}-details`} className="college-detail-card">
            <h4>{toCollegeLabel(row.college)} by Proponent Category</h4>
            <table className="report-table nested">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="num">Received</th>
                  <th className="num">Exempted</th>
                  <th className="num">Expedited</th>
                  <th className="num">Full Review</th>
                  <th className="num">Withdrawn</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(row.categories) as Array<keyof typeof row.categories>).map((key) => (
                  <tr key={`${row.college}-${key}`} className={categoryColors[key]}>
                    <td>{toCategoryLabel(key)}</td>
                    <td className="num">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => onDrilldown({ college: row.college, category: key })}
                      >
                        {formatNumber(row.categories[key].received)}
                      </button>
                    </td>
                    <td className="num">{formatNumber(row.categories[key].exempted)}</td>
                    <td className="num">{formatNumber(row.categories[key].expedited)}</td>
                    <td className="num">{formatNumber(row.categories[key].fullReview)}</td>
                    <td className="num">{formatNumber(row.categories[key].withdrawn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
