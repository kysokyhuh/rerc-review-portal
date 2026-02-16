import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  fetchCommittees,
  fetchSubmissionDetail,
  updateProtocolProfile,
  updateSubmissionOverview,
  createProtocolMilestone,
  updateProtocolMilestone,
  deleteProtocolMilestone,
} from "@/services/api";
import { useSubmissionDetail } from "@/hooks/useSubmissionDetail";
import { formatDateDisplay } from "@/utils/dateUtils";
import { Timeline } from "@/components/Timeline";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  ProtocolProfileSection,
  profileToFormState,
  formStateToPayload,
} from "@/components/ProtocolProfileSection";
import type { CommitteeSummary, ProtocolMilestone, SubmissionDetail } from "@/types";

const STANDARD_MILESTONES: { label: string; ownerRole: string }[] = [
  { label: "Classification of Proposal (RERC)", ownerRole: "RERC Staff" },
  { label: "Provision of Documents & Assessment Forms to Primary Reviewer", ownerRole: "RERC Staff" },
  { label: "Accomplishment of Assessment Forms", ownerRole: "Primary Reviewers" },
  { label: "Full Review Meeting (for Full Review only)", ownerRole: "RERP" },
  { label: "Finalization of Review Results", ownerRole: "RERP Chair Designate" },
  { label: "Communication of Review Results to Project Leader", ownerRole: "RERC Chair/Staff" },
  { label: "1st Resubmission from Proponent", ownerRole: "RERC Staff" },
  { label: "1st Review of Resubmission", ownerRole: "Primary Reviewers" },
  { label: "1st Finalization of Review Results - Resubmission", ownerRole: "RERP Chair Designate" },
  { label: "Issuance of Ethics Clearance", ownerRole: "RERC and RERC Chair" },
];

