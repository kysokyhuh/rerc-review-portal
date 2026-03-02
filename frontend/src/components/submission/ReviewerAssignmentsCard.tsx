import React from "react";
import { formatDateDisplay } from "@/utils/dateUtils";
import { humanizeEnum, formatDateTimeDisplay, getDueMeta } from "./submissionUtils";

interface ReviewerRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  assignedAt: string | null;
  dueDate: string | null;
  submittedAt: string | null;
  decision: string | null;
  endorsementStatus: string | null;
  isActive: boolean;
}

interface ReviewerAssignmentsCardProps {
  reviewerRows: ReviewerRow[];
}

export function ReviewerAssignmentsCard({ reviewerRows }: ReviewerAssignmentsCardProps) {
  return (
    <section className="card detail-card">
      <div className="section-title">
        <h2>Reviewer assignments</h2>
        {reviewerRows.length > 0 && (
          <span className="badge">{reviewerRows.length} reviewer{reviewerRows.length !== 1 ? "s" : ""}</span>
        )}
      </div>
      {reviewerRows.length === 0 ? (
        <div className="empty-history">
          <p>No reviewers assigned yet.</p>
        </div>
      ) : (
        <div className="detail-table-wrap">
          <table className="detail-table">
            <thead>
              <tr>
                <th>Reviewer</th>
                <th>Role</th>
                <th>Assigned</th>
                <th>Due</th>
                <th>Decision</th>
                <th>Endorsement</th>
              </tr>
            </thead>
            <tbody>
              {reviewerRows.map((item) => {
                const dueMeta = getDueMeta(item.dueDate, item.submittedAt, item.isActive);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="table-primary">{item.name}</div>
                      <div className="table-secondary">{item.email}</div>
                    </td>
                    <td>{humanizeEnum(item.role)}</td>
                    <td>{formatDateTimeDisplay(item.assignedAt)}</td>
                    <td>
                      <div className="table-primary">{formatDateDisplay(item.dueDate)}</div>
                      <span className={`table-chip ${dueMeta.className}`}>{dueMeta.label}</span>
                    </td>
                    <td>{humanizeEnum(item.decision)}</td>
                    <td>{humanizeEnum(item.endorsementStatus)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
