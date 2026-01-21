import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  exportInitialAckCSV,
  exportInitialApprovalDocx,
  fetchCommittees,
  updateSubmissionOverview,
} from "@/services/api";
import { useSubmissionDetail } from "@/hooks/useSubmissionDetail";
import { formatDateDisplay } from "@/utils/dateUtils";
import { Timeline } from "@/components/Timeline";
import type { CommitteeSummary, SubmissionDetail } from "@/types";

export const SubmissionDetailPage: React.FC = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [exporting, setExporting] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [committees, setCommittees] = useState<CommitteeSummary[]>([]);
  const [formState, setFormState] = useState({
    piName: "",
    committeeId: "",
    submissionType: "",
    receivedDate: "",
    status: "",
    finalDecision: "",
    finalDecisionDate: "",
    changeReason: "",
  });

  if (!submissionId) {
    return <div>Submission ID is required</div>;
  }

  const numericId = Number(submissionId);
  const { submission, slaSummary, loading, error, setSubmission } =
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

  const submissionTypeOptions = [
    "INITIAL",
    "AMENDMENT",
    "CONTINUING_REVIEW",
    "FINAL_REPORT",
    "WITHDRAWAL",
    "SAFETY_REPORT",
    "PROTOCOL_DEVIATION",
  ];
  const statusOptions = [
    "RECEIVED",
    "UNDER_COMPLETENESS_CHECK",
    "AWAITING_CLASSIFICATION",
    "UNDER_CLASSIFICATION",
    "CLASSIFIED",
    "UNDER_REVIEW",
    "AWAITING_REVISIONS",
    "REVISION_SUBMITTED",
    "CLOSED",
    "WITHDRAWN",
  ];
  const finalDecisionOptions = [
    "APPROVED",
    "MINOR_REVISIONS",
    "MAJOR_REVISIONS",
    "DISAPPROVED",
    "INFO_ONLY",
  ];

  const toInputDate = (value?: string | null) =>
    value ? new Date(value).toISOString().slice(0, 10) : "";

  const resetFormState = (source: SubmissionDetail) => {
    setFormState({
      piName: source.project?.piName ?? "",
      committeeId: source.project?.committee?.id
        ? String(source.project.committee.id)
        : "",
      submissionType: source.submissionType ?? "",
      receivedDate: toInputDate(source.receivedDate),
      status: source.status ?? "",
      finalDecision: source.finalDecision ?? "",
      finalDecisionDate: toInputDate(source.finalDecisionDate),
      changeReason: "",
    });
  };

  useEffect(() => {
    let active = true;
    fetchCommittees()
      .then((data) => {
        if (active) setCommittees(data);
      })
      .catch(() => {
        if (active) setCommittees([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!submission) return;
    resetFormState(submission);
  }, [submission]);

  const changeHistory = useMemo(() => {
    if (!submission) return [];
    const combined = [
      ...(submission.changeLogs ?? []).map((entry) => ({
        ...entry,
        source: "Submission",
      })),
      ...(submission.projectChangeLogs ?? []).map((entry) => ({
        ...entry,
        source: "Project",
      })),
    ];
    return combined.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [submission]);

  const formatFieldName = (fieldName: string) => {
    switch (fieldName) {
      case "piName":
        return "PI name";
      case "committeeId":
        return "Committee";
      case "submissionType":
        return "Submission type";
      case "receivedDate":
        return "Received date";
      case "finalDecision":
        return "Final decision";
      case "finalDecisionDate":
        return "Decision date";
      default:
        return fieldName.replace(/([A-Z])/g, " $1").toLowerCase();
    }
  };

  const formatChangeValue = (fieldName: string, value: string | null) => {
    if (!value) return "—";
    if (fieldName === "committeeId") {
      const match = committees.find((c) => String(c.id) === value);
      return match ? `${match.code} – ${match.name}` : value;
    }
    if (fieldName.toLowerCase().includes("date")) {
      return formatDateDisplay(value);
    }
    return value;
  };

  const formatHistoryDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleEditStart = () => {
    setSaveError(null);
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    if (submission) resetFormState(submission);
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!submission) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        submissionType: formState.submissionType || undefined,
        receivedDate: formState.receivedDate
          ? new Date(formState.receivedDate).toISOString()
          : undefined,
        status: formState.status || undefined,
        finalDecision: formState.finalDecision || null,
        finalDecisionDate: formState.finalDecisionDate
          ? new Date(formState.finalDecisionDate).toISOString()
          : null,
        piName: formState.piName.trim() || undefined,
        committeeId: formState.committeeId
          ? Number(formState.committeeId)
          : undefined,
        changeReason: formState.changeReason.trim() || undefined,
      };

      const updated = await updateSubmissionOverview(numericId, payload);
      setSubmission(updated);
      setIsEditing(false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to update submission"
      );
    } finally {
      setSaving(false);
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
          <div>
            <h2>Submission overview</h2>
            {saveError && <p className="error-text">{saveError}</p>}
          </div>
          <div className="section-actions">
            <span className="badge badge-positive">{submission.status}</span>
            {isEditing ? (
              <>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleEditCancel}
                  disabled={saving}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleEditStart}
              >
                Edit overview
              </button>
            )}
          </div>
        </div>
        <div className="header-grid">
          <div className="field">
            <label>PI</label>
            {isEditing ? (
              <input
                className="field-input"
                value={formState.piName}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    piName: event.target.value,
                  }))
                }
                placeholder="Principal investigator name"
              />
            ) : (
              <p>{submission.project?.piName ?? "—"}</p>
            )}
          </div>
          <div className="field">
            <label>Committee</label>
            {isEditing ? (
              <select
                className="field-input"
                value={formState.committeeId}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    committeeId: event.target.value,
                  }))
                }
              >
                <option value="">Select committee</option>
                {committees.map((committee) => (
                  <option key={committee.id} value={committee.id}>
                    {committee.code} – {committee.name}
                  </option>
                ))}
              </select>
            ) : (
              <p>{submission.project?.committee?.name ?? "—"}</p>
            )}
          </div>
          <div className="field">
            <label>Submission type</label>
            {isEditing ? (
              <select
                className="field-input"
                value={formState.submissionType}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    submissionType: event.target.value,
                  }))
                }
              >
                {submissionTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <p>{submission.submissionType}</p>
            )}
          </div>
          <div className="field">
            <label>Received</label>
            {isEditing ? (
              <input
                className="field-input"
                type="date"
                value={formState.receivedDate}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    receivedDate: event.target.value,
                  }))
                }
              />
            ) : (
              <p>{formatDateDisplay(submission.receivedDate)}</p>
            )}
          </div>
          <div className="field">
            <label>Status</label>
            {isEditing ? (
              <select
                className="field-input"
                value={formState.status}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    status: event.target.value,
                  }))
                }
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <p>{submission.status}</p>
            )}
          </div>
          {(isEditing || submission.finalDecision) && (
            <>
              <div className="field">
                <label>Final decision</label>
                {isEditing ? (
                  <select
                    className="field-input"
                    value={formState.finalDecision}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        finalDecision: event.target.value,
                      }))
                    }
                  >
                    <option value="">—</option>
                    {finalDecisionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p>{submission.finalDecision ?? "—"}</p>
                )}
              </div>
              <div className="field">
                <label>Decision date</label>
                {isEditing ? (
                  <input
                    className="field-input"
                    type="date"
                    value={formState.finalDecisionDate}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        finalDecisionDate: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <p>{formatDateDisplay(submission.finalDecisionDate)}</p>
                )}
              </div>
            </>
          )}
          {isEditing && (
            <div className="field field-wide">
              <label>Reason for change (optional)</label>
              <textarea
                className="field-input"
                rows={3}
                value={formState.changeReason}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    changeReason: event.target.value,
                  }))
                }
                placeholder="Add context for the update..."
              />
            </div>
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

      <section className="card" style={{ marginTop: 14 }}>
        <div className="section-title">
          <h2>Edit history</h2>
        </div>
        {changeHistory.length === 0 ? (
          <p className="attention-muted">No edits logged yet.</p>
        ) : (
          <div className="history-list">
            {changeHistory.map((entry) => (
              <div key={`${entry.source}-${entry.id}`} className="history-item">
                <div className="history-meta">
                  {entry.source} • {formatHistoryDate(entry.createdAt)}
                  {entry.changedBy
                    ? ` • ${entry.changedBy.fullName} (${entry.changedBy.email})`
                    : ""}
                </div>
                <div className="history-change">
                  {formatFieldName(entry.fieldName)}:{" "}
                  <span className="history-old">
                    {formatChangeValue(entry.fieldName, entry.oldValue)}
                  </span>{" "}
                  →{" "}
                  <span className="history-new">
                    {formatChangeValue(entry.fieldName, entry.newValue)}
                  </span>
                </div>
                {entry.reason && (
                  <div className="history-reason">{entry.reason}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
