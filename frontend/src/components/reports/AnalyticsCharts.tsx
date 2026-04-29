import { useState, type CSSProperties, type ReactNode } from "react";
import type { AnnualReportSummaryResponse } from "@/types";

export type AnalyticsGraphType = "bar" | "line" | "donut";

type AnalyticsChartsProps = {
  summary: AnnualReportSummaryResponse;
  graphType: AnalyticsGraphType;
  showGraphSelector?: boolean;
  onGraphTypeChange?: (value: AnalyticsGraphType) => void;
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

type GraphPresentation = {
  family: AnalyticsGraphType;
  label: string;
};

type HorizontalBarItem = {
  key: string;
  label: string;
  count: number;
  disabled?: boolean;
  toneClassName?: string;
  onClick?: () => void;
};

type VerticalBarItem = {
  key: string;
  label: string;
  count: number;
  toneClassName?: string;
};

type StackedSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
  className?: string;
};

type StackedRowItem = {
  key: string;
  label: string;
  total: number;
  metaLabel?: string;
  caption?: string;
  emptyStateLabel?: string;
  segments: StackedSegment[];
};

type StackedColumnItem = {
  key: string;
  label: string;
  total: number;
  segments: StackedSegment[];
};

type DonutItem = {
  key: string;
  label: string;
  count: number;
  color: string;
  disabled?: boolean;
  onClick?: () => void;
};

type LineSeriesMeta = {
  key: string;
  label: string;
  color: string;
};

type LineChartItem = {
  label: string;
  values: Record<string, number>;
};

const GRAPH_TYPE_LABELS: Record<AnalyticsGraphType, string> = {
  bar: "Bar",
  line: "Line",
  donut: "Donut",
};

const GRAPH_OPTIONS = [
  { label: "Bar", value: "bar" },
  { label: "Line", value: "line" },
  { label: "Donut", value: "donut" },
] as const;

const CATEGORY_COLORS: Record<
  "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING",
  string
> = {
  UNDERGRAD: "#2f7a54",
  GRAD: "#5577b0",
  FACULTY: "#d18b2f",
  NON_TEACHING: "#879a6d",
};

const outcomeMeta = {
  exempted: { label: "Exempted", className: "tone-exempt", color: "#2f7a54" },
  expedited: { label: "Expedited", className: "tone-expedited", color: "#d18b2f" },
  fullReview: { label: "Full review", className: "tone-full", color: "#5577b0" },
  withdrawn: { label: "Withdrawn", className: "tone-withdrawn", color: "#b76161" },
  unclassified: { label: "Unclassified", className: "tone-unclassified", color: "#97a2b0" },
} as const;

const phase2Keys = ["exempted", "expedited", "fullReview", "withdrawn", "unclassified"] as const;
const comparativeKeys = ["exempted", "expedited", "fullReview", "withdrawn"] as const;
const performanceMeta = {
  within: { label: "Within SLA", className: "tone-within", color: "#2f7a54" },
  overdue: { label: "Overdue", className: "tone-overdue", color: "#d9643b" },
} as const;
const MONTHLY_RECEIVED_COLOR = "#2f7a54";
const MONTHLY_WITHDRAWN_COLOR = "#b76161";

const horizontalBarGraph: GraphPresentation = { family: "bar", label: "horizontal bar" };
const verticalBarGraph: GraphPresentation = { family: "bar", label: "bar" };
const stackedBarGraph: GraphPresentation = { family: "bar", label: "stacked bar" };
const lineGraph: GraphPresentation = { family: "line", label: "line" };
const donutGraph: GraphPresentation = { family: "donut", label: "donut" };

const maxOf = (arr: Array<{ count: number }>) =>
  arr.length ? Math.max(...arr.map((item) => item.count), 1) : 1;

const scaleToPercent = (value: number, maxValue: number, minimum = 3) => {
  if (value <= 0 || maxValue <= 0) return 0;
  return Math.max(minimum, Math.round((value / maxValue) * 100));
};

const isOthersLabel = (value: string) =>
  /^others?\b/i.test(value.trim()) || /^other\b/i.test(value.trim());

const toCollegeLabel = (value: string) => (isOthersLabel(value) ? "Other units" : value);

const formatDays = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? `${value} days` : `${value.toFixed(1)} days`;
};

