import React, { useState } from "react";
import { useDashboardQueues } from "@/hooks/useDashboardQueues";
import { SummaryCards } from "@/components/SummaryCards";
import { QueueTable } from "@/components/QueueTable";
import "../styles/globals.css";

export const DashboardPage: React.FC = () => {
  const [committeeCode] = useState("RERC-HUMAN"); // TODO: Make this selectable or get from context
  const {
    counts,
    classificationQueue,
    reviewQueue,
    revisionQueue,
    loading,
    error,
  } = useDashboardQueues(committeeCode);

  if (error) {
    return (
      <div className="error-state">
        <h1>Error Loading Dashboard</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-state">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <h1>RA Dashboard – {committeeCode}</h1>
        <p>Monitor submissions and manage workflow queues</p>
      </header>

      <section className="dashboard-section">
        <SummaryCards counts={counts} />
      </section>

      <section className="dashboard-section">
        <QueueTable
          title="Classification Queue"
          items={classificationQueue}
          emptyMessage="No submissions awaiting classification"
        />
      </section>

      <section className="dashboard-section">
        <QueueTable
          title="Review Queue"
          items={reviewQueue}
          emptyMessage="No submissions awaiting review"
        />
      </section>

      <section className="dashboard-section">
        <QueueTable
          title="Revision Queue (Overdue)"
          items={revisionQueue}
          emptyMessage="No submissions awaiting revisions"
        />
      </section>
    </div>
  );
};
