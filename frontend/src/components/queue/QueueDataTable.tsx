import React from "react";
import { Link } from "react-router-dom";
import type { DecoratedQueueItem } from "@/types";

const toDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

type QueueDataTableProps = {
  title: string;
  items: DecoratedQueueItem[];
  emptyMessage: string;
  loading: boolean;
  error: string | null;
};

export const QueueDataTable: React.FC<QueueDataTableProps> = ({
  title,
  items,
  emptyMessage,
  loading,
  error,
}) => {
  return (
    <section className="panel queue-focused-table">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">{title}</h2>
          <p className="panel-subtitle">Only submissions relevant to this queue are shown.</p>
        </div>
      </div>
      <div className="panel-body no-padding">
        {loading ? (
          <div className="queue-focused-state">Loading queue data...</div>
        ) : error ? (
          <div className="queue-focused-state error">Failed to load queue: {error}</div>
        ) : items.length === 0 ? (
          <div className="queue-focused-state">{emptyMessage}</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Principal Investigator</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th>SLA</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.projectCode}</strong>
                      <div>{item.projectTitle}</div>
                    </td>
                    <td>{item.piName}</td>
                    <td>{item.status.replace(/_/g, " ")}</td>
                    <td>{toDate(item.receivedDate)}</td>
                    <td>
                      <span className={`queue-sla-chip ${item.slaStatus.toLowerCase()}`}>
                        {item.slaStatus.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <Link to={`/submissions/${item.id}`} className="queue-open-link">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
