const formatNumber = (value: number) => value.toLocaleString("en-US");
const formatSignedNumber = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString("en-US")}`;
const formatDeltaPercent = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? "0%" : "New";
  const percentage = ((current - previous) / previous) * 100;
  const rounded = Math.round(Math.abs(percentage));
  return `${percentage > 0 ? "+" : percentage < 0 ? "−" : ""}${rounded}%`;
};

const CATEGORY_LABELS = {
  UNDERGRAD: "Undergraduate",
  GRAD: "Graduate",
  FACULTY: "Faculty",
  NON_TEACHING: "Non-teaching / Staff",
} as const;

type ReportSummaryCardsProps = {
  received: number;
  exempted: number;
  expedited: number;
  fullReview: number;
  withdrawn: number;
  asOfLabel?: string | null;
  comparisonLabel?: string | null;
  comparisonCounts?: {
    received: number;
    exempted: number;
    expedited: number;
    fullReview: number;
    withdrawn: number;
  } | null;
  sourceCounts?: {
    nativePortal: number;
    legacyImport: number;
  } | null;
  byCategory: {
    UNDERGRAD: number;
    GRAD: number;
    FACULTY: number;
    NON_TEACHING: number;
  };
};

export default function ReportSummaryCards({
  received,
  exempted,
  expedited,
  fullReview,
  withdrawn,
  asOfLabel,
  comparisonLabel,
  comparisonCounts,
  sourceCounts,
  byCategory,
}: ReportSummaryCardsProps) {
  const secondaryCards = [
    {
      label: "Exempt",
      value: exempted,
      tone: "layout-status-1",
      compareValue: comparisonCounts?.exempted ?? null,
      detail: received ? `${Math.round((exempted / received) * 100)}% of received` : "No submissions yet",
    },
    {
      label: "Expedited",
      value: expedited,
      tone: "layout-status-2",
      compareValue: comparisonCounts?.expedited ?? null,
      detail: received ? `${Math.round((expedited / received) * 100)}% of received` : "No submissions yet",
    },
    {
      label: "Full review",
      value: fullReview,
      tone: "layout-status-3",
      compareValue: comparisonCounts?.fullReview ?? null,
      detail: received ? `${Math.round((fullReview / received) * 100)}% of received` : "No submissions yet",
    },
  ];

  const categoryBreakdown = (
    Object.entries(byCategory) as Array<[keyof typeof CATEGORY_LABELS, number]>
  ).map(([key, value]) => ({
    key,
    label: CATEGORY_LABELS[key],
    value,
    percentage: received > 0 ? Math.round((value / received) * 100) : 0,
  }));

  return (
    <section className="report-summary-cards" aria-label="Report summary">
      <article className="report-summary-primary-card layout-total">
        <div className="report-summary-primary-topline">
          <span className="report-summary-label">Total received</span>
          <span className="report-summary-muted">
            {asOfLabel ? asOfLabel : withdrawn > 0 ? `${formatNumber(withdrawn)} withdrawn` : "No withdrawn submissions"}
          </span>
        </div>
        <strong>{formatNumber(received)}</strong>
        <p>
          {comparisonCounts && comparisonLabel
            ? `${formatSignedNumber(received - comparisonCounts.received)} vs ${comparisonLabel} (${formatDeltaPercent(
                received,
                comparisonCounts.received
              )}).`
            : "All submissions included in the current reporting scope."}
        </p>
        {sourceCounts ? (
          <p className="report-summary-source-note">
            Includes {formatNumber(sourceCounts.legacyImport)} legacy imported record{sourceCounts.legacyImport === 1 ? "" : "s"} and {formatNumber(sourceCounts.nativePortal)} native portal submission{sourceCounts.nativePortal === 1 ? "" : "s"}.
          </p>
        ) : null}

        <div className="report-summary-category-list" aria-label="Proponent category mix">
          {categoryBreakdown.map((item) => (
            <div key={item.key} className="report-summary-category-row">
              <div>
                <span>{item.label}</span>
                <small>{item.percentage}% of received</small>
              </div>
              <strong>{formatNumber(item.value)}</strong>
            </div>
          ))}
        </div>
      </article>

      <div className="report-summary-secondary-grid">
        {secondaryCards.map((card) => (
          <article key={card.label} className={`report-summary-card ${card.tone}`}>
            <span>{card.label}</span>
            <strong>{formatNumber(card.value)}</strong>
            <p>
              {card.detail}
              {comparisonLabel && card.compareValue !== null
                ? ` · ${formatSignedNumber(card.value - card.compareValue)} vs ${comparisonLabel}`
                : ""}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