const toReviewTypeDrilldown = (label: string) => {
  if (label === "Exempted") return "EXEMPT";
  if (label === "Expedited") return "EXPEDITED";
  if (label === "Full Review") return "FULL_BOARD";
  return undefined;
};

const segmentStyle = (value: number, total: number) =>
  ({
    width: `${total > 0 ? (value / total) * 100 : 0}%`,
  }) as CSSProperties;

const stackedHeightStyle = (value: number, total: number) =>
  ({
    height: `${total > 0 ? (value / total) * 100 : 0}%`,
  }) as CSSProperties;

const buildDonutBackground = (items: DonutItem[]) => {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  if (total <= 0) {
    return "conic-gradient(#dfe9e2 0deg 360deg)";
  }

  let cursor = 0;
  const stops = items
    .filter((item) => item.count > 0)
    .map((item) => {
      const start = cursor;
      cursor += (item.count / total) * 360;
      return `${item.color} ${start}deg ${cursor}deg`;
    });

  return `conic-gradient(${stops.join(", ")})`;
};

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

function ChartFallbackChip({
  requestedGraph,
  effectiveGraph,
}: {
  requestedGraph: AnalyticsGraphType;
  effectiveGraph: GraphPresentation;
}) {
  if (requestedGraph === effectiveGraph.family) return null;

  return <span className="chart-fallback-chip">Using {effectiveGraph.label}</span>;
}

