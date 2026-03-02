import type { AnnualReportSummaryResponse } from "@/types";

type AnalyticsChartsProps = {
  charts: AnnualReportSummaryResponse["charts"];
  onDrilldown: (filters: {
    college?: string;
    reviewType?: "EXEMPT" | "EXPEDITED" | "FULL_BOARD";
  }) => void;
};

const maxOf = (arr: Array<{ count: number }>) =>
  arr.length ? Math.max(...arr.map((x) => x.count), 1) : 1;
const isOthersLabel = (value: string) => /^others?\b/i.test(value.trim()) || /^other\b/i.test(value.trim());
const toCollegeLabel = (value: string) => (isOthersLabel(value) ? "OTHERS" : value);

export default function AnalyticsCharts({ charts, onDrilldown }: AnalyticsChartsProps) {
  const termMax = maxOf(charts.proposalsPerTerm);
  const reviewMax = maxOf(charts.reviewTypeDistribution);
  const topColleges = [...charts.topColleges].sort((a, b) => {
    const aOther = isOthersLabel(a.label);
    const bOther = isOthersLabel(b.label);
    if (aOther && !bOther) return 1;
    if (!aOther && bOther) return -1;
    return b.count - a.count;
  });
  const collegeMax = maxOf(topColleges);

  return (
    <div className="analytics-grid">
      <section className="chart-card">
        <h4>Proposals per Term</h4>
        <div className="h-bars">
          {charts.proposalsPerTerm.map((item) => (
            <div key={item.label} className="h-bar-item">
              <span>{item.label}</span>
              <div className="h-bar-track">
                <div
                  className="h-bar-fill"
                  style={{ width: `${Math.max(3, Math.round((item.count / termMax) * 100))}%` }}
                />
              </div>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="chart-card">
        <h4>Type of Review Distribution</h4>
        <div className="h-bars">
          {charts.reviewTypeDistribution.map((item) => (
            <button
              key={item.label}
              type="button"
              className="h-bar-item"
              onClick={() =>
                item.label === "Exempted"
                  ? onDrilldown({ reviewType: "EXEMPT" })
                  : item.label === "Expedited"
                  ? onDrilldown({ reviewType: "EXPEDITED" })
                  : item.label === "Full Review"
                  ? onDrilldown({ reviewType: "FULL_BOARD" })
                  : onDrilldown({})
              }
            >
              <span>{item.label}</span>
              <div className="h-bar-track">
                <div
                  className="h-bar-fill"
                  style={{ width: `${Math.max(3, Math.round((item.count / reviewMax) * 100))}%` }}
                />
              </div>
              <strong>{item.count}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="chart-card">
        <h4>Top Colleges by Received</h4>
        <div className="h-bars">
          {topColleges.map((item) => (
            <button
              key={item.label}
              type="button"
              className="h-bar-item"
              onClick={() => onDrilldown({ college: item.label })}
            >
              <span>{toCollegeLabel(item.label)}</span>
              <div className="h-bar-track">
                <div
                  className="h-bar-fill"
                  style={{ width: `${Math.max(3, Math.round((item.count / collegeMax) * 100))}%` }}
                />
              </div>
              <strong>{item.count}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
