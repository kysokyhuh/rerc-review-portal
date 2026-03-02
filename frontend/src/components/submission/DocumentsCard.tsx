import React from "react";
import { formatDateDisplay } from "@/utils/dateUtils";
import { humanizeEnum } from "./submissionUtils";

interface DocumentItem {
  id: number;
  title: string;
  type: string;
  status: string;
  receivedAt?: string | null;
  notes?: string | null;
  documentUrl?: string | null;
}

interface DocumentsCardProps {
  documents: DocumentItem[];
}

export function DocumentsCard({ documents }: DocumentsCardProps) {
  return (
    <section className="card detail-card">
      <div className="section-title">
        <h2>Documents</h2>
        {documents.length > 0 && (
          <span className="badge">{documents.length} document{documents.length !== 1 ? "s" : ""}</span>
        )}
      </div>
      {documents.length === 0 ? (
        <div className="empty-history">
          <p>No documents logged yet.</p>
        </div>
      ) : (
        <div className="detail-table-wrap">
          <table className="detail-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Status</th>
                <th>Received</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    {doc.documentUrl ? (
                      <a className="table-link" href={doc.documentUrl} target="_blank" rel="noreferrer">
                        {doc.title}
                      </a>
                    ) : (
                      <span className="table-primary">{doc.title}</span>
                    )}
                  </td>
                  <td>{humanizeEnum(doc.type)}</td>
                  <td><span className="table-chip due-neutral">{humanizeEnum(doc.status)}</span></td>
                  <td>{formatDateDisplay(doc.receivedAt)}</td>
                  <td className="table-note">{doc.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
