import React from "react";
import type { StatusHistoryEntry } from "@/types";

interface TimelineProps {
  entries: StatusHistoryEntry[];
}

export const Timeline: React.FC<TimelineProps> = ({ entries }) => {
  return (
    <div className="timeline-v2">
      <div className="section-title">
        <h2>Submission Timeline</h2>
        {entries.length > 0 && (
          <span className="badge">{entries.length} event{entries.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      {entries.length === 0 ? (
        <div className="empty-history">
          <span className="empty-history-icon">📋</span>
          <p>No status history available.</p>
        </div>
      ) : (
        <div className="timeline-v2-events">
          {entries.map((entry, index) => (
            <div key={entry.id} className={`timeline-v2-event ${index === 0 ? 'timeline-v2-latest' : ''}`}>
              <div className="timeline-v2-rail">
                <div className={`timeline-v2-dot ${index === 0 ? 'dot-latest' : ''}`} />
                {index < entries.length - 1 && <div className="timeline-v2-line" />}
              </div>
              <div className="timeline-v2-content">
                <div className="timeline-v2-status">
                  {entry.oldStatus && (
                    <span className="timeline-v2-old">{entry.oldStatus.replace(/_/g, ' ')}</span>
                  )}
                  <span className="timeline-v2-arrow">→</span>
                  <span className="timeline-v2-new">{entry.newStatus.replace(/_/g, ' ')}</span>
                </div>
                <div className="timeline-v2-meta">
                  <span className="timeline-v2-date">
                    {new Date(entry.effectiveDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  {entry.reason && (
                    <>
                      <span className="timeline-v2-sep">·</span>
                      <span className="timeline-v2-reason">{entry.reason}</span>
                    </>
                  )}
                </div>
                {entry.changedBy && (
                  <div className="timeline-v2-user">
                    by {entry.changedBy.fullName} ({entry.changedBy.email})
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
