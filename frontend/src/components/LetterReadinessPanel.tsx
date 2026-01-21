import React from "react";
import type { LetterTemplateReadiness } from "@/types";
import { EmptyState } from "./EmptyState";

interface LetterReadinessPanelProps {
  readiness: LetterTemplateReadiness[];
  onExportTemplate: (templateCode: string) => void;
  onViewMissing: (templateCode: string, fields: string[]) => void;
}

export const LetterReadinessPanel: React.FC<LetterReadinessPanelProps> = ({
  readiness,
  onExportTemplate,
  onViewMissing,
}) => {
  if (!readiness || readiness.length === 0) {
    return (
      <EmptyState
        title="No letter readiness data yet"
        description="When submissions are loaded, readiness by template appears here."
        actions={[
          { label: "Show all active", onClick: () => onViewMissing("ALL", []) },
        ]}
      />
    );
  }

  return (
    <div className="card letter-panel">
      <div className="section-title">
        <h2>Letter readiness</h2>
        <p className="section-description">
          Grouped by template codes (6B, 20B, 6D–6G, 8B, 9B)
        </p>
      </div>
      <div className="letter-row" style={{ fontWeight: 700, color: "#4f5b57" }}>
        <div>Template</div>
        <div>Ready</div>
        <div>Missing fields</div>
        <div>Actions</div>
      </div>
      {readiness.map((row) => (
        <div key={row.templateCode} className="letter-row">
          <div className="letter-template">{row.templateCode}</div>
          <div className="letter-count">{row.ready}</div>
          <div className="letter-missing">{row.missingFields}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onExportTemplate(row.templateCode)}
            >
              Export CSV
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                onViewMissing(
                  row.templateCode,
                  row.samples.flatMap((sample) => sample.fields)
                )
              }
              disabled={row.missingFields === 0}
            >
              View missing
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
