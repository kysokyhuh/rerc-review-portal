import React from "react";
import type { CommitteeSummary } from "@/types";
import { formatFieldName, formatChangeValue, formatHistoryDate } from "./submissionUtils";

interface ChangeEntry {
  id: number;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  source: string;
  changedBy?: { fullName: string } | null;
  reason?: string | null;
}

interface EditHistoryCardProps {
  changeHistory: ChangeEntry[];
  committees: CommitteeSummary[];
}

export function EditHistoryCard({ changeHistory, committees }: EditHistoryCardProps) {
  return (
    <section className="card detail-card">
      <div className="section-title">
        <h2>Edit history</h2>
        {changeHistory.length > 0 && (
          <span className="badge">{changeHistory.length} edit{changeHistory.length !== 1 ? "s" : ""}</span>
        )}
      </div>
      {changeHistory.length === 0 ? (
        <div className="empty-history">
          <span className="empty-history-icon">📝</span>
          <p>No edits logged yet.</p>
        </div>
      ) : (
        <div className="history-list">
          {changeHistory.map((entry) => (
            <div key={`${entry.source}-${entry.id}`} className="history-item">
              <div className="history-header">
                <span className="history-field-badge">{formatFieldName(entry.fieldName)}</span>
                <span className="history-meta">{entry.source} • {formatHistoryDate(entry.createdAt)}</span>
              </div>
              <div className="history-change">
                <span className="history-old">{formatChangeValue(entry.fieldName, entry.oldValue, committees)}</span>
                <span className="history-arrow">→</span>
                <span className="history-new">{formatChangeValue(entry.fieldName, entry.newValue, committees)}</span>
              </div>
              {entry.changedBy && <div className="history-user">by {entry.changedBy.fullName}</div>}
              {entry.reason && <div className="history-reason">"{entry.reason}"</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
