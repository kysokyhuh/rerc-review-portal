import React from "react";
import type { SubmissionSlaSummary } from "@/types";
import { getSlaStatus, getSlaPercent } from "./submissionUtils";

interface SlaTrackingCardProps {
  slaSummary: SubmissionSlaSummary;
}

export function SlaTrackingCard({ slaSummary }: SlaTrackingCardProps) {
  const stages = [
    { label: "Classification", data: slaSummary.classification },
    { label: "Review", data: slaSummary.review },
    { label: "Revision response", data: slaSummary.revisionResponse },
  ];

  return (
    <section className="card detail-card">
      <div className="section-title">
        <h2>SLA tracking</h2>
      </div>
      <div className="sla-track-grid">
        {stages.map(({ label, data }) => {
          const status = getSlaStatus(data);
          const pct = getSlaPercent(data);
          const hasDays = data.actualWorkingDays != null;
          return (
            <div key={label} className={`sla-track-card sla-track-${status}`}>
              <div className="sla-track-header">
                <span className="sla-track-label">{label}</span>
                {status !== "pending" && (
                  <span className={`sla-track-badge sla-badge-${status}`}>
                    {status === "on-track" ? "✓ On track" : status === "due-soon" ? "⚠ Due soon" : "✕ Overdue"}
                  </span>
                )}
              </div>
              <div className="sla-track-bar-wrap">
                <div className={`sla-track-bar sla-bar-${status}`} style={{ width: `${hasDays ? pct : 0}%` }} />
              </div>
              <div className="sla-track-numbers">
                <span className="sla-track-actual">{data.actualWorkingDays ?? "—"} <small>wd actual</small></span>
                <span className="sla-track-target">{data.configuredWorkingDays ?? "—"} <small>wd target</small></span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
