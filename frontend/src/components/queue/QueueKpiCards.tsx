import React from "react";

type QueueKpiCardsProps = {
  total: number;
  overdue: number;
  dueSoon: number;
  blocked: number;
};

export const QueueKpiCards: React.FC<QueueKpiCardsProps> = ({
  total,
  overdue,
  dueSoon,
  blocked,
}) => {
  const cards = [
    {
      label: "Total in Queue",
      value: total,
      helper: "Protocols currently routed into this operational lane.",
      tone: "neutral",
      marker: "Live queue",
    },
    {
      label: "Overdue",
      value: overdue,
      helper: "Past SLA target and likely needs chair or RA intervention.",
      tone: "danger",
      marker: "Immediate action",
    },
    {
      label: "Due Soon",
      value: dueSoon,
      helper: "Approaching SLA threshold and should be reviewed next.",
      tone: "warning",
      marker: "Watch closely",
    },
    {
      label: "Blocked",
      value: blocked,
      helper: "Missing data or unresolved dependencies are slowing progress.",
      tone: "info",
      marker: "Clear blockers",
    },
  ] as const;

  return (
    <section className="queue-kpis" aria-label="Queue KPIs">
      {cards.map((card) => (
        <article key={card.label} className={`queue-kpi-card ${card.tone}`}>
          <div className="queue-kpi-topline">
            <span className="queue-kpi-label">{card.label}</span>
            <span className="queue-kpi-marker">{card.marker}</span>
          </div>
          <strong>{card.value}</strong>
          <p>{card.helper}</p>
        </article>
      ))}
    </section>
  );
};
