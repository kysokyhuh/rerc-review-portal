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
      helper: "Current workload in this lane.",
      tone: "primary",
    },
    {
      label: "Overdue",
      value: overdue,
      helper: "Needs immediate follow-through.",
      tone: "danger",
    },
    {
      label: "Due Soon",
      value: dueSoon,
      helper: "Approaching SLA threshold.",
      tone: "warning",
    },
    {
      label: "Blocked",
      value: blocked,
      helper: "Missing data or dependencies.",
      tone: "info",
    },
  ] as const;

  return (
    <section className="queue-kpis" aria-label="Queue KPIs">
      {cards.map((card) => (
        <article key={card.label} className={`queue-kpi-card ${card.tone}`}>
          <div className="queue-kpi-topline">
            <span className="queue-kpi-label">{card.label}</span>
          </div>
          <strong>{card.value}</strong>
          <p>{card.helper}</p>
        </article>
      ))}
    </section>
  );
};
