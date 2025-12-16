import React from "react";
import { QueueCounts } from "@/services/api";

interface SummaryCardsProps {
  counts: QueueCounts | null;
  onSelect: (key: "classification" | "review" | "revision" | "dueSoon") => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  counts,
  onSelect,
}) => {
  if (!counts) {
    return (
      <div className="kpi-grid">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="kpi-card skeleton" style={{ height: 120 }} />
        ))}
      </div>
    );
  }

  const tiles = [
    {
      key: "classification" as const,
      label: "For classification",
      value: counts.forClassification,
      subtext: "Awaiting RA classification",
    },
    {
      key: "review" as const,
      label: "Under review",
      value: counts.forReview,
      subtext: "Assigned to reviewers / panel",
    },
    {
      key: "revision" as const,
      label: "Awaiting revisions",
      value: counts.awaitingRevisions,
      subtext: "Sent back to PI for updates",
    },
    {
      key: "dueSoon" as const,
      label: "Due soon (≤3 wd)",
      value: counts.dueSoon ?? 0,
      subtext: "Working day SLA logic applied",
    },
  ];

  return (
    <div className="kpi-grid">
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className="kpi-card"
          onClick={() => onSelect(tile.key)}
        >
          <div className="kpi-label">{tile.label}</div>
          <div className="kpi-value">{tile.value}</div>
          <div className="kpi-subtext">{tile.subtext}</div>
        </div>
      ))}
    </div>
  );
};
