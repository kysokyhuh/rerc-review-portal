import React from "react";
import { formatStatusLabel, formatShortDate } from "./utils";
import type { SubmissionDetail, SubmissionSlaSummary } from "@/types";

interface QuickViewSummary {
  projectCode: string;
  projectTitle: string;
  piName: string;
  staffInChargeName?: string | null;
}

interface QuickViewModalProps {
  open: boolean;
  onClose: () => void;
  summary: QuickViewSummary | null;
  detail: SubmissionDetail | null;
  sla: SubmissionSlaSummary | null;
  loading: boolean;
  error: string | null;
  submissionId: number | null;
  onNavigate: (path: string) => void;
  onRetry: () => void;
}

export function QuickViewModal({
  open,
  onClose,
  summary,
  detail,
  sla,
  loading,
  error,
  submissionId,
  onNavigate,
  onRetry,
}: QuickViewModalProps) {
  if (!open) return null;

  return (
    <div className="quick-view-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="quick-view-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="quick-view-header">
          <div className="quick-view-header-left">
            <span className="quick-view-code">{summary?.projectCode ?? "—"}</span>
            <h3>{summary?.projectTitle ?? "—"}</h3>
            <div className="quick-view-header-meta">
              <span>{summary?.piName ?? "—"}</span>
              {summary?.staffInChargeName && (
                <>
                  <span className="quick-view-sep">•</span>
                  <span>Assigned to {summary.staffInChargeName}</span>
                </>
              )}
            </div>
          </div>
          <button className="quick-view-close" type="button" onClick={onClose} aria-label="Close quick view">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="quick-view-body">
            <div className="quick-view-skeleton">
              <div className="skeleton-pill" style={{ width: 80 }}></div>
              <div className="skeleton-line wide" style={{ marginTop: 16 }}></div>
              <div className="skeleton-line" style={{ marginTop: 8 }}></div>
              <div className="skeleton-line small" style={{ marginTop: 8 }}></div>
              <div className="skeleton-pill" style={{ width: 120, marginTop: 20 }}></div>
              <div className="skeleton-line" style={{ marginTop: 8 }}></div>
              <div className="skeleton-line small" style={{ marginTop: 8 }}></div>
            </div>
          </div>
        ) : error ? (
          <div className="quick-view-body">
            <div className="quick-view-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <p>{error}</p>
              <button className="ghost-btn" onClick={onRetry}>Retry</button>
            </div>
          </div>
        ) : (
          <div className="quick-view-body">
            {/* Status badges */}
            <div className="quick-view-badges">
              <span className={`status-badge ${
                (detail?.status ?? "").includes("REVISION") ? "pending" :
                (detail?.status ?? "").includes("REVIEW") ? "on-track" : "pending"
              }`}>
                <span className="status-dot"></span>
                {formatStatusLabel(detail?.status ?? null)}
              </span>
              {detail?.classification?.reviewType && (
                <span className="status-badge neutral">{detail.classification.reviewType}</span>
              )}
              {detail?.finalDecision && (
                <span className={`status-badge ${detail.finalDecision === "APPROVED" ? "on-track" : "pending"}`}>
                  {formatStatusLabel(detail.finalDecision)}
                </span>
              )}
            </div>

            {/* Key details */}
            <div className="quick-view-details">
              <div className="qv-detail-item">
                <span className="qv-detail-label">Submission type</span>
                <span className="qv-detail-value">{detail?.submissionType ?? "—"}</span>
              </div>
              <div className="qv-detail-item">
                <span className="qv-detail-label">Received</span>
                <span className="qv-detail-value">{formatShortDate(detail?.receivedDate)}</span>
              </div>
              <div className="qv-detail-item">
                <span className="qv-detail-label">SLA due</span>
                <span className="qv-detail-value">
                  {sla?.current?.dueDate ? formatShortDate(sla.current.dueDate) : "Not set"}
                </span>
              </div>
              <div className="qv-detail-item">
                <span className="qv-detail-label">Staff in charge</span>
                <span className="qv-detail-value">{summary?.staffInChargeName ?? "Unassigned"}</span>
              </div>
            </div>

            {/* Recent activity */}
            <div className="quick-view-section">
              <h4>Recent activity</h4>
              {detail?.statusHistory?.length ? (
                <div className="quick-view-timeline">
                  {detail.statusHistory
                    .slice(-4)
                    .reverse()
                    .map((entry, idx) => (
                      <div key={entry.id} className={`quick-view-event ${idx === 0 ? "latest" : ""}`}>
                        <div className={`quick-view-dot ${idx === 0 ? "dot-active" : ""}`}></div>
                        <div className="quick-view-event-content">
                          <div className="quick-view-event-title">{formatStatusLabel(entry.newStatus)}</div>
                          <div className="quick-view-event-meta">
                            {formatShortDate(entry.effectiveDate)}
                            {entry.changedBy?.fullName && ` — ${entry.changedBy.fullName}`}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="quick-view-empty">No activity recorded yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="quick-view-footer">
          <button className="ghost-btn" type="button" onClick={onClose}>Close</button>
          {submissionId && (
            <button className="primary-btn" type="button" onClick={() => onNavigate(`/submissions/${submissionId}`)}>
              Open full record →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
