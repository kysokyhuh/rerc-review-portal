import type { CSSProperties } from "react";
import type { AnnualReportSummaryResponse } from "@/types";

type AnalyticsChartsProps = {
  summary: AnnualReportSummaryResponse;
  onDrilldown: (filters: {
    college?: string;
    reviewType?: "EXEMPT" | "EXPEDITED" | "FULL_BOARD";
  }) => void;
};

const maxOf = (arr: Array<{ count: number }>) =>
  arr.length ? Math.max(...arr.map((item) => item.count), 1) : 1;

const isOthersLabel = (value: string) =>
  /^others?\b/i.test(value.trim()) || /^other\b/i.test(value.trim());

const toCollegeLabel = (value: string) => (isOthersLabel(value) ? "OTHER" : value);

const formatDays = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? `${value} days` : `${value.toFixed(1)} days`;
};

const outcomeMeta = {
  exempted: { label: "Exempted", className: "tone-exempt" },
  expedited: { label: "Expedited", className: "tone-expedited" },
  fullReview: { label: "Full Review", className: "tone-full" },
  withdrawn: { label: "Withdrawn", className: "tone-withdrawn" },
  unclassified: { label: "Unclassified", className: "tone-unclassified" },
} as const;

const phase2Keys = ["exempted", "expedited", "fullReview", "withdrawn", "unclassified"] as const;
const comparativeKeys = ["exempted", "expedited", "fullReview", "withdrawn"] as const;

function ChartEmpty({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <section className="chart-card">
      <div className="chart-card-heading">
        <h4>{title}</h4>
      </div>
      <div className="chart-empty">{message}</div>
    </section>
  );
}