function ChartHeading({
  title,
  description,
  requestedGraph,
  effectiveGraph,
  actions,
}: {
  title: string;
  description: string;
  requestedGraph: AnalyticsGraphType;
  effectiveGraph: GraphPresentation;
  actions?: ReactNode;
}) {
  const showActions = Boolean(actions) || requestedGraph !== effectiveGraph.family;

  return (
    <div className={`chart-card-heading ${showActions ? "chart-card-heading-inline" : ""}`}>
      <div>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      {showActions ? (
        <div className="chart-card-heading-actions">
          <ChartFallbackChip
            requestedGraph={requestedGraph}
            effectiveGraph={effectiveGraph}
          />
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function HorizontalBarChart({ items }: { items: HorizontalBarItem[] }) {
  const maxValue = maxOf(items.map((item) => ({ count: item.count })));

  return (
    <div className="h-bars">
      {items.map((item) => {
        const content = (
          <>
            <span>{item.label}</span>
            <div className="h-bar-track">
              <div
                className={`h-bar-fill ${item.toneClassName ?? ""}`}
                style={{ width: `${scaleToPercent(item.count, maxValue)}%` }}
              />
            </div>
            <strong>{item.count}</strong>
          </>
        );

        if (item.onClick || item.disabled) {
          return (
            <button
              key={item.key}
              type="button"
              className="h-bar-item chart-action"
              onClick={item.onClick}
              disabled={item.disabled}
            >
              {content}
            </button>
          );
        }

        return (
          <div key={item.key} className="h-bar-item">
            {content}
          </div>
        );
      })}
    </div>
  );
}

function VerticalBarChart({
  items,
  compact = false,
}: {
  items: VerticalBarItem[];
  compact?: boolean;
}) {
  const maxValue = maxOf(items.map((item) => ({ count: item.count })));

  return (
    <div className={`v-chart-shell ${compact ? "compact" : ""}`}>
      <div className="v-chart">
        {items.map((item) => (
          <div key={item.key} className="v-bar-item">
            <strong>{item.count}</strong>
            <div className="v-bar-track">
              <div
                className={`v-bar-fill ${item.toneClassName ?? ""}`}
                style={{ height: `${scaleToPercent(item.count, maxValue, 6)}%` }}
              />
            </div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StackedVerticalBarChart({ items }: { items: StackedColumnItem[] }) {
  const maxValue = maxOf(items.map((item) => ({ count: item.total })));

  return (
    <div className="v-chart-shell">
      <div className="stacked-v-chart">
        {items.map((item) => (
          <div key={item.key} className="stacked-v-item">
            <strong>{item.total}</strong>
            <div className="stacked-v-track">
              <div
                className="stacked-v-fill"
                style={{ height: `${scaleToPercent(item.total, maxValue, 6)}%` }}
              >
                {item.segments.map((segment) =>
                  segment.value > 0 ? (
                    <div
                      key={segment.key}
                      className={`stack-segment ${segment.className ?? ""}`}
                      style={stackedHeightStyle(segment.value, item.total)}
                      title={`${segment.label}: ${segment.value}`}
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
  );
}

function StackedRowsChart({
  items,
  legend,
}: {
  items: StackedRowItem[];
  legend?: Array<{ key: string; label: string; className?: string; color: string }>;
}) {
  return (
    <>
      <div className="stacked-rows">
        {items.map((item) => {
          const visibleSegments = item.segments.filter((segment) => segment.value > 0);
          const isEmpty = item.total <= 0 || visibleSegments.length === 0;

          return (
            <div key={item.key} className="stacked-row">
              <div className="stacked-row-meta">
                <span>{item.label}</span>
                <strong>{item.total}</strong>
                {item.metaLabel ? (
                  <small className="stacked-row-total-note">{item.metaLabel}</small>
                ) : null}
              </div>
              <div
                className={`stacked-row-track ${isEmpty ? "stacked-row-track-empty" : ""}`}
              >
                {isEmpty ? (
                  <span className="stacked-row-empty-label">
                    {item.emptyStateLabel ?? "No records in this report scope."}
                  </span>
                ) : (
                  visibleSegments.map((segment) => (
                    <div
                      key={segment.key}
                      className={`stack-segment ${segment.className ?? ""}`}
                      style={segmentStyle(segment.value, Math.max(item.total, 1))}
                      title={`${segment.label}: ${segment.value}`}
                    />
                  ))
                )}
              </div>
              {item.caption ? <span className="stacked-row-caption">{item.caption}</span> : null}
            </div>
          );
        })}
      </div>
      {legend?.length ? (
        <div className="stacked-legend">
          {legend.map((item) => (
            <span key={item.key} className="legend-chip">
              <i
                className={`legend-dot ${item.className ?? ""}`}
                style={{ background: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}

function DonutChart({ items }: { items: DonutItem[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="donut-chart-shell">
      <div
        className="donut-chart-visual"
        style={{ background: buildDonutBackground(items) }}
        aria-hidden="true"
      >
        <div className="donut-chart-center">
          <span>Total</span>
          <strong>{total}</strong>
        </div>
      </div>

      <div className="donut-legend">
        {items.map((item) => {
          const row = (
            <>
              <span className="donut-legend-label">
                <i className="legend-dot" style={{ background: item.color }} />
                {item.label}
              </span>
              <strong>{item.count}</strong>
            </>
          );

          if (item.onClick || item.disabled) {
            return (
              <button
                key={item.key}
                type="button"
                className="donut-legend-item chart-action"
                onClick={item.onClick}
                disabled={item.disabled}
              >
                {row}
              </button>
            );
          }

          return (
            <div key={item.key} className="donut-legend-item">
              {row}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineChart({
  items,
  series,
  compact = false,
}: {
  items: LineChartItem[];
  series: LineSeriesMeta[];
  compact?: boolean;
}) {
  const visibleSeries =
    series.filter((meta) => items.some((item) => (item.values[meta.key] ?? 0) > 0)) || series;
  const normalizedSeries = visibleSeries.length ? visibleSeries : series;
  const maxValue = Math.max(
    1,
    ...items.flatMap((item) =>
      normalizedSeries.map((meta) => item.values[meta.key] ?? 0)
    )
  );
  const width = Math.max(360, items.length * 88);
  const height = compact ? 232 : 260;
  const padding = { top: 18, right: 18, bottom: 16, left: 18 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const tickFractions = [0, 0.25, 0.5, 0.75, 1];
  const xFor = (index: number) =>
    items.length === 1
      ? padding.left + plotWidth / 2
      : padding.left + (index / (items.length - 1)) * plotWidth;
  const yFor = (value: number) =>
    padding.top + plotHeight - (value / maxValue) * plotHeight;

  return (
    <>
      <div className={`line-chart-shell ${compact ? "compact" : ""}`}>
        <svg
          className="line-chart"
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          {tickFractions.map((fraction) => {
            const y = padding.top + plotHeight - plotHeight * fraction;
            return (
              <line
                key={fraction}
                className="line-grid-line"
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
              />
            );
          })}

          {normalizedSeries.map((meta) => {
            const points = items
              .map((item, index) => `${xFor(index)},${yFor(item.values[meta.key] ?? 0)}`)
              .join(" ");

            return (
              <g key={meta.key}>
                <polyline
                  className="line-series-path"
                  points={points}
                  fill="none"
                  stroke={meta.color}
                />
                {items.map((item, index) => (
                  <circle
                    key={`${meta.key}-${item.label}`}
                    className="line-series-point"
                    cx={xFor(index)}
                    cy={yFor(item.values[meta.key] ?? 0)}
                    r="4"
                    fill={meta.color}
                  />
                ))}
              </g>
            );
          })}
        </svg>

        <div
          className="line-axis-labels"
          style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(72px, 1fr))` }}
        >
          {items.map((item) => (
            <span key={item.label}>{item.label}</span>
          ))}
        </div>
      </div>

      {normalizedSeries.length > 1 ? (
        <div className="stacked-legend">
          {normalizedSeries.map((meta) => (
            <span key={meta.key} className="legend-chip">
              <i className="legend-dot" style={{ background: meta.color }} />
              {meta.label}
            </span>
          ))}
        </div>
      ) : null}
    </>
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

export default function AnalyticsCharts({
  summary,
  graphType,
  showGraphSelector = true,
  onGraphTypeChange,
  onDrilldown,
}: AnalyticsChartsProps) {
  const [volumeFocus, setVolumeFocus] = useState<"composition" | "institutions">("composition");
  const [trendFocus, setTrendFocus] = useState<"monthly" | "comparison">("monthly");
  const [monthlyVolumeFocus, setMonthlyVolumeFocus] = useState<"received" | "withdrawn">("received");
  const [performanceFocus, setPerformanceFocus] = useState<"sla" | "workflow">("sla");

  const { charts, performanceCharts } = summary;
  const topReceivedInstitutions = [...charts.receivedByCollege]
    .sort((a, b) => {
      const aOther = isOthersLabel(a.label);
      const bOther = isOthersLabel(b.label);
      if (aOther && !bOther) return 1;
      if (!aOther && bOther) return -1;
      return b.count - a.count;
    })
    .slice(0, 5);
  const topOutcomeInstitutions = [...charts.outcomeByCollege]
    .sort((a, b) => {
      const aOther = isOthersLabel(a.label);
      const bOther = isOthersLabel(b.label);
      if (aOther && !bOther) return 1;
      if (!aOther && bOther) return -1;
      return b.total - a.total;
    })
    .slice(0, 5);
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

  const categoryGraph = graphType === "donut" ? donutGraph : horizontalBarGraph;
  const reviewGraph = graphType === "donut" ? donutGraph : horizontalBarGraph;
  const institutionsGraph = graphType === "donut" ? donutGraph : horizontalBarGraph;
  const institutionOutcomeGraph = stackedBarGraph;
  const reviewPathByMonthGraph = graphType === "line" ? lineGraph : stackedBarGraph;
  const monthlyVolumeGraph = graphType === "line" ? lineGraph : verticalBarGraph;
  const comparativeGraph = graphType === "line" ? lineGraph : stackedBarGraph;
  const committeeGraph = graphType === "donut" ? donutGraph : horizontalBarGraph;
  const slaGraph = stackedBarGraph;
  const workflowGraph = horizontalBarGraph;

  const monthlyItems =
    monthlyVolumeFocus === "withdrawn" ? charts.withdrawnByMonth : charts.receivedByMonth;
  const monthlyTitle =
    monthlyVolumeFocus === "withdrawn"
      ? "Withdrawn proposals by month"
      : "Received proposals by month";
  const monthlyMessage =
    monthlyVolumeFocus === "withdrawn"
      ? "Monthly withdrawal trends are shown only when one academic or calendar year is selected."
      : "Select a single academic or calendar year to view monthly received proposals.";
  const monthlyColor =
    monthlyVolumeFocus === "withdrawn" ? MONTHLY_WITHDRAWN_COLOR : MONTHLY_RECEIVED_COLOR;

  const categoryBarItems: HorizontalBarItem[] = charts.proponentCategoryDistribution.map((item) => ({
    key: item.category,
    label: item.label,
    count: item.count,
  }));
  const categoryDonutItems: DonutItem[] = charts.proponentCategoryDistribution.map((item) => ({
    key: item.category,
    label: item.label,
    count: item.count,
    color: CATEGORY_COLORS[item.category],
  }));
  const reviewDistributionBarItems: HorizontalBarItem[] = charts.reviewTypeDistribution.map((item) => ({
    key: item.label,
    label: item.label,
    count: item.count,
    onClick: () => {
      const reviewType = toReviewTypeDrilldown(item.label);
      onDrilldown(reviewType ? { reviewType } : {});
    },
  }));
  const reviewDistributionDonutItems: DonutItem[] = charts.reviewTypeDistribution.map((item) => ({
    key: item.label,
    label: item.label,
    count: item.count,
    color:
      item.label === "Exempted"
        ? outcomeMeta.exempted.color
        : item.label === "Expedited"
        ? outcomeMeta.expedited.color
        : item.label === "Full Review"
        ? outcomeMeta.fullReview.color
        : item.label === "Withdrawn"
        ? outcomeMeta.withdrawn.color
        : outcomeMeta.unclassified.color,
    onClick: () => {
      const reviewType = toReviewTypeDrilldown(item.label);
      onDrilldown(reviewType ? { reviewType } : {});
    },
  }));
  const topInstitutionBarItems: HorizontalBarItem[] = topReceivedInstitutions.map((item) => ({
    key: item.label,
    label: toCollegeLabel(item.label),
    count: item.count,
    disabled: isOthersLabel(item.label),
    onClick: () => onDrilldown({ college: item.label }),
  }));
  const topInstitutionDonutItems: DonutItem[] = topReceivedInstitutions.map((item) => ({
    key: item.label,
    label: toCollegeLabel(item.label),
    count: item.count,
    color: CATEGORY_COLORS[
      (["UNDERGRAD", "GRAD", "FACULTY", "NON_TEACHING"][
        topReceivedInstitutions.indexOf(item) % 4
      ] ?? "UNDERGRAD") as "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING"
    ],
    disabled: isOthersLabel(item.label),
    onClick: () => onDrilldown({ college: item.label }),
  }));
  const outcomeRows: StackedRowItem[] = topOutcomeInstitutions.map((item) => ({
    key: item.label,
    label: toCollegeLabel(item.label),
    total: item.total,
    segments: phase2Keys.map((key) => ({
      key: `${item.label}-${key}`,
      label: outcomeMeta[key].label,
      value: item[key],
      color: outcomeMeta[key].color,
      className: outcomeMeta[key].className,
    })),
  }));
  const outcomeLegend = phase2Keys.map((key) => ({
    key,
    label: outcomeMeta[key].label,
    color: outcomeMeta[key].color,
    className: outcomeMeta[key].className,
  }));
  const reviewPathByMonthColumns: StackedColumnItem[] = charts.reviewTypeByMonth.map((item) => ({
    key: item.label,
    label: item.label,
    total: item.total,
    segments: phase2Keys.map((key) => ({
      key: `${item.label}-${key}`,
      label: outcomeMeta[key].label,
      value: item[key],
      color: outcomeMeta[key].color,
      className: outcomeMeta[key].className,
    })),
  }));
  const reviewPathByMonthSeries: LineSeriesMeta[] = phase2Keys.map((key) => ({
    key,
    label: outcomeMeta[key].label,
    color: outcomeMeta[key].color,
  }));
  const reviewPathByMonthLineItems: LineChartItem[] = charts.reviewTypeByMonth.map((item) => ({
    label: item.label,
    values: phase2Keys.reduce<Record<string, number>>((accumulator, key) => {
      accumulator[key] = item[key];
      return accumulator;
    }, {}),
  }));
  const monthlyBarItems: VerticalBarItem[] = monthlyItems.map((item) => ({
    key: `${monthlyVolumeFocus}-${item.label}`,
    label: item.label,
    count: item.count,
    toneClassName: monthlyVolumeFocus === "withdrawn" ? "tone-withdrawn" : "",
  }));
  const monthlyLineItems: LineChartItem[] = monthlyItems.map((item) => ({
    label: item.label,
    values: { total: item.count },
  }));
  const monthlyLineSeries: LineSeriesMeta[] = [
    {
      key: "total",
      label: monthlyVolumeFocus === "withdrawn" ? "Withdrawn" : "Received",
      color: monthlyColor,
    },
  ];
  const comparativeRows: StackedRowItem[] = charts.comparativeYearTrend.map((item) => ({
    key: item.label,
    label: item.label,
    total: item.exempted + item.expedited + item.fullReview + item.withdrawn,
    segments: comparativeKeys.map((key) => ({
      key: `${item.label}-${key}`,
      label: outcomeMeta[key].label,
      value: item[key],
      color: outcomeMeta[key].color,
      className: outcomeMeta[key].className,
    })),
  }));
  const comparativeLineSeries: LineSeriesMeta[] = comparativeKeys.map((key) => ({
    key,
    label: outcomeMeta[key].label,
    color: outcomeMeta[key].color,
  }));
  const comparativeLineItems: LineChartItem[] = charts.comparativeYearTrend.map((item) => ({
    label: item.label,
    values: comparativeKeys.reduce<Record<string, number>>((accumulator, key) => {
      accumulator[key] = item[key];
      return accumulator;
    }, {}),
  }));
  const committeeBarItems: HorizontalBarItem[] = charts.committeeDistribution.map((item) => ({
    key: item.label,
    label: item.label,
    count: item.count,
  }));
  const committeeDonutItems: DonutItem[] = charts.committeeDistribution.map((item, index) => ({
    key: item.label,
    label: item.label,
    count: item.count,
    color: Object.values(CATEGORY_COLORS)[index % Object.values(CATEGORY_COLORS).length],
  }));
  const slaRows: StackedRowItem[] = performanceCharts.slaCompliance.map((item) => ({
    key: item.label,
    label: item.label,
    total: item.within + item.overdue,
    metaLabel: `${item.within + item.overdue} evaluated`,
    caption: `Within SLA: ${item.within} • Overdue: ${item.overdue}`,
    emptyStateLabel: `No ${item.label.toLowerCase()} records in this report scope.`,
    segments: [
      {
        key: `${item.label}-within`,
        label: performanceMeta.within.label,
        value: item.within,
        color: performanceMeta.within.color,
        className: performanceMeta.within.className,
      },
      {
        key: `${item.label}-overdue`,
        label: performanceMeta.overdue.label,
        value: item.overdue,
        color: performanceMeta.overdue.color,
        className: performanceMeta.overdue.className,
      },
    ],
  }));
  const workflowBarItems: HorizontalBarItem[] = performanceCharts.workflowFunnel.map((item) => ({
    key: item.label,
    label: item.label,
    count: item.count,
  }));

  return (
    <div className="analytics-layout">
      <section className="analytics-global-controls">
        <div>
          <span className="section-kicker">Graph style</span>
          <h4>Choose one chart style for the analytics view.</h4>
          <p>Bar is the default. Sections that do not support line or donut fall back automatically.</p>
        </div>
        {showGraphSelector && onGraphTypeChange ? (
          <SegmentControl
            ariaLabel="Analytics graph style"
            value={graphType}
            onChange={(value) => onGraphTypeChange(value as AnalyticsGraphType)}
            options={GRAPH_OPTIONS.map((option) => ({ ...option }))}
          />
        ) : (
          <span className="chart-fallback-chip analytics-graph-badge">
            Graph style: {GRAPH_TYPE_LABELS[graphType]}
          </span>
        )}
      </section>

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
                <ChartHeading
                  title="Proponent category mix"
                  description="Current applicant mix across the selected report scope."
                  requestedGraph={graphType}
                  effectiveGraph={categoryGraph}
                />
                {categoryGraph.family === "donut" ? (
                  <DonutChart items={categoryDonutItems} />
                ) : (
                  <HorizontalBarChart items={categoryBarItems} />
                )}
              </section>

              <section className="chart-card">
                <ChartHeading
                  title="Review path distribution"
                  description="Use this to see which pathway dominates before opening deeper comparisons."
                  requestedGraph={graphType}
                  effectiveGraph={reviewGraph}
                />
                {reviewGraph.family === "donut" ? (
                  <DonutChart items={reviewDistributionDonutItems} />
                ) : (
                  <HorizontalBarChart items={reviewDistributionBarItems} />
                )}
              </section>
            </>
          ) : (
            <>
              <section className="chart-card chart-card-wide">
                <ChartHeading
                  title="Outcome mix across top institutions"
                  description="Showing the top 5 units by filtered volume to keep the comparison readable."
                  requestedGraph={graphType}
                  effectiveGraph={institutionOutcomeGraph}
                />
                <StackedRowsChart items={outcomeRows} legend={outcomeLegend} />
              </section>

              <section className="chart-card">
                <ChartHeading
                  title="Top colleges by received"
                  description="Showing the top 5 institutions in the current scope."
                  requestedGraph={graphType}
                  effectiveGraph={institutionsGraph}
                />
                {institutionsGraph.family === "donut" ? (
                  <DonutChart items={topInstitutionDonutItems} />
                ) : (
                  <HorizontalBarChart items={topInstitutionBarItems} />
                )}
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
                  <ChartHeading
                    title="Review path by month"
                    description="Exclusive monthly trend, including unclassified proposals where applicable."
                    requestedGraph={graphType}
                    effectiveGraph={reviewPathByMonthGraph}
                  />
                  {reviewPathByMonthGraph.family === "line" ? (
                    <LineChart items={reviewPathByMonthLineItems} series={reviewPathByMonthSeries} />
                  ) : (
                    <>
                      <StackedVerticalBarChart items={reviewPathByMonthColumns} />
                      <div className="stacked-legend">
                        {outcomeLegend.map((item) => (
                          <span key={item.key} className="legend-chip">
                            <i
                              className={`legend-dot ${item.className ?? ""}`}
                              style={{ background: item.color }}
                            />
                            {item.label}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              ) : (
                <ChartEmpty
                  title="Review path by month"
                  message="Select a single academic or calendar year to compare review-path trends by month."
                />
              )}

              {monthlyItems.length ? (
                <section className="chart-card">
                  <ChartHeading
                    title={monthlyTitle}
                    description="Switch between intake and withdrawals without adding another chart wall."
                    requestedGraph={graphType}
                    effectiveGraph={monthlyVolumeGraph}
                    actions={
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
                    }
                  />
                  {monthlyVolumeGraph.family === "line" ? (
                    <LineChart items={monthlyLineItems} series={monthlyLineSeries} compact />
                  ) : (
                    <VerticalBarChart items={monthlyBarItems} compact />
                  )}
                </section>
              ) : (
                <ChartEmpty title={monthlyTitle} message={monthlyMessage} />
              )}
            </>
          ) : (
            <>
              <section className="chart-card chart-card-wide">
                <ChartHeading
                  title="Comparative year trend"
                  description="Yearly totals aggregated from the comparative proponent tables."
                  requestedGraph={graphType}
                  effectiveGraph={comparativeGraph}
                />
                {comparativeGraph.family === "line" ? (
                  <LineChart items={comparativeLineItems} series={comparativeLineSeries} />
                ) : (
                  <StackedRowsChart
                    items={comparativeRows}
                    legend={comparativeKeys.map((key) => ({
                      key,
                      label: outcomeMeta[key].label,
                      color: outcomeMeta[key].color,
                      className: outcomeMeta[key].className,
                    }))}
                  />
                )}
              </section>

              {charts.committeeDistribution.length > 1 ? (
                <section className="chart-card">
                  <ChartHeading
                    title="Committee distribution"
                    description="Available only when the scope includes more than one committee."
                    requestedGraph={graphType}
                    effectiveGraph={committeeGraph}
                  />
                  {committeeGraph.family === "donut" ? (
                    <DonutChart items={committeeDonutItems} />
                  ) : (
                    <HorizontalBarChart items={committeeBarItems} />
                  )}
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
              <ChartHeading
                title="Service Level Agreement (SLA) compliance by stage"
                description="Includes completed and still-open stages measured against the configured committee SLA."
                requestedGraph={graphType}
                effectiveGraph={slaGraph}
              />
              <div className="chart-context-note">
                Green shows records still within target. Orange shows records that exceeded the target days. Empty rows mean no qualifying records were counted for that stage in the current report scope.
              </div>
              <StackedRowsChart
                items={slaRows}
                legend={[
                  {
                    key: "within",
                    label: performanceMeta.within.label,
                    color: performanceMeta.within.color,
                    className: performanceMeta.within.className,
                  },
                  {
                    key: "overdue",
                    label: performanceMeta.overdue.label,
                    color: performanceMeta.overdue.color,
                    className: performanceMeta.overdue.className,
                  },
                ]}
              />
            </section>
          ) : (
            <section className="chart-card chart-card-wide">
              <ChartHeading
                title="Workflow stage reach"
                description="Counts show how many filtered submissions reached each lifecycle stage at least once."
                requestedGraph={graphType}
                effectiveGraph={workflowGraph}
              />
              <HorizontalBarChart items={workflowBarItems} />
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
