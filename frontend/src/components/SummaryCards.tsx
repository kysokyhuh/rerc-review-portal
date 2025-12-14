import React from "react";
import { QueueCounts } from "@/services/api";

interface SummaryCardsProps {
  counts: QueueCounts | null;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ counts }) => {
  if (!counts) {
    return <div>Loading...</div>;
  }

  return (
    <div className="summary-cards">
      <div className="card card-primary">
        <div className="card-value">{counts.forClassification}</div>
        <div className="card-label">For Classification</div>
      </div>
      <div className="card card-info">
        <div className="card-value">{counts.forReview}</div>
        <div className="card-label">For Review</div>
      </div>
      <div className="card card-warning">
        <div className="card-value">{counts.awaitingRevisions}</div>
        <div className="card-label">Awaiting Revisions</div>
      </div>
      <div className="card card-success">
        <div className="card-value">{counts.completed}</div>
        <div className="card-label">Completed</div>
      </div>
    </div>
  );
};
