import React, { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import { exportInitialAckCSV, exportInitialApprovalDocx } from "@/services/api";
import { Timeline } from "@/components/Timeline";
import "../styles/globals.css";

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [exporting, setExporting] = useState<string | null>(null);

  if (!projectId) {
    return <div>Project ID is required</div>;
  }

  const { project, loading, error } = useProjectDetail(parseInt(projectId));

  if (error) {
    const backTarget = `/dashboard${location.search ?? ""}`;
    return (
      <div className="error-state">
        <h1>Error Loading Project</h1>
        <p>{error}</p>
        <button
          onClick={() => navigate(backTarget)}
          className="btn btn-primary"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (loading || !project) {
    return (
      <div className="loading-state">
        <p>Loading project details...</p>
      </div>
    );
  }

  const latestSubmission = project.submissions?.[0];

  const handleExportAckCSV = async () => {
    if (!latestSubmission) return;
    try {
      setExporting("ack-csv");
      const blob = await exportInitialAckCSV(latestSubmission.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `initial_ack_${project.projectCode}.csv`;
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
    if (!latestSubmission) return;
    try {
      setExporting("approval-docx");
      const blob = await exportInitialApprovalDocx(latestSubmission.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `initial_approval_${project.projectCode}.docx`;
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

  return (
    <div className="project-detail-page">
      <header className="page-header">
        <button
          onClick={() => navigate(`/dashboard${location.search ?? ""}`)}
          className="btn btn-secondary btn-sm"
        >
          ← Back to Dashboard
        </button>
        <h1>
          {project.projectCode} – {project.title}
        </h1>
      </header>

      <section className="project-header-section">
        <div className="header-grid">
          <div className="field">
            <label>Project Code</label>
            <p>{project.projectCode}</p>
          </div>
          <div className="field">
            <label>Status</label>
            <p className={`badge badge-${project.overallStatus.toLowerCase()}`}>
              {project.overallStatus}
            </p>
          </div>
          <div className="field">
            <label>Committee</label>
            <p>{project.committee.name}</p>
          </div>
          <div className="field">
            <label>Funding Type</label>
            <p>{project.fundingType}</p>
          </div>
        </div>

        <div className="header-grid">
          <div className="field">
            <label>Principal Investigator</label>
            <p>{project.piName}</p>
          </div>
          <div className="field">
            <label>Affiliation</label>
            <p>{project.piAffiliation || "—"}</p>
          </div>
          {project.approvalStartDate && (
            <>
              <div className="field">
                <label>Approval Start Date</label>
                <p>
                  {new Date(project.approvalStartDate).toLocaleDateString()}
                </p>
              </div>
              <div className="field">
                <label>Approval End Date</label>
                <p>
                  {new Date(project.approvalEndDate || "").toLocaleDateString()}
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {latestSubmission && (
        <section className="actions-section">
          <h2>Actions</h2>
          <div className="button-group">
            <button
              onClick={handleExportAckCSV}
              disabled={exporting === "ack-csv"}
              className="btn btn-secondary"
            >
              {exporting === "ack-csv"
                ? "Exporting..."
                : "Download Initial Acknowledgement (CSV)"}
            </button>
            {latestSubmission.finalDecision === "APPROVED" && (
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
      )}

      {latestSubmission && (
        <>
          <section className="submission-section">
            <h2>Latest Submission</h2>
            <div className="submission-details">
              <div className="field">
                <label>Type</label>
                <p>{latestSubmission.submissionType}</p>
              </div>
              <div className="field">
                <label>Status</label>
                <p
                  className={`badge badge-${latestSubmission.status.toLowerCase()}`}
                >
                  {latestSubmission.status}
                </p>
              </div>
              <div className="field">
                <label>Received Date</label>
                <p>
                  {new Date(latestSubmission.receivedDate).toLocaleDateString()}
                </p>
              </div>
              {latestSubmission.finalDecision && (
                <>
                  <div className="field">
                    <label>Final Decision</label>
                    <p>{latestSubmission.finalDecision}</p>
                  </div>
                  <div className="field">
                    <label>Decision Date</label>
                    <p>
                      {new Date(
                        latestSubmission.finalDecisionDate || ""
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="timeline-section">
            <Timeline entries={latestSubmission.statusHistory} />
          </section>
        </>
      )}
    </div>
  );
};
