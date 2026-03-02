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
  withdrawn,
  byCategory,
}: ReportSummaryCardsProps) {
  const cards = [
    { label: "Total Proposals Received", value: received, tone: "tone-emerald", layout: "layout-total" },
    { label: "Exempted", value: exempted, tone: "tone-amber", layout: "layout-status-1" },
    { label: "Expedited", value: expedited, tone: "tone-sky", layout: "layout-status-2" },
    { label: "Full Review", value: fullReview, tone: "tone-violet", layout: "layout-status-3" },
    { label: "Withdrawn", value: withdrawn, tone: "tone-rose", layout: "layout-status-4" },
    { label: "UNDERGRADUATE", value: byCategory.UNDERGRAD, tone: "tone-lime", layout: "layout-proponent-1" },
    { label: "GRADUATE", value: byCategory.GRAD, tone: "tone-cyan", layout: "layout-proponent-2" },
    { label: "FACULTY", value: byCategory.FACULTY, tone: "tone-indigo", layout: "layout-proponent-3" },
    { label: "NON-TEACHING/STAFF", value: byCategory.NON_TEACHING, tone: "tone-orange", layout: "layout-proponent-4" },
  ];

  return (
    <section className="report-summary-cards" aria-label="Report summary">
      {cards.map((card) => (
        <article key={card.label} className={`report-summary-card ${card.tone} ${card.layout}`}>
          <span>{card.label}</span>
          <strong>{formatNumber(card.value)}</strong>
        </article>
      ))}
    </section>
  );
}
