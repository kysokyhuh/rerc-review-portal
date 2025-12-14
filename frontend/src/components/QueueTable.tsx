import React from "react";
import { Link } from "react-router-dom";
import { QueueItem } from "@/services/api";

interface QueueTableProps {
  title: string;
  items: QueueItem[];
  emptyMessage?: string;
}

export const QueueTable: React.FC<QueueTableProps> = ({
  title,
  items,
  emptyMessage = "No items",
}) => {
  return (
    <div className="queue-section">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="empty-state">{emptyMessage}</p>
      ) : (
        <table className="queue-table">
          <thead>
            <tr>
              <th>Project Code</th>
              <th>Title</th>
              <th>PI Name</th>
              <th>Submission Type</th>
              <th>Status</th>
              {title.includes("Revision") && <th>Days Remaining</th>}
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="queue-row">
                <td className="code">{item.projectCode}</td>
                <td className="title">{item.projectTitle}</td>
                <td>{item.piName}</td>
                <td>{item.submissionType}</td>
                <td>
                  <span className={`badge badge-${item.status.toLowerCase()}`}>
                    {item.status}
                  </span>
                </td>
                {title.includes("Revision") && (
                  <td
                    className={
                      item.daysRemaining && item.daysRemaining < 5
                        ? "overdue"
                        : ""
                    }
                  >
                    {item.daysRemaining !== undefined
                      ? `${item.daysRemaining} days`
                      : "—"}
                  </td>
                )}
                <td>
                  <Link
                    to={`/projects/${item.id}`}
                    className="btn btn-sm btn-primary"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
