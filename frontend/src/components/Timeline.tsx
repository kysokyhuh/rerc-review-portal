import React from "react";
import type { StatusHistoryEntry } from "@/types";

interface TimelineProps {
  entries: StatusHistoryEntry[];
}

export const Timeline: React.FC<TimelineProps> = ({ entries }) => {
  return (
    <div className="timeline">
      <h3>Submission Timeline</h3>
      {entries.length === 0 ? (
        <p>No status history available.</p>
      ) : (
        <div className="timeline-events">
          {entries.map((entry, index) => (
            <div key={entry.id} className="timeline-event">
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <div className="event-status">
                  {entry.oldStatus && (
                    <span className="old">{entry.oldStatus}</span>
                  )}
                  <span className="arrow">→</span>
                  <span className="new">{entry.newStatus}</span>
                </div>
                <div className="event-date">
                  {new Date(entry.effectiveDate).toLocaleDateString()}
                </div>
                {entry.reason && (
                  <div className="event-reason">{entry.reason}</div>
                )}
                {entry.changedBy && (
                  <div className="event-user">
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