export default function AnalyticsCharts({ summary, onDrilldown }: AnalyticsChartsProps) {
  const { charts, classificationMatrix, performanceCharts } = summary;
  const monthMax = maxOf(charts.receivedByMonth);
  const receivedCollegeMax = maxOf(charts.receivedByCollege);
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
  const reviewTypeByMonthMax = maxOf(
    charts.reviewTypeByMonth.map((item) => ({ count: item.total }))
  );
  const withdrawnByMonthMax = maxOf(charts.withdrawnByMonth);
  const committeeMax = maxOf(charts.committeeDistribution);
  const funnelMax = maxOf(performanceCharts.workflowFunnel);
  const matrixRows = [
    { key: "UNDERGRAD" as const, label: "Undergraduate" },
    { key: "GRAD" as const, label: "Graduate" },
    { key: "FACULTY" as const, label: "Faculty" },
    { key: "NON_TEACHING" as const, label: "Non-Teaching" },
    { key: "TOTAL" as const, label: "Total" },
  ];
  const matrixMax = Math.max(
    ...matrixRows.flatMap((row) => {
      const values = classificationMatrix[row.key];
      return [values.exempted, values.expedited, values.fullReview, values.withdrawn];
    }),
    1
  );

  const averageCards = [
    ...performanceCharts.averages.daysToResults.map((item) => ({
      label: `${item.label} to Results`,
      value: formatDays(item.value),
      tone: "tone-results",
    })),
    ...performanceCharts.averages.daysToClearance.map((item) => ({
      label: `${item.label} to Clearance`,
      value: formatDays(item.value),
      tone: "tone-clearance",
    })),
    {
      label: "Average Resubmission",
      value: formatDays(performanceCharts.averages.daysToResubmit),
      tone: "tone-revision",
    },
  ];

  const segmentStyle = (value: number, total: number) =>
    ({
      width: `${total > 0 ? (value / total) * 100 : 0}%`,
    }) as CSSProperties;

  return (
    <div className="analytics-layout">
      <section className="analytics-section">
        <div className="analytics-section-header">
          <h4>Volume &amp; Composition</h4>
          <p>Core intake volume, proposal mix, and institutional breakdowns for the current report filter set.</p>
        </div>

        <div className="analytics-grid analytics-grid-volume">
          {charts.receivedByMonth.length ? (
            <section className="chart-card chart-card-wide">
              <div className="chart-card-heading">
                <h4>Received Proposals by Month</h4>
                <p>Initial submissions only. Months without proposals remain visible as zero.</p>
              </div>
              <div className="v-chart-shell">
                <div className="v-chart">
                  {charts.receivedByMonth.map((item) => (
                    <div key={item.label} className="v-bar-item">
                      <strong>{item.count}</strong>
                      <div className="v-bar-track">
                        <div
                          className="v-bar-fill"
                          style={{ height: `${Math.max(6, Math.round((item.count / monthMax) * 100))}%` }}
                        />
                      </div>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <ChartEmpty
              title="Received Proposals by Month"
              message="Select a single academic year to view monthly received proposals."
            />
          )}

          <section className="chart-card">
            <div className="chart-card-heading">
              <h4>Proponent Category Distribution</h4>
              <p>Current applicant mix across the selected report scope.</p>
            </div>
            <div className="h-bars">
              {charts.proponentCategoryDistribution.map((item) => (
                <div key={item.category} className="h-bar-item">
                  <span>{item.label}</span>
                  <div className="h-bar-track">
                    <div
                      className="h-bar-fill"
                      style={{
                        width: `${Math.max(
                          3,
                          Math.round(
                            (item.count /
                              Math.max(
                                ...charts.proponentCategoryDistribution.map((entry) => entry.count),
                                1
                              )) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="chart-card chart-card-wide">
            <div className="chart-card-heading">
              <h4>Outcome by College / Unit</h4>
              <p>Exclusive outcome buckets prevent double-counting in stacked comparisons.</p>
            </div>
            <div className="stacked-rows">
              {charts.outcomeByCollege.map((item) => (
                <div key={item.label} className="stacked-row">
                  <div className="stacked-row-meta">
                    <span>{toCollegeLabel(item.label)}</span>
                    <strong>{item.total}</strong>
                  </div>
                  <div className="stacked-row-track">
                    {phase2Keys.map((key) =>
                      item[key] > 0 ? (
                        <div
                          key={`${item.label}-${key}`}
                          className={`stack-segment ${outcomeMeta[key].className}`}
                          style={segmentStyle(item[key], item.total)}
                          title={`${outcomeMeta[key].label}: ${item[key]}`}
                        />
                      ) : null
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="stacked-legend">
              {phase2Keys.map((key) => (
                <span key={key} className="legend-chip">
                  <i className={`legend-dot ${outcomeMeta[key].className}`} />
                  {outcomeMeta[key].label}
                </span>
              ))}
            </div>
          </section>

          <section className="chart-card chart-card-wide">
            <div className="chart-card-heading">
              <h4>Classification Matrix</h4>
              <p>Cross-tab of review outcomes by proponent category.</p>
            </div>
            <div className="matrix-table-wrap">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Exempted</th>
                    <th>Expedited</th>
                    <th>Full Review</th>
                    <th>Withdrawn</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((row) => {
                    const values = classificationMatrix[row.key];
                    return (
                      <tr key={row.key}>
                        <th>{row.label}</th>
                        {[
                          { key: "exempted", value: values.exempted },
                          { key: "expedited", value: values.expedited },
                          { key: "fullReview", value: values.fullReview },
                          { key: "withdrawn", value: values.withdrawn },
                        ].map((cell) => (
                          <td
                            key={`${row.key}-${cell.key}`}
                            style={{
                              backgroundColor: `rgba(47, 122, 84, ${0.12 + (cell.value / matrixMax) * 0.48})`,
                            }}
                          >
                            {cell.value}
                          </td>
                        ))}
                        <td className="matrix-total">{values.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="chart-card">
            <div className="chart-card-heading">
              <h4>Proposals per Term</h4>
            </div>
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
            <div className="chart-card-heading">
              <h4>Type of Review Distribution</h4>
            </div>
            <div className="h-bars">
              {charts.reviewTypeDistribution.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="h-bar-item chart-action"
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
            <div className="chart-card-heading">
              <h4>Received by College / Unit</h4>
            </div>
            <div className="h-bars">
              {charts.receivedByCollege.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="h-bar-item chart-action"
                  disabled={isOthersLabel(item.label)}
                  onClick={() => onDrilldown({ college: item.label })}
                >
                  <span>{toCollegeLabel(item.label)}</span>
                  <div className="h-bar-track">
                    <div
                      className="h-bar-fill"
                      style={{ width: `${Math.max(3, Math.round((item.count / receivedCollegeMax) * 100))}%` }}
                    />
                  </div>
                  <strong>{item.count}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="chart-card">
            <div className="chart-card-heading">
              <h4>Top Colleges by Received</h4>
            </div>
            <div className="h-bars">
              {topColleges.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="h-bar-item chart-action"
                  disabled={isOthersLabel(item.label)}
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
      </section>

      <section className="analytics-section">
        <div className="analytics-section-header">
          <h4>Trend &amp; Comparison</h4>
          <p>Longer-view charts for monthly movement, year-over-year shifts, and committee-level distribution.</p>
        </div>

        <div className="analytics-grid analytics-grid-trends">
          {charts.reviewTypeByMonth.length ? (
            <section className="chart-card chart-card-wide">
              <div className="chart-card-heading">
                <h4>Review Type by Month</h4>
                <p>Exclusive stacked monthly trend, including unclassified proposals where applicable.</p>
              </div>
              <div className="v-chart-shell">
                <div className="stacked-v-chart">
                  {charts.reviewTypeByMonth.map((item) => (
                    <div key={item.label} className="stacked-v-item">
                      <strong>{item.total}</strong>
                      <div className="stacked-v-track">
                        <div
                          className="stacked-v-fill"
                          style={{ height: `${Math.max(6, Math.round((item.total / reviewTypeByMonthMax) * 100))}%` }}
                        >
                          {phase2Keys.map((key) =>
                            item[key] > 0 ? (
                              <div
                                key={`${item.label}-${key}`}
                                className={`stack-segment ${outcomeMeta[key].className}`}
                                style={{
                                  height: `${(item[key] / item.total) * 100}%`,
                                }}
                                title={`${outcomeMeta[key].label}: ${item[key]}`}
                              />
                            ) : null
                          )}
                        </div>
                      </div>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <ChartEmpty
              title="Review Type by Month"
              message="Select a single academic year to compare review-path trends by month."
            />
          )}

          {charts.withdrawnByMonth.length ? (
            <section className="chart-card">
              <div className="chart-card-heading">
                <h4>Withdrawn Proposals by Month</h4>
              </div>
              <div className="v-chart-shell compact">
                <div className="v-chart">
                  {charts.withdrawnByMonth.map((item) => (
                    <div key={item.label} className="v-bar-item">
                      <strong>{item.count}</strong>
                      <div className="v-bar-track">
                        <div
                          className="v-bar-fill tone-withdrawn"
                          style={{ height: `${Math.max(6, Math.round((item.count / withdrawnByMonthMax) * 100))}%` }}
                        />
                      </div>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <ChartEmpty
              title="Withdrawn Proposals by Month"
              message="Monthly withdrawal trends are shown only when one academic year is selected."
            />
          )}

          <section className="chart-card chart-card-wide">
            <div className="chart-card-heading">
              <h4>Comparative by Academic Year</h4>
              <p>Yearly totals aggregated from the comparative proponent tables.</p>
            </div>
            <div className="stacked-rows">
              {charts.comparativeYearTrend.map((item) => {
                const total =
                  item.exempted + item.expedited + item.fullReview + item.withdrawn;
                return (
                  <div key={item.label} className="stacked-row">
                    <div className="stacked-row-meta">
                      <span>{item.label}</span>
                      <strong>{total}</strong>
                    </div>
                    <div className="stacked-row-track">
                      {comparativeKeys.map((key) =>
                        item[key] > 0 ? (
                          <div
                            key={`${item.label}-${key}`}
                            className={`stack-segment ${outcomeMeta[key].className}`}
                            style={segmentStyle(item[key], Math.max(total, 1))}
                            title={`${outcomeMeta[key].label}: ${item[key]}`}
                          />
                        ) : null
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {charts.committeeDistribution.length > 1 ? (
            <section className="chart-card">
              <div className="chart-card-heading">
                <h4>Committee Distribution</h4>
              </div>
              <div className="h-bars">
                {charts.committeeDistribution.map((item) => (
                  <div key={item.label} className="h-bar-item">
                    <span>{item.label}</span>
                    <div className="h-bar-track">
                      <div
                        className="h-bar-fill"
                        style={{ width: `${Math.max(3, Math.round((item.count / committeeMax) * 100))}%` }}
                      />
                    </div>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <ChartEmpty
              title="Committee Distribution"
              message="Committee comparison becomes available when the report scope includes more than one committee."
            />
          )}
        </div>
      </section>

      <section className="analytics-section">
        <div className="analytics-section-header">
          <h4>Performance</h4>
          <p>Turnaround, SLA compliance, and stage-reach indicators for the filtered submission set.</p>
        </div>

        <div className="analytics-grid analytics-grid-performance">
          <section className="chart-card chart-card-wide">
            <div className="chart-card-heading">
              <h4>Average Turnaround</h4>
              <p>Results and clearance values are measured in working days. Resubmission covers revision responses.</p>
            </div>
            <div className="metric-card-grid">
              {averageCards.map((item) => (
                <div key={item.label} className={`metric-card ${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="chart-card chart-card-wide">
            <div className="chart-card-heading">
              <h4>Within SLA vs Overdue</h4>
              <p>Stage compliance uses the configured committee SLA, including calendar-day and working-day stages.</p>
            </div>
            <div className="stacked-rows">
              {performanceCharts.slaCompliance.map((item) => {
                const total = item.within + item.overdue;
                return (
                  <div key={item.label} className="stacked-row">
                    <div className="stacked-row-meta">
                      <span>{item.label}</span>
                      <strong>{total}</strong>
                    </div>
                    <div className="stacked-row-track">
                      <div
                        className="stack-segment tone-within"
                        style={{
                          width: `${Math.max(
                            0,
                            total > 0 ? (item.within / total) * 100 : 0
                          )}%`,
                        }}
                        title={`Within SLA: ${item.within}`}
                      />
                      <div
                        className="stack-segment tone-overdue"
                        style={{
                          width: `${Math.max(
                            0,
                            total > 0 ? (item.overdue / total) * 100 : 0
                          )}%`,
                        }}
                        title={`Overdue: ${item.overdue}`}
                      />
                    </div>
                    <span className="stacked-row-caption">
                      {item.within} within / {item.overdue} overdue
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="stacked-legend">
              <span className="legend-chip">
                <i className="legend-dot tone-within" />
                Within SLA
              </span>
              <span className="legend-chip">
                <i className="legend-dot tone-overdue" />
                Overdue
              </span>
            </div>
          </section>

          <section className="chart-card chart-card-wide">
            <div className="chart-card-heading">
              <h4>Workflow Stage Reach</h4>
              <p>Counts show how many filtered submissions reached each lifecycle stage at least once.</p>
            </div>
            <div className="h-bars">
              {performanceCharts.workflowFunnel.map((item) => (
                <div key={item.label} className="h-bar-item">
                  <span>{item.label}</span>
                  <div className="h-bar-track">
                    <div
                      className="h-bar-fill"
                      style={{ width: `${Math.max(3, Math.round((item.count / funnelMax) * 100))}%` }}
                    />
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
