import React, { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  exportInitialAckCSV,
  exportInitialApprovalDocx,
} from "@/services/api";
import { useSubmissionDetail } from "@/hooks/useSubmissionDetail";
import { formatDateDisplay } from "@/utils/dateUtils";
import { Timeline } from "@/components/Timeline";
import "../styles/globals.css";

export const SubmissionDetailPage: React.FC = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [exporting, setExporting] = useState<string | null>(null);

  if (!submissionId) {
    return <div>Submission ID is required</div>;
  }

  const numericId = Number(submissionId);
  const { submission, slaSummary, loading, error } =
    useSubmissionDetail(numericId);

  const backTarget = `/dashboard${location.search ?? ""}`;

  const handleExportAckCSV = async () => {
    try {
      setExporting("ack-csv");
      const blob = await exportInitialAckCSV(numericId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `initial_ack_${submission?.project?.projectCode ?? numericId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert("Failed to export acknowledgement letter");
    } finally {
      setExporting(null);
    }
  };

  const handleExportApprovalDocx = async () => {
    try {
      setExporting("approval-docx");
      const blob = await exportInitialApprovalDocx(numericId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `initial_approval_${submission?.project?.projectCode ?? numericId}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert("Failed to export approval letter");
    } finally {
      setExporting(null);
    }
  };

  if (error) {
    return (
      <div className="error-state">
        <h1>Error Loading Submission</h1>
        <p>{error}</p>
        <button onClick={() => navigate(backTarget)} className="btn btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (loading || !submission) {
    return (
      <div className="loading-state">
        <p>Loading submission details...</p>
      </div>
    );
  }

  const projectCode = submission.project?.projectCode ?? "N/A";
  const title = submission.project?.title ?? "Untitled submission";

  return (
    <div className="project-detail-page">
      <header className="page-header" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(backTarget)} className="btn btn-secondary btn-sm">
          ← Back to dashboard
        </button>
        <div>
          <h1>
            {projectCode} – {title}
          </h1>
          <p>Submission ID {submission.id}</p>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 14 }}>
        <div className="section-title">
          <h2>Submission overview</h2>
          <span className="badge badge-positive">
            {submission.status}
          </span>
        </div>
        <div className="header-grid">
          <div className="field">
            <label>PI</label>
            <p>{submission.project?.piName ?? "—"}</p>
          </div>
          <div className="field">
            <label>Committee</label>
            <p>{submission.project?.committee?.name ?? "—"}</p>
          </div>
          <div className="field">
            <label>Submission type</label>
            <p>{submission.submissionType}</p>
          </div>
          <div className="field">
            <label>Received</label>
            <p>{formatDateDisplay(submission.receivedDate)}</p>
          </div>
          {submission.finalDecision && (
            <>
              <div className="field">
                <label>Final decision</label>
                <p>{submission.finalDecision}</p>
              </div>
              <div className="field">
                <label>Decision date</label>
                <p>{formatDateDisplay(submission.finalDecisionDate)}</p>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 14 }}>
        <div className="section-title">
          <h2>Actions</h2>
        </div>
        <div className="button-group" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={handleExportAckCSV}
            disabled={exporting === "ack-csv"}
            className="btn btn-secondary"
          >
            {exporting === "ack-csv"
              ? "Exporting..."
              : "Download Initial Acknowledgement (CSV)"}
          </button>
          {submission.finalDecision === "APPROVED" && (
            <button
              onClick={handleExportApprovalDocx}
              disabled={exporting === "approval-docx"}
              className="btn btn-primary"
            >
              {exporting === "approval-docx"
                ? "Exporting..."
                : "Download Approval Letter (DOCX)"}
            </button>
          )}
        </div>
      </section>

      {slaSummary && (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="section-title">
            <h2>SLA explainability</h2>
          </div>
          <div className="header-grid">
            <div className="field">
              <label>Classification</label>
              <p>
                {slaSummary.classification.actualWorkingDays} wd actual /{" "}
                {slaSummary.classification.configuredWorkingDays ?? "—"} wd target
              </p>
            </div>
            <div className="field">
              <label>Review</label>
              <p>
                {slaSummary.review.actualWorkingDays ?? "—"} wd actual /{" "}
                {slaSummary.review.configuredWorkingDays ?? "—"} wd target
              </p>
            </div>
            <div className="field">
              <label>Revision response</label>
              <p>
                {slaSummary.revisionResponse.actualWorkingDays ?? "—"} wd actual /{" "}
                {slaSummary.revisionResponse.configuredWorkingDays ?? "—"} wd target
              </p>
            </div>
          </div>
        </section>
      )}

      {submission.statusHistory && (
        <section className="timeline-section card">
          <Timeline entries={submission.statusHistory} />
        </section>
      )}
    </div>
  );
};
