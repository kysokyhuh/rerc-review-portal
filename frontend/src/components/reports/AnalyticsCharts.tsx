import { useState, type CSSProperties } from "react";
import type { AnnualReportSummaryResponse } from "@/types";

type AnalyticsChartsProps = {
  summary: AnnualReportSummaryResponse;
  onDrilldown: (filters: {
    college?: string;
    reviewType?: "EXEMPT" | "EXPEDITED" | "FULL_BOARD";
  }) => void;
};

type SegmentControlProps = {
  ariaLabel: string;
  options: Array<{ label: string; value: string; disabled?: boolean }>;
  value: string;
  onChange: (value: string) => void;
};

const maxOf = (arr: Array<{ count: number }>) =>
  arr.length ? Math.max(...arr.map((item) => item.count), 1) : 1;

const isOthersLabel = (value: string) =>
  /^others?\b/i.test(value.trim()) || /^other\b/i.test(value.trim());

const toCollegeLabel = (value: string) => (isOthersLabel(value) ? "Other units" : value);

const formatDays = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? `${value} days` : `${value.toFixed(1)} days`;
};

const outcomeMeta = {
  exempted: { label: "Exempted", className: "tone-exempt" },
  expedited: { label: "Expedited", className: "tone-expedited" },
  fullReview: { label: "Full review", className: "tone-full" },
  withdrawn: { label: "Withdrawn", className: "tone-withdrawn" },
  unclassified: { label: "Unclassified", className: "tone-unclassified" },
} as const;

const phase2Keys = ["exempted", "expedited", "fullReview", "withdrawn", "unclassified"] as const;
const comparativeKeys = ["exempted", "expedited", "fullReview", "withdrawn"] as const;

