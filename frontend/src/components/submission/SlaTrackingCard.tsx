import React from "react";
import type { SubmissionSlaSummary } from "@/types";
import { getSlaStatus, getSlaPercent } from "./submissionUtils";

interface SlaTrackingCardProps {
  slaSummary: SubmissionSlaSummary;
}

export function SlaTrackingCard({ slaSummary }: SlaTrackingCardProps) {
  const currentStatusClass = slaSummary.current
    ? slaSummary.current.slaStatus === "OVERDUE"
      ? "overdue"
      : slaSummary.current.slaStatus === "DUE_SOON"
        ? "due-soon"
        : "on-track"
    : null;
  const stages = [
    { label: "Completeness", data: slaSummary.completeness },
    { label: "Classification", data: slaSummary.classification },
    { label: "Exempt notification", data: slaSummary.exemptNotification },
    { label: "Review", data: slaSummary.review },
    { label: "Revision response", data: slaSummary.revisionResponse },
  ];

  return (
    <section className="card detail-card">
      <div className="section-title">
        <h2>SLA tracking</h2>
      </div>
      {slaSummary.current ? (
        <div className="submission-current-sla">
          <span className={`sla-track-badge sla-badge-${currentStatusClass}`}>
            {slaSummary.current.label}: {slaSummary.current.slaStatus.replace(/_/g, " ")}
          </span>
          <p>
            {slaSummary.current.remainingDays >= 0
              ? `${slaSummary.current.remainingDays} ${slaSummary.current.dayMode === "CALENDAR" ? "calendar" : "working"} day${
                  slaSummary.current.remainingDays === 1 ? "" : "s"
                } remaining`
              : `${Math.abs(slaSummary.current.remainingDays)} ${
                  slaSummary.current.dayMode === "CALENDAR" ? "calendar" : "working"
                } day${Math.abs(slaSummary.current.remainingDays) === 1 ? "" : "s"} overdue`}
          </p>
        </div>
      ) : null}
      <div className="sla-track-grid">
        {stages.map(({ label, data }) => {
          const status = getSlaStatus(data);
          const pct = getSlaPercent(data);
          const hasDays = data.actualDays != null;
          const unit = data.dayMode === "CALENDAR" ? "cd" : "wd";
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
                <span className="sla-track-actual">{data.actualDays ?? "—"} <small>{unit} actual</small></span>
                <span className="sla-track-target">{data.configuredDays ?? "—"} <small>{unit} target</small></span>
              </div>
              <div className="sla-track-meta">
                <span>Start: {data.start ? new Date(data.start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
                <span>Due: {data.dueDate ? new Date(data.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