export const SubmissionDetailPage: React.FC = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [committees, setCommittees] = useState<CommitteeSummary[]>([]);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<Record<string, string>>({});
  const [milestones, setMilestones] = useState<ProtocolMilestone[]>([]);
  const [newMilestoneLabel, setNewMilestoneLabel] = useState("");
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

  const numericId = submissionId ? Number(submissionId) : NaN;
  const { submission, slaSummary, loading, error, setSubmission } =
    useSubmissionDetail(numericId);

  const backTarget = `/dashboard${location.search ?? ""}`;

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

  const toInputDate = (value?: string | Date | null) => {
    if (!value) return "";
    if (typeof value === "string") {
      return value.slice(0, 10);
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    return "";
  };

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
    setProfileForm(profileToFormState(submission.project?.protocolProfile));
    setMilestones((submission.project as any)?.protocolMilestones ?? []);
  }, [submission]);

  const handleProfileSave = async () => {
    if (!submission?.project?.id) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const payload = formStateToPayload(profileForm);
      payload._meta = { sourceSubmissionId: numericId };
      await updateProtocolProfile(submission.project.id, payload);
      // Re-fetch the full submission so projectChangeLogs and edit history are up to date
      const refreshed = await fetchSubmissionDetail(numericId);
      setSubmission(refreshed);
      setProfileForm(profileToFormState(refreshed.project?.protocolProfile));
      setProfileEditing(false);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const projectId = submission?.project?.id;

  const handleAddMilestone = async () => {
    if (!projectId || !newMilestoneLabel.trim()) return;
    try {
      const created = await createProtocolMilestone(projectId, {
        label: newMilestoneLabel.trim(),
        orderIndex: milestones.length,
      });
      setMilestones((prev) => [...prev, created]);
      setNewMilestoneLabel("");
    } catch {
      setProfileError("Failed to add milestone");
    }
  };

  const handleLoadStandardTimeline = async () => {
    if (!projectId) return;
    if (milestones.length > 0) {
      const confirmed = window.confirm(
        "This will add the standard timeline milestones to the existing list. Continue?"
      );
      if (!confirmed) return;
    }
    try {
      const startIndex = milestones.length;
      const created: ProtocolMilestone[] = [];
      for (let i = 0; i < STANDARD_MILESTONES.length; i++) {
        const m = STANDARD_MILESTONES[i];
        const result = await createProtocolMilestone(projectId, {
          label: m.label,
          ownerRole: m.ownerRole,
          orderIndex: startIndex + i,
        });
        created.push(result);
      }
      setMilestones((prev) => [...prev, ...created]);
    } catch {
      setProfileError("Failed to load standard timeline");
    }
  };

  const handleMilestoneSave = async (row: ProtocolMilestone) => {
    if (!projectId) return;
    try {
      const updated = await updateProtocolMilestone(projectId, row.id, {
        label: row.label,
        orderIndex: row.orderIndex,
        days: row.days ?? null,
        dateOccurred: row.dateOccurred ?? null,
        ownerRole: row.ownerRole ?? null,
        notes: row.notes ?? null,
      });
      setMilestones((prev) => prev.map((item) => (item.id === row.id ? updated : item)));
    } catch {
      setProfileError("Failed to save milestone");
    }
  };

  const handleMilestoneDelete = async (row: ProtocolMilestone) => {
    if (!projectId) return;
    try {
      await deleteProtocolMilestone(projectId, row.id);
      setMilestones((prev) => prev.filter((item) => item.id !== row.id));
    } catch {
      setProfileError("Failed to delete milestone");
    }
  };

  if (!submissionId || Number.isNaN(numericId)) {
    return <div>Submission ID is required</div>;
  }

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

  const formatDateTimeDisplay = (value?: string | null) => {
    if (!value) return "—";
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

  const humanizeEnum = (value?: string | null) => {
    if (!value) return "—";
    return value.replace(/_/g, " ");
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
  const reviewerRows =
    submission.reviewAssignments && submission.reviewAssignments.length > 0
      ? submission.reviewAssignments.map((item) => ({
          id: `assign-${item.id}`,
          name: item.reviewer?.fullName ?? "Unknown reviewer",
          email: item.reviewer?.email ?? "—",
          role: item.reviewerRole,
          assignedAt: item.assignedAt,
          dueDate: item.dueDate,
          submittedAt: item.submittedAt,
          decision: item.decision,
          endorsementStatus: item.endorsementStatus,
          source: "assignment",
          isActive: item.isActive,
        }))
      : (submission.reviews ?? []).map((item) => ({
          id: `review-${item.id}`,
          name: item.reviewer?.fullName ?? "Unknown reviewer",
          email: item.reviewer?.email ?? "—",
          role: item.reviewerRole,
          assignedAt: item.assignedAt ?? null,
          dueDate: item.dueDate ?? null,
          submittedAt: item.respondedAt ?? null,
          decision: item.decision ?? null,
          endorsementStatus: item.endorsementStatus ?? null,
          source: "review",
          isActive: true,
        }));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDueMeta = (
    dueDate?: string | null,
    submittedAt?: string | null,
    isActive = true
  ) => {
    if (!dueDate) return { label: "No deadline", className: "due-neutral" };
    if (submittedAt) return { label: "Submitted", className: "due-good" };
    if (!isActive) return { label: "Closed", className: "due-neutral" };

    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) {
      return { label: "No deadline", className: "due-neutral" };
    }
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) {
      return { label: `${Math.abs(diffDays)}d overdue`, className: "due-overdue" };
    }
    if (diffDays === 0) return { label: "Due today", className: "due-soon" };
    if (diffDays <= 3) return { label: `${diffDays}d left`, className: "due-soon" };
    return { label: `${diffDays}d left`, className: "due-good" };
  };

  const getSlaStatus = (stage: { actualWorkingDays: number | null; configuredWorkingDays: number | null; withinSla: boolean | null }) => {
    if (stage.actualWorkingDays == null || stage.configuredWorkingDays == null) return 'pending';
    if (stage.withinSla === false) return 'overdue';
    const ratio = stage.actualWorkingDays / stage.configuredWorkingDays;
    if (ratio >= 0.8) return 'due-soon';
    return 'on-track';
  };

  const getSlaPercent = (stage: { actualWorkingDays: number | null; configuredWorkingDays: number | null }) => {
    if (stage.actualWorkingDays == null || stage.configuredWorkingDays == null) return 0;
    if (stage.configuredWorkingDays === 0) return 100;
    return Math.min(100, Math.round((stage.actualWorkingDays / stage.configuredWorkingDays) * 100));
  };

  const getStatusVariant = (status: string) => {
    if (['CLOSED', 'WITHDRAWN'].includes(status)) return 'badge-neutral';
    if (['AWAITING_REVISIONS', 'REVISION_SUBMITTED'].includes(status)) return 'badge-warning';
    if (['UNDER_REVIEW', 'UNDER_CLASSIFICATION', 'UNDER_COMPLETENESS_CHECK'].includes(status)) return 'badge-info';
    if (status === 'RECEIVED') return 'badge-positive';
    return 'badge-positive';
  };

  return (
    <div className="project-detail-page detail-v2">
      <header className="detail-hero">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: backTarget },
          { label: projectCode },
        ]} />
        <div className="detail-hero-content">
          <div className="detail-hero-text">
            <span className="detail-project-code">{projectCode}</span>
            <h1 className="detail-title">{title}</h1>
            <span className="detail-subtitle">Submission #{submission.id}</span>
          </div>
          <span className={`badge badge-lg ${getStatusVariant(submission.status)}`}>
            {submission.status.replace(/_/g, ' ')}
          </span>
        </div>
      </header>

      <section className="card detail-card">
        <div className="section-title">
          <div className="section-title-left">
            <h2>Submission overview</h2>
            {saveError && <p className="error-text">{saveError}</p>}
          </div>
          <div className="section-actions">
            {isEditing ? (
              <>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
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
                ✎ Edit overview
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

      <ProtocolProfileSection
        profile={submission.project?.protocolProfile}
        editing={profileEditing}
        saving={profileSaving}
        error={profileError}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        onEdit={() => setProfileEditing(true)}
        onSave={handleProfileSave}
        onCancel={() => setProfileEditing(false)}
      >
        {/* Milestones */}
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <h3 className="pp-group-name" style={{ margin: 0 }}>Milestones / # days</h3>
            <button className="btn btn-ghost btn-sm" type="button" onClick={handleLoadStandardTimeline}>
              Load Standard Timeline
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              className="pp-field-input"
              type="text"
              value={newMilestoneLabel}
              onChange={(event) => setNewMilestoneLabel(event.target.value)}
              placeholder="Add milestone label (e.g. Full Review Meeting)"
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary btn-sm" type="button" onClick={handleAddMilestone}>
              Add
            </button>
          </div>
          <table className="preview-table" style={{ marginTop: "0.5rem" }}>
            <thead>
              <tr>
                <th></th>
                <th>Label</th>
                <th># days</th>
                <th>Date</th>
                <th>Owner</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((milestone) => {
                const isDone = !!milestone.dateOccurred;
                return (
                  <tr key={milestone.id} style={{ opacity: isDone ? 1 : 0.75 }}>
                    <td style={{ textAlign: "center" }}>
                      {isDone ? (
                        <span title="Completed" style={{ color: "var(--color-positive, #22c55e)", fontSize: 16 }}>✓</span>
                      ) : (
                        <span title="Pending" style={{ color: "var(--color-neutral, #94a3b8)", fontSize: 16 }}>○</span>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        value={milestone.label}
                        onChange={(event) =>
                          setMilestones((prev) =>
                            prev.map((item) =>
                              item.id === milestone.id ? { ...item, label: event.target.value } : item
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={milestone.days ?? ""}
                        onChange={(event) =>
                          setMilestones((prev) =>
                            prev.map((item) =>
                              item.id === milestone.id
                                ? { ...item, days: event.target.value ? Number(event.target.value) : null }
                                : item
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={milestone.dateOccurred ? milestone.dateOccurred.slice(0, 10) : ""}
                        onChange={(event) =>
                          setMilestones((prev) =>
                            prev.map((item) =>
                              item.id === milestone.id
                                ? { ...item, dateOccurred: event.target.value || null }
                                : item
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={milestone.ownerRole ?? ""}
                        onChange={(event) =>
                          setMilestones((prev) =>
                            prev.map((item) =>
                              item.id === milestone.id
                                ? { ...item, ownerRole: event.target.value || null }
                                : item
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={milestone.notes ?? ""}
                        onChange={(event) =>
                          setMilestones((prev) =>
                            prev.map((item) =>
                              item.id === milestone.id
                                ? { ...item, notes: event.target.value || null }
                                : item
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => handleMilestoneSave(milestone)}>
                        Save
                      </button>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleMilestoneDelete(milestone)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {milestones.length === 0 && (
                <tr><td colSpan={7}>No milestones yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ProtocolProfileSection>

      <section className="card detail-card">
        <div className="section-title">
          <h2>Reviewer assignments</h2>
          {reviewerRows.length > 0 && (
            <span className="badge">{reviewerRows.length} reviewer{reviewerRows.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        {reviewerRows.length === 0 ? (
          <div className="empty-history">
            <span className="empty-history-icon">👥</span>
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
                  const dueMeta = getDueMeta(
                    item.dueDate,
                    item.submittedAt,
                    item.isActive
                  );
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

      <section className="card detail-card">
        <div className="section-title">
          <h2>Documents</h2>
          {submission.documents && submission.documents.length > 0 && (
            <span className="badge">
              {submission.documents.length} document{submission.documents.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {!submission.documents || submission.documents.length === 0 ? (
          <div className="empty-history">
            <span className="empty-history-icon">📎</span>
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
                {submission.documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      {doc.documentUrl ? (
                        <a
                          className="table-link"
                          href={doc.documentUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {doc.title}
                        </a>
                      ) : (
                        <span className="table-primary">{doc.title}</span>
                      )}
                    </td>
                    <td>{humanizeEnum(doc.type)}</td>
                    <td>
                      <span className="table-chip due-neutral">{humanizeEnum(doc.status)}</span>
                    </td>
                    <td>{formatDateDisplay(doc.receivedAt)}</td>
                    <td className="table-note">{doc.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {slaSummary && (
        <section className="card detail-card">
          <div className="section-title">
            <h2>SLA tracking</h2>
          </div>
          <div className="sla-track-grid">
            {[
              { label: 'Classification', data: slaSummary.classification },
              { label: 'Review', data: slaSummary.review },
              { label: 'Revision response', data: slaSummary.revisionResponse },
            ].map(({ label, data }) => {
              const status = getSlaStatus(data);
              const pct = getSlaPercent(data);
              const hasDays = data.actualWorkingDays != null;
              return (
                <div key={label} className={`sla-track-card sla-track-${status}`}>
                  <div className="sla-track-header">
                    <span className="sla-track-label">{label}</span>
                    {status !== 'pending' && (
                      <span className={`sla-track-badge sla-badge-${status}`}>
                        {status === 'on-track' ? '✓ On track' : status === 'due-soon' ? '⚠ Due soon' : '✕ Overdue'}
                      </span>
                    )}
                  </div>
                  <div className="sla-track-bar-wrap">
                    <div
                      className={`sla-track-bar sla-bar-${status}`}
                      style={{ width: `${hasDays ? pct : 0}%` }}
                    />
                  </div>
                  <div className="sla-track-numbers">
                    <span className="sla-track-actual">
                      {data.actualWorkingDays ?? '—'} <small>wd actual</small>
                    </span>
                    <span className="sla-track-target">
                      {data.configuredWorkingDays ?? '—'} <small>wd target</small>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {submission.statusHistory && (
        <section className="card detail-card">
          <Timeline entries={submission.statusHistory} />
        </section>
      )}

      <section className="card detail-card">
        <div className="section-title">
          <h2>Edit history</h2>
          {changeHistory.length > 0 && (
            <span className="badge">{changeHistory.length} edit{changeHistory.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {changeHistory.length === 0 ? (
          <div className="empty-history">
            <span className="empty-history-icon">📝</span>
            <p>No edits logged yet.</p>
          </div>
        ) : (
          <div className="history-list">
            {changeHistory.map((entry) => (
              <div key={`${entry.source}-${entry.id}`} className="history-item">
                <div className="history-header">
                  <span className="history-field-badge">
                    {formatFieldName(entry.fieldName)}
                  </span>
                  <span className="history-meta">
                    {entry.source} • {formatHistoryDate(entry.createdAt)}
                  </span>
                </div>
                <div className="history-change">
                  <span className="history-old">
                    {formatChangeValue(entry.fieldName, entry.oldValue)}
                  </span>
                  <span className="history-arrow">→</span>
                  <span className="history-new">
                    {formatChangeValue(entry.fieldName, entry.newValue)}
                  </span>
                </div>
                {entry.changedBy && (
                  <div className="history-user">
                    by {entry.changedBy.fullName}
                  </div>
                )}
                {entry.reason && (
                  <div className="history-reason">"{entry.reason}"</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
