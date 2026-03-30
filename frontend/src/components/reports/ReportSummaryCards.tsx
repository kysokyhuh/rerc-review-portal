const formatNumber = (value: number) => value.toLocaleString("en-US");

type ReportSummaryCardsProps = {
  received: number;
  exempted: number;
  expedited: number;
  fullReview: number;
  withdrawn: number;
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
  withdrawn: _withdrawn,
  byCategory: _byCategory,
}: ReportSummaryCardsProps) {
  void _withdrawn;
  void _byCategory;
  const cards = [
    { label: "Received", value: received, tone: "layout-total" },
    { label: "Exempted", value: exempted, tone: "layout-status-1" },
    { label: "Expedited", value: expedited, tone: "layout-status-2" },
    { label: "Full Review", value: fullReview, tone: "layout-status-3" },
  ];

  return (
    <section className="report-summary-cards" aria-label="Report summary">
      {cards.map((card) => (
        <article key={card.label} className={`report-summary-card ${card.tone}`}>
          <span>{card.label}</span>
          <strong>{formatNumber(card.value)}</strong>
        </article>
      ))}
    </section>
  );
}