function SegmentControl({ ariaLabel, options, value, onChange }: SegmentControlProps) {
  return (
    <div className="report-segmented-control" role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`report-segmented-button ${value === option.value ? "active" : ""}`}
          onClick={() => onChange(option.value)}
          disabled={option.disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

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
  const [volumeFocus, setVolumeFocus] = useState<"composition" | "institutions">("composition");
  const [trendFocus, setTrendFocus] = useState<"monthly" | "comparison">("monthly");
  const [monthlyVolumeFocus, setMonthlyVolumeFocus] = useState<"received" | "withdrawn">("received");
  const [performanceFocus, setPerformanceFocus] = useState<"sla" | "workflow">("sla");

  const { charts, performanceCharts } = summary;
  const monthMax = maxOf(charts.receivedByMonth);
  const withdrawnByMonthMax = maxOf(charts.withdrawnByMonth);
  const reviewTypeByMonthMax = maxOf(
    charts.reviewTypeByMonth.map((item) => ({ count: item.total }))
  );
  const topReceivedInstitutions = [...charts.receivedByCollege]
    .sort((a, b) => {
      const aOther = isOthersLabel(a.label);
      const bOther = isOthersLabel(b.label);
      if (aOther && !bOther) return 1;
      if (!aOther && bOther) return -1;
      return b.count - a.count;
    })
    .slice(0, 5);
  const topInstitutionMax = maxOf(topReceivedInstitutions);
  const topOutcomeInstitutions = [...charts.outcomeByCollege]
    .sort((a, b) => {
      const aOther = isOthersLabel(a.label);
      const bOther = isOthersLabel(b.label);
      if (aOther && !bOther) return 1;
      if (!aOther && bOther) return -1;
      return b.total - a.total;
    })
    .slice(0, 5);
  const reviewMax = maxOf(charts.reviewTypeDistribution);
  const categoryMax = maxOf(
    charts.proponentCategoryDistribution.map((item) => ({ count: item.count }))
  );
  const committeeMax = maxOf(charts.committeeDistribution);
  const funnelMax = maxOf(performanceCharts.workflowFunnel);

  const averageCards = [
    ...performanceCharts.averages.daysToResults.map((item) => ({
      label: `${item.label} to results`,
      value: formatDays(item.value),
      tone: "tone-results",
    })),
    ...performanceCharts.averages.daysToClearance.map((item) => ({
      label: `${item.label} to clearance`,
      value: formatDays(item.value),
      tone: "tone-clearance",
    })),
    {
      label: "Average resubmission",
      value: formatDays(performanceCharts.averages.daysToResubmit),
      tone: "tone-revision",
    },
  ];

  const segmentStyle = (value: number, total: number) =>
    ({
      width: `${total > 0 ? (value / total) * 100 : 0}%`,
    }) as CSSProperties;

  const monthlyItems =
    monthlyVolumeFocus === "withdrawn" ? charts.withdrawnByMonth : charts.receivedByMonth;
  const monthlyTitle =
    monthlyVolumeFocus === "withdrawn"
      ? "Withdrawn proposals by month"
      : "Received proposals by month";
  const monthlyMessage =
    monthlyVolumeFocus === "withdrawn"
      ? "Monthly withdrawal trends are shown only when one academic year is selected."
      : "Select a single academic year to view monthly received proposals.";
  const monthlyMax =
    monthlyVolumeFocus === "withdrawn" ? withdrawnByMonthMax : monthMax;

  return (
    <div className="analytics-layout">
      <section className="analytics-section">
        <div className="analytics-section-header">
          <div>
            <h4>Volume &amp; Composition</h4>
            <p>Lead with the mix first, then switch to institutions only when you need a breakdown.</p>
          </div>
          <SegmentControl
            ariaLabel="Volume and composition focus"
            value={volumeFocus}
            onChange={(next) => setVolumeFocus(next as "composition" | "institutions")}
            options={[
              { label: "Composition", value: "composition" },
              { label: "Institutions", value: "institutions" },
            ]}
          />
        </div>

        <div className="analytics-inline-stats">
          {charts.proposalsPerTerm.map((item) => (
            <div key={item.label} className="analytics-inline-stat">
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>

        <div className="analytics-grid">
          {volumeFocus === "composition" ? (
            <>
              <section className="chart-card">
                <div className="chart-card-heading">
                  <h4>Proponent category mix</h4>
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
                            width: `${Math.max(3, Math.round((item.count / categoryMax) * 100))}%`,
                          }}
                        />
                      </div>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="chart-card">
                <div className="chart-card-heading">
                  <h4>Review path distribution</h4>
                  <p>Use this to see which pathway dominates before opening deeper comparisons.</p>
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
            </>
          ) : (
            <>
              <section className="chart-card chart-card-wide">
                <div className="chart-card-heading">
                  <h4>Outcome mix across top institutions</h4>
                  <p>Showing the top 5 units by filtered volume to keep the comparison readable.</p>
                </div>
                <div className="stacked-rows">
                  {topOutcomeInstitutions.map((item) => (
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

              <section className="chart-card">
                <div className="chart-card-heading">
                  <h4>Top colleges by received</h4>
                  <p>Showing the top 5 institutions in the current scope.</p>
                </div>
                <div className="h-bars">
                  {topReceivedInstitutions.map((item) => (
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
                          style={{
                            width: `${Math.max(3, Math.round((item.count / topInstitutionMax) * 100))}%`,
                          }}
                        />
                      </div>
                      <strong>{item.count}</strong>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </section>

      <section className="analytics-section">
        <div className="analytics-section-header">
          <div>
            <h4>Trend &amp; Comparison</h4>
            <p>Monthly charts stay grouped together, while broader comparisons live in a separate view.</p>
          </div>
          <SegmentControl
            ariaLabel="Trend and comparison focus"
            value={trendFocus}
            onChange={(next) => setTrendFocus(next as "monthly" | "comparison")}
            options={[
              { label: "Monthly trends", value: "monthly" },
              { label: "Year comparison", value: "comparison" },
            ]}
          />
        </div>

        <div className="analytics-grid">
          {trendFocus === "monthly" ? (
            <>
              {charts.reviewTypeByMonth.length ? (
                <section className="chart-card chart-card-wide">
                  <div className="chart-card-heading">
                    <h4>Review path by month</h4>
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
                              style={{
                                height: `${Math.max(
                                  6,
                                  Math.round((item.total / reviewTypeByMonthMax) * 100)
                                )}%`,
                              }}
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
                  title="Review path by month"
                  message="Select a single academic year to compare review-path trends by month."
                />
              )}

              {monthlyItems.length ? (
                <section className="chart-card">
                  <div className="chart-card-heading chart-card-heading-inline">
                    <div>
                      <h4>{monthlyTitle}</h4>
                      <p>Switch between intake and withdrawals without adding another chart wall.</p>
                    </div>
                    <SegmentControl
                      ariaLabel="Monthly volume focus"
                      value={monthlyVolumeFocus}
                      onChange={(next) =>
                        setMonthlyVolumeFocus(next as "received" | "withdrawn")
                      }
                      options={[
                        { label: "Received", value: "received" },
                        {
                          label: "Withdrawn",
                          value: "withdrawn",
                          disabled: charts.withdrawnByMonth.length === 0,
                        },
                      ]}
                    />
                  </div>
                  <div className="v-chart-shell compact">
                    <div className="v-chart">
                      {monthlyItems.map((item) => (
                        <div key={`${monthlyVolumeFocus}-${item.label}`} className="v-bar-item">
                          <strong>{item.count}</strong>
                          <div className="v-bar-track">
                            <div
                              className={`v-bar-fill ${
                                monthlyVolumeFocus === "withdrawn" ? "tone-withdrawn" : ""
                              }`}
                              style={{
                                height: `${Math.max(6, Math.round((item.count / monthlyMax) * 100))}%`,
                              }}
                            />
                          </div>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ) : (
                <ChartEmpty title={monthlyTitle} message={monthlyMessage} />
              )}
            </>
          ) : (
            <>
              <section className="chart-card chart-card-wide">
                <div className="chart-card-heading">
                  <h4>Comparative by academic year</h4>
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
                    <h4>Committee distribution</h4>
                    <p>Available only when the scope includes more than one committee.</p>
                  </div>
                  <div className="h-bars">
                    {charts.committeeDistribution.map((item) => (
                      <div key={item.label} className="h-bar-item">
                        <span>{item.label}</span>
                        <div className="h-bar-track">
                          <div
                            className="h-bar-fill"
                            style={{
                              width: `${Math.max(3, Math.round((item.count / committeeMax) * 100))}%`,
                            }}
                          />
                        </div>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <ChartEmpty
                  title="Committee distribution"
                  message="Committee comparison becomes available when the report scope includes more than one committee."
                />
              )}
            </>
          )}
        </div>
      </section>

      <section className="analytics-section">
        <div className="analytics-section-header">
          <div>
            <h4>Performance</h4>
            <p>Keep turnaround metrics visible, then switch the operational detail underneath.</p>
          </div>
          <SegmentControl
            ariaLabel="Performance detail focus"
            value={performanceFocus}
            onChange={(next) => setPerformanceFocus(next as "sla" | "workflow")}
            options={[
              { label: "SLA compliance", value: "sla" },
              { label: "Workflow reach", value: "workflow" },
            ]}
          />
        </div>

        <div className="analytics-grid">
          <section className="chart-card chart-card-wide">
            <div className="chart-card-heading">
              <h4>Average turnaround</h4>
              <p>Results and clearance values are measured in working days.</p>
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

          {performanceFocus === "sla" ? (
            <section className="chart-card chart-card-wide">
              <div className="chart-card-heading">
                <h4>Within SLA vs overdue</h4>
                <p>Stage compliance uses the configured committee SLA.</p>
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
                            width: `${Math.max(0, total > 0 ? (item.within / total) * 100 : 0)}%`,
                          }}
                          title={`Within SLA: ${item.within}`}
                        />
                        <div
                          className="stack-segment tone-overdue"
                          style={{
                            width: `${Math.max(0, total > 0 ? (item.overdue / total) * 100 : 0)}%`,
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
          ) : (
            <section className="chart-card chart-card-wide">
              <div className="chart-card-heading">
                <h4>Workflow stage reach</h4>
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
          )}
        </div>
      </section>
    </div>
  );
}
