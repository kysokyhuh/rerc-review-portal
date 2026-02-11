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
  return (
    <section className="queue-kpis" aria-label="Queue KPIs">
      <article className="queue-kpi-card">
        <h2>Total in Queue</h2>
        <strong>{total}</strong>
      </article>
      <article className="queue-kpi-card danger">
        <h2>Overdue</h2>
        <strong>{overdue}</strong>
      </article>
      <article className="queue-kpi-card warning">
        <h2>Due Soon</h2>
        <strong>{dueSoon}</strong>
      </article>
      <article className="queue-kpi-card info">
        <h2>Blocked</h2>
        <strong>{blocked}</strong>
      </article>
    </section>
  );
};
