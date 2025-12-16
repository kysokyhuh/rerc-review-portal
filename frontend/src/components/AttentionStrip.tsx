import React from "react";
import { AttentionMetrics } from "@/services/api";

interface AttentionStripProps {
  metrics: AttentionMetrics;
  onSelect: (key: "OVERDUE" | "DUE_SOON" | "CLASSIFICATION" | "MISSING_FIELDS") => void;
}

export const AttentionStrip: React.FC<AttentionStripProps> = ({
  metrics,
  onSelect,
}) => {
  const items = [
    {
      key: "OVERDUE" as const,
      label: "Overdue",
      value: metrics.overdue,
      tone: "danger",
    },
    {
      key: "DUE_SOON" as const,
      label: "Due in ≤3 working days",
      value: metrics.dueSoon,
      tone: "warning",
    },
    {
      key: "CLASSIFICATION" as const,
      label: "Waiting in classification",
      value: metrics.classificationWait,
      tone: "info",
    },
    {
      key: "MISSING_FIELDS" as const,
      label: "Missing letter fields",
      value: metrics.missingLetterFields,
      tone: "info",
    },
  ];

  return (
    <div className="attention-strip">
      {items.map((item) => (
        <div
          key={item.key}
          className={`attention-card ${item.tone}`}
          onClick={() => onSelect(item.key)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onSelect(item.key)}
        >
          <div>
            <div className="attention-label">{item.label}</div>
            <div className="attention-muted">
              Tap to filter queues and jump
            </div>
          </div>
          <div className="attention-value">{item.value ?? 0}</div>
        </div>
      ))}
    </div>
  );
};
