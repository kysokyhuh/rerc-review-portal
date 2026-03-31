import React from "react";
import type { SubmissionReminderLogEntry } from "@/types";
import { formatHistoryDate } from "./submissionUtils";

function formatReminderTarget(target: SubmissionReminderLogEntry["target"]) {
  return target
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

interface ReminderLogCardProps {
  reminders: SubmissionReminderLogEntry[];
}

export function ReminderLogCard({ reminders }: ReminderLogCardProps) {
  return (
    <section className="card detail-card">
      <div className="section-title">
        <h2>Reminder log</h2>
        {reminders.length > 0 ? (
          <span className="badge">
            {reminders.length} reminder{reminders.length !== 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      {reminders.length === 0 ? (
        <div className="empty-history">
          <span className="empty-history-icon">🔔</span>
          <p>No reminders logged yet.</p>
        </div>
      ) : (
        <div className="history-list">
          {reminders.map((entry) => (
            <div key={entry.id} className="history-item">
              <div className="history-header">
                <span className="history-field-badge">
                  {formatReminderTarget(entry.target)}
                </span>
                <span className="history-meta">
                  {formatHistoryDate(entry.createdAt)}
                </span>
              </div>
              <div className="history-reason">"{entry.note}"</div>
              {entry.actor ? (
                <div className="history-user">by {entry.actor.fullName}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
