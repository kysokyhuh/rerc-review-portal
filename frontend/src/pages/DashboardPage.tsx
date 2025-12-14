import React, { useState } from "react";
import { useDashboardQueues } from "@/hooks/useDashboardQueues";
import { SummaryCards } from "@/components/SummaryCards";
import { QueueTable } from "@/components/QueueTable";
import "../styles/globals.css";

export const DashboardPage: React.FC = () => {
  const [committeeCode] = useState("RERC-HUMAN");
  const {
    counts,
    classificationQueue,
    reviewQueue,
    revisionQueue,
    loading,
    error,
  } = useDashboardQueues(committeeCode);

  console.log("Dashboard state:", { loading, error, counts });

  if (error) {
    return (
      <div className="error-state">
        <h1>Error Loading Dashboard</h1>
        <p>{error}</p>
        <pre>{error}</pre>
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

  if (!counts) {
    return (
      <div className="error-state">
        <h1>No Data</h1>
        <p>Dashboard loaded but received no queue data</p>
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
