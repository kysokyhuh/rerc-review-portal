import React from "react";
import { Link } from "react-router-dom";
import type { ExemptedQueueItem } from "@/types";

type ExemptedTableProps = {
  items: ExemptedQueueItem[];
  loading: boolean;
  error: string | null;
  onNotifyAndClose: (item: ExemptedQueueItem) => void;
  busyId: number | null;
};

export default function ExemptedTable({
  items,
  loading,
  error,
  onNotifyAndClose,
  busyId,
}: ExemptedTableProps) {
  if (loading) {
    return <div className="queue-focused-state">Loading exempted protocols...</div>;
  }

  if (error) {
    return <div className="queue-focused-state error">Failed to load exempted queue: {error}</div>;
  }

  if (items.length === 0) {
    return <div className="queue-focused-state">No exempted protocols awaiting archive.</div>;
  }

  return (
    <div
      className="table-wrap exempted-table-wrap"
      role="region"
      aria-label="Exempted protocols table"
      tabIndex={0}
    >
      <table className="data-table exempted-table">
        <colgroup>
          <col className="exempted-column-code" />
          <col className="exempted-column-title" />
          <col className="exempted-column-leader" />
          <col className="exempted-column-college" />
          <col className="exempted-column-actions" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Project Code</th>
            <th scope="col">Title</th>
            <th scope="col">Leader</th>
            <th scope="col">College</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isBusy = busyId === item.id;
            return (
              <tr key={item.id}>
                <td className="exempted-code-cell">{item.projectCode}</td>
                <td className="exempted-title-cell" title={item.title}>
                  <span className="exempted-title-text">{item.title}</span>
                </td>
                <td>{item.proponentOrLeader}</td>
                <td>{item.college}</td>
                <td className="exempted-actions-cell">
                  <div className="row-actions always-visible">
                    <Link className="ghost-btn exempted-btn" to={`/submissions/${item.id}`}>
                      View
                    </Link>
                    <button
                      type="button"
                      className="primary-btn exempted-btn"
                      onClick={() => onNotifyAndClose(item)}
                      disabled={isBusy}
                    >
                      {isBusy ? "Archiving..." : "Notify & Archive"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
