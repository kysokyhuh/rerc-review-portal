import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  fetchCommittees,
  fetchCommitteePanels,
  fetchSubmissionDetail,
  deleteProjectRecord,
  waitForBackendReady,
  updateSubmissionWorkflowStage,
  setSubmissionReviewTrack,
  updateProtocolProfile,
  updateSubmissionOverview,
  createProtocolMilestone,
  updateProtocolMilestone,
  deleteProtocolMilestone,
} from "@/services/api";
import { useSubmissionDetail } from "@/hooks/useSubmissionDetail";
import { useColdStartStatus } from "@/hooks/useColdStartStatus";
import { Timeline } from "@/components/Timeline";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  ProtocolProfileSection,
  profileToFormState,
  formStateToPayload,
} from "@/components/ProtocolProfileSection";
import {
  SubmissionOverviewCard,
  ReviewerAssignmentsCard,
  DocumentsCard,
  SlaTrackingCard,
  ReminderLogCard,
  EditHistoryCard,
  MilestoneTable,
  toInputDate,
  getStatusVariant,
  STANDARD_MILESTONES,
} from "@/components/submission";
import type { OverviewFormState } from "@/components/submission";
import type { CommitteeSummary, ProtocolMilestone, SubmissionDetail } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/utils";

type ClassificationStatusStage =
  | "AWAITING_CLASSIFICATION"
  | "UNDER_CLASSIFICATION"
  | "CLASSIFIED";

const COLD_START_DELETE_ERROR =
  "The server is still waking up. Please wait a few seconds and try again.";

const REVIEW_TYPE_OPTIONS = ["", "EXEMPT", "EXPEDITED", "FULL_BOARD"] as const;

const normalizeClassificationStatus = (
  value: string
): ClassificationStatusStage => {
  if (
    value === "RECEIVED" ||
    value === "UNDER_COMPLETENESS_CHECK" ||
    value === "RETURNED_FOR_COMPLETION" ||
    value === "NOT_ACCEPTED"
  ) {
    return "AWAITING_CLASSIFICATION";
  }
  if (
    value === "AWAITING_CLASSIFICATION" ||
    value === "UNDER_CLASSIFICATION" ||
    value === "CLASSIFIED"
  ) {
    return value;
  }
  return "CLASSIFIED";
};

function SubmissionDetailLoadingState() {
  const overviewFields = [
    "Principal investigator",
    "Submission type",
    "Received",
    "Current status",
    "Decision date",
  ];

  return (
    <div
      className="project-detail-page detail-v2 detail-loading-page portal-page portal-page--dense"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="detail-hero detail-loading-hero">
        <div className="detail-loading-breadcrumbs" aria-hidden="true">
          <span className="detail-skeleton detail-skeleton-pill detail-loading-breadcrumb-item detail-loading-breadcrumb-item-wide" />
          <span className="detail-loading-breadcrumb-separator" />
          <span className="detail-skeleton detail-skeleton-pill detail-loading-breadcrumb-item" />
        </div>

        <div className="detail-hero-content detail-loading-hero-content">
          <div className="detail-hero-text detail-loading-copy">
            <span className="detail-project-code detail-loading-kicker">
              Preparing submission workspace
            </span>
            <span
              className="detail-skeleton detail-skeleton-line detail-skeleton-title"
              aria-hidden="true"
            />
            <span
              className="detail-skeleton detail-skeleton-line detail-skeleton-subtitle"
              aria-hidden="true"
            />
            <div className="detail-loading-meta-row" aria-hidden="true">
              <span className="detail-skeleton detail-skeleton-pill detail-loading-meta-pill detail-loading-meta-pill-wide" />
              <span className="detail-skeleton detail-skeleton-pill detail-loading-meta-pill" />
              <span className="detail-skeleton detail-skeleton-pill detail-loading-meta-pill detail-loading-meta-pill-compact" />
            </div>
            <p className="detail-loading-support">
              Please wait while the portal retrieves the latest submission data,
              review routing, and status history.
            </p>
          </div>

          <div className="detail-loading-indicator" role="status">
            <div className="detail-loading-indicator-copy">
              <strong>Loading submission details</strong>
              <span>Syncing protocol overview and lifecycle records.</span>
            </div>
          </div>
        </div>
      </header>

      <section className="card detail-card detail-loading-card">
        <div className="section-title">
          <div className="section-title-left">
            <h2>Submission overview</h2>
            <p className="detail-loading-section-copy">
              Core protocol metadata and decision context.
            </p>
          </div>
          <span
            className="detail-skeleton detail-skeleton-button"
            aria-hidden="true"
          />
        </div>
        <div className="header-grid detail-loading-field-grid">
          {overviewFields.map((label, index) => (
            <div className="field detail-loading-field" key={label}>
              <label>{label}</label>
              <span
                className={`detail-skeleton detail-skeleton-input detail-skeleton-width-${
                  (index % 3) + 1
                }`}
                aria-hidden="true"
              />
              <span
                className={`detail-skeleton detail-skeleton-line detail-skeleton-field-meta detail-skeleton-width-${
                  ((index + 1) % 3) + 1
                }`}
                aria-hidden="true"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card detail-card detail-loading-card">
        <div className="section-title">
          <div className="section-title-left">
            <h2>Workflow and supporting records</h2>
            <p className="detail-loading-section-copy">
              Review routing, documents, SLA indicators, and recent history.
            </p>
          </div>
        </div>
        <div className="classification-controls-grid detail-loading-controls-grid">
          <div className="field detail-loading-field">
            <label>Classification status</label>
            <span className="detail-skeleton detail-skeleton-input detail-skeleton-width-2" aria-hidden="true" />
          </div>
          <div className="field detail-loading-field">
            <label>Type of review</label>
            <span className="detail-skeleton detail-skeleton-input detail-skeleton-width-1" aria-hidden="true" />
          </div>
          <div className="classification-save-cell detail-loading-action-cell">
            <span className="detail-skeleton detail-skeleton-button detail-skeleton-button-wide" aria-hidden="true" />
          </div>
        </div>
        <div className="detail-loading-secondary-grid">
          <div className="detail-loading-list" aria-hidden="true">
            <span className="detail-skeleton detail-skeleton-line detail-skeleton-width-4" />
            <span className="detail-skeleton detail-skeleton-line detail-skeleton-width-5" />
            <span className="detail-skeleton detail-skeleton-line detail-skeleton-width-3" />
          </div>
          <div className="detail-loading-list" aria-hidden="true">
            <span className="detail-skeleton detail-skeleton-line detail-skeleton-width-5" />
            <span className="detail-skeleton detail-skeleton-line detail-skeleton-width-2" />
            <span className="detail-skeleton detail-skeleton-line detail-skeleton-width-4" />
          </div>
          <div className="detail-loading-sla-grid" aria-hidden="true">
            {[0, 1, 2].map((item) => (
              <div className="detail-loading-sla-card" key={item}>
                <span className="detail-skeleton detail-skeleton-line detail-skeleton-width-2" />
                <span className="detail-skeleton detail-skeleton-bar" />
                <span className="detail-skeleton detail-skeleton-line detail-skeleton-width-3" />
              </div>
            ))}
          </div>
        </div>
        <div className="detail-loading-timeline" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <div className="detail-loading-timeline-item" key={item}>
              <span className="detail-loading-timeline-dot" />
              <div className="detail-loading-timeline-copy">
                <span className="detail-skeleton detail-skeleton-line detail-skeleton-width-3" />
                <span className="detail-skeleton detail-skeleton-line detail-skeleton-width-5" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export const SubmissionDetailPage: React.FC = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const { user } = useAuth();
  const isColdStart = useColdStartStatus();
  const locationState = (location.state as
    | { createdProtocol?: boolean; banner?: string; projectCode?: string }
    | null) ?? null;
  /* ── state ── */
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
  const [formState, setFormState] = useState<OverviewFormState>({
    piName: "", submissionType: "", receivedDate: "",
    finalDecision: "", finalDecisionDate: "", changeReason: "",
  });
  const [classificationStatusPending, setClassificationStatusPending] = useState<
    "AWAITING_CLASSIFICATION" | "UNDER_CLASSIFICATION"
  >("AWAITING_CLASSIFICATION");
  const [reviewTypePending, setReviewTypePending] = useState<
    "" | "EXEMPT" | "EXPEDITED" | "FULL_BOARD"
  >("");
  const [panelIdPending, setPanelIdPending] = useState<number | null>(null);
  const [panels, setPanels] = useState<Array<{ id: number; name: string; code: string | null }>>([]);
  const [panelsLoading, setPanelsLoading] = useState(false);
  const [classificationSaving, setClassificationSaving] = useState(false);
  const [classificationMessage, setClassificationMessage] = useState<string | null>(null);
  const [classificationError, setClassificationError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [creationBannerVisible, setCreationBannerVisible] = useState(
    Boolean(locationState?.createdProtocol)
  );

  const numericId = submissionId ? Number(submissionId) : NaN;
  const { submission, slaSummary, loading, error, setSubmission } =
    useSubmissionDetail(numericId);
  const backTarget = `/dashboard${location.search ?? ""}`;
  const projectId = submission?.project?.id;

  /* ── helpers ── */
  const resetFormState = (source: SubmissionDetail) => {
    setFormState({
      piName: source.project?.piName ?? "",
      submissionType: source.submissionType ?? "",
      receivedDate: toInputDate(source.receivedDate),
      finalDecision: source.finalDecision ?? "",
      finalDecisionDate: toInputDate(source.finalDecisionDate),
      changeReason: "",
    });
  };

  /* ── effects ── */
  useEffect(() => {
    let active = true;
    fetchCommittees()
      .then((data) => { if (active) setCommittees(data); })
      .catch(() => { if (active) setCommittees([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!submission) return;
    resetFormState(submission);
    setProfileForm(profileToFormState(submission.project?.protocolProfile));
    setMilestones(submission.project?.protocolMilestones ?? []);
    const normalized = normalizeClassificationStatus(submission.status);
    setClassificationStatusPending(
      normalized === "UNDER_CLASSIFICATION"
        ? "UNDER_CLASSIFICATION"
        : "AWAITING_CLASSIFICATION"
    );
    const nextType = REVIEW_TYPE_OPTIONS.includes(
      (submission.classification?.reviewType ?? "") as
        | ""
        | "EXEMPT"
        | "EXPEDITED"
        | "FULL_BOARD"
    )
      ? ((submission.classification?.reviewType ?? "") as
          | ""
          | "EXEMPT"
          | "EXPEDITED"
          | "FULL_BOARD")
      : "";
    setReviewTypePending(nextType);
    setPanelIdPending(submission.classification?.panelId ?? null);
    setClassificationMessage(null);
    setClassificationError(null);
  }, [submission]);

  // Load committee panels when committee code is known
  const committeeCode = submission?.project?.committee?.code;
  useEffect(() => {
    if (!committeeCode) return;
    let active = true;
    setPanelsLoading(true);
    fetchCommitteePanels(committeeCode)
      .then((data) => { if (active) setPanels(data); })
      .catch(() => { if (active) setPanels([]); })
      .finally(() => { if (active) setPanelsLoading(false); });
    return () => { active = false; };
  }, [committeeCode]);

  /* ── handlers ── */
  const handleProfileSave = async () => {
    if (!submission?.project?.id) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const payload = formStateToPayload(profileForm);
      payload._meta = { sourceSubmissionId: numericId };
      await updateProtocolProfile(submission.project.id, payload);
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

  const handleAddMilestone = async () => {
    if (!projectId || !newMilestoneLabel.trim()) return;
    try {
      const created = await createProtocolMilestone(projectId, {
        label: newMilestoneLabel.trim(), orderIndex: milestones.length,
      });
      setMilestones((prev) => [...prev, created]);
      setNewMilestoneLabel("");
    } catch { setProfileError("Failed to add milestone"); }
  };

  const handleLoadStandardTimeline = async () => {
    if (!projectId) return;
    if (milestones.length > 0 && !window.confirm(
      "This will add the standard timeline milestones to the existing list. Continue?"
    )) return;
    try {
      const startIndex = milestones.length;
      const created: ProtocolMilestone[] = [];
      for (let i = 0; i < STANDARD_MILESTONES.length; i++) {
        const m = STANDARD_MILESTONES[i];
        const result = await createProtocolMilestone(projectId, {
          label: m.label, ownerRole: m.ownerRole, orderIndex: startIndex + i,
        });
        created.push(result);
      }
      setMilestones((prev) => [...prev, ...created]);
    } catch { setProfileError("Failed to load standard timeline"); }
  };

  const handleMilestoneSave = async (row: ProtocolMilestone) => {
    if (!projectId) return;
    try {
      const updated = await updateProtocolMilestone(projectId, row.id, {
        label: row.label, orderIndex: row.orderIndex,
        days: row.days ?? null, dateOccurred: row.dateOccurred ?? null,
        ownerRole: row.ownerRole ?? null, notes: row.notes ?? null,
      });
      setMilestones((prev) => prev.map((item) => (item.id === row.id ? updated : item)));
    } catch { setProfileError("Failed to save milestone"); }
  };

  const handleMilestoneDelete = async (row: ProtocolMilestone) => {
    if (!projectId) return;
    try {
      await deleteProtocolMilestone(projectId, row.id);
      setMilestones((prev) => prev.filter((item) => item.id !== row.id));
    } catch { setProfileError("Failed to delete milestone"); }
  };

  const handleEditStart = () => { setSaveError(null); setIsEditing(true); };
  const handleEditCancel = () => {
    if (submission) resetFormState(submission);
    setSaveError(null); setIsEditing(false);
  };

  const handleSave = async () => {
    if (!submission) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        submissionType: formState.submissionType || undefined,
        receivedDate: formState.receivedDate ? new Date(formState.receivedDate).toISOString() : undefined,
        finalDecision: formState.finalDecision || null,
        finalDecisionDate: formState.finalDecisionDate ? new Date(formState.finalDecisionDate).toISOString() : null,
        piName: formState.piName.trim() || undefined,
        changeReason: formState.changeReason.trim() || undefined,
      };
      const updated = await updateSubmissionOverview(numericId, payload);
      setSubmission(updated);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update submission");
    } finally {
      setSaving(false);
    }
  };

  const isChair = Boolean(user?.roles?.includes("CHAIR"));
  const canDeleteProtocol = Boolean(
    projectId &&
      user?.roles?.some((role) => role === "CHAIR" || role === "ADMIN")
  );
  const canManageClassification = isChair;
  const currentStatus = normalizeClassificationStatus(submission?.status ?? "CLASSIFIED");
  const currentReviewType = REVIEW_TYPE_OPTIONS.includes(
    (submission?.classification?.reviewType ?? "") as
      | ""
      | "EXEMPT"
      | "EXPEDITED"
      | "FULL_BOARD"
  )
    ? ((submission?.classification?.reviewType ?? "") as
        | ""
        | "EXEMPT"
        | "EXPEDITED"
        | "FULL_BOARD")
    : "";
  const currentPanelId = submission?.classification?.panelId ?? null;
  const reviewTypeEnabled =
    classificationStatusPending === "UNDER_CLASSIFICATION" ||
    currentStatus === "CLASSIFIED" ||
    currentReviewType !== "";
  const controlsDirty =
    classificationStatusPending !==
      (currentStatus === "UNDER_CLASSIFICATION"
        ? "UNDER_CLASSIFICATION"
        : "AWAITING_CLASSIFICATION") ||
    reviewTypePending !== currentReviewType ||
    (reviewTypePending === "FULL_BOARD" && panelIdPending !== currentPanelId);

  const handleSaveClassificationControls = async () => {
    setClassificationSaving(true);
    setClassificationError(null);
    setClassificationMessage(null);
    try {
      if (!reviewTypePending) {
        if (currentReviewType) {
          await setSubmissionReviewTrack(numericId, { reviewType: null });
          if (currentStatus === "CLASSIFIED") {
            setClassificationMessage(
              "Type of Review cleared. Classification Status remains CLASSIFIED."
            );
          } else {
            await updateSubmissionWorkflowStage(numericId, {
              newStatus: "AWAITING_CLASSIFICATION",
            });
            setClassificationMessage(
              "Type of Review cleared. Classification Status set to AWAITING CLASSIFICATION."
            );
          }
        } else {
          await updateSubmissionWorkflowStage(numericId, {
            newStatus: classificationStatusPending,
          });
          setClassificationMessage(
            `Classification Status updated to ${classificationStatusPending.replace(/_/g, " ")}.`
          );
        }
      } else {
        await setSubmissionReviewTrack(numericId, {
          reviewType: reviewTypePending,
          classificationDate: new Date().toISOString(),
          panelId: reviewTypePending === "FULL_BOARD" ? (panelIdPending || null) : undefined,
        });
        const trackLabel = reviewTypePending === "FULL_BOARD" ? "FULL REVIEW" : reviewTypePending;
        setClassificationMessage(
          `Classified as ${trackLabel}. Status updated to CLASSIFIED.`
        );
      }
      const refreshed = await fetchSubmissionDetail(numericId);
      setSubmission(refreshed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save classification controls.";
      setClassificationError(message);
    } finally {
      setClassificationSaving(false);
    }
  };

  const openDeleteDialog = () => {
    setDeleteDialogOpen(true);
    setDeleteReason("");
    setDeleteError(null);
  };

  const closeDeleteDialog = () => {
    if (deleteSubmitting) return;
    setDeleteDialogOpen(false);
    setDeleteReason("");
    setDeleteError(null);
  };

  useEffect(() => {
    if (!deleteDialogOpen || isColdStart || deleteError !== COLD_START_DELETE_ERROR) {
      return;
    }
    setDeleteError(null);
  }, [deleteDialogOpen, deleteError, isColdStart]);

  const handleDeleteProtocol = async () => {
    if (!projectId) return;
    const trimmedReason = deleteReason.trim();
    if (!trimmedReason) {
      setDeleteError("Reason is required.");
      return;
    }

    try {
      setDeleteSubmitting(true);
      setDeleteError(null);
      await waitForBackendReady();
      await deleteProjectRecord(projectId, { reason: trimmedReason });
      setDeleteDialogOpen(false);
      setDeleteReason("");
      setDeleteError(null);
      navigate("/recently-deleted", { replace: true });
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Failed to delete protocol."));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  /* ── derived data ── */
  const changeHistory = useMemo(() => {
    if (!submission) return [];
    const combined = [
      ...(submission.changeLogs ?? []).map((e) => ({ ...e, source: "Submission" })),
      ...(submission.projectChangeLogs ?? []).map((e) => ({ ...e, source: "Project" })),
    ];
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [submission]);

  const reviewerRows = useMemo(() => {
    if (!submission) return [];
    if (submission.reviewAssignments && submission.reviewAssignments.length > 0) {
      return submission.reviewAssignments.map((item) => ({
        id: `assign-${item.id}`, name: item.reviewer?.fullName ?? "Unknown reviewer",
        email: item.reviewer?.email ?? "—", role: item.reviewerRole,
        assignedAt: item.assignedAt, dueDate: item.dueDate,
        submittedAt: item.submittedAt, decision: item.decision,
        endorsementStatus: item.endorsementStatus, isActive: item.isActive,
      }));
    }
    return (submission.reviews ?? []).map((item) => ({
      id: `review-${item.id}`, name: item.reviewer?.fullName ?? "Unknown reviewer",
      email: item.reviewer?.email ?? "—", role: item.reviewerRole,
      assignedAt: item.assignedAt ?? null, dueDate: item.dueDate ?? null,
      submittedAt: item.respondedAt ?? null, decision: item.decision ?? null,
      endorsementStatus: item.endorsementStatus ?? null, isActive: true,
    }));
  }, [submission]);

  /* ── early returns ── */
  if (!submissionId || Number.isNaN(numericId)) {
    return <div>Submission ID is required</div>;
  }
  if (error) {
    return (
      <div className="error-state">
        <h1>Error Loading Submission</h1>
        <p>{error}</p>
        <Link to={backTarget} className="back-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    );
  }
  if (loading || !submission) {
    return <SubmissionDetailLoadingState />;
  }

  const projectCode = submission.project?.projectCode ?? "N/A";
  const title = submission.project?.title ?? "Untitled submission";

  /* ── render ── */
  return (
    <div className="project-detail-page detail-v2 portal-page portal-page--dense">
      {creationBannerVisible && locationState?.banner ? (
        <section className="card detail-card" style={{ borderColor: "var(--primary)", background: "var(--primary-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <strong>{locationState.banner}</strong>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setCreationBannerVisible(false)}
              aria-label="Dismiss creation banner"
            >
              Dismiss
            </button>
          </div>
        </section>
      ) : null}
      <header className="detail-hero">
        <Breadcrumbs items={[{ label: "Dashboard", href: backTarget }, { label: projectCode }]} />
        <div className="detail-hero-content">
          <div className="detail-hero-text">
            <span className="detail-project-code">{projectCode}</span>
            <h1 className="detail-title">{title}</h1>
            <span className="detail-subtitle">Submission #{submission.id}</span>
          </div>
          <div className="detail-hero-actions">
            <span className={`badge badge-lg ${getStatusVariant(submission.status)}`}>
              {submission.status.replace(/_/g, " ")}
            </span>
            {canDeleteProtocol ? (
              <div className="archive-hero-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={openDeleteDialog}
                >
                  Delete Protocol
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <SubmissionOverviewCard
        submission={submission} isEditing={isEditing}
        saving={saving} saveError={saveError}
        formState={formState} setFormState={setFormState}
        onEditStart={handleEditStart} onEditCancel={handleEditCancel} onSave={handleSave}
      />

      <section className="card detail-card">
        <div className="section-title">
          <div className="section-title-left">
            <h2>Classification controls</h2>
          </div>
        </div>
        {!canManageClassification && (
          <p className="field-helper">
            Classification controls are managed by the Chair.
          </p>
        )}
        <div className="classification-controls-grid">
          <div className="field">
            <label>Classification Status</label>
            {currentStatus === "CLASSIFIED" ? (
              <div className="field-input classification-readonly">CLASSIFIED</div>
            ) : (
              <select
                className="field-input"
                value={classificationStatusPending}
                onChange={(event) =>
                  setClassificationStatusPending(
                    event.target.value as "AWAITING_CLASSIFICATION" | "UNDER_CLASSIFICATION"
                  )
                }
                disabled={!canManageClassification || classificationSaving}
              >
                <option value="AWAITING_CLASSIFICATION">Awaiting Classification</option>
                <option value="UNDER_CLASSIFICATION">Under Classification</option>
              </select>
            )}
          </div>
          <div className="field">
            <label>Type of Review</label>
            <select
              className="field-input"
              value={reviewTypePending}
              onChange={(event) =>
                setReviewTypePending(
                  event.target.value as "" | "EXEMPT" | "EXPEDITED" | "FULL_BOARD"
                )
              }
              disabled={!canManageClassification || !reviewTypeEnabled || classificationSaving}
            >
              <option value="">—</option>
              <option value="EXEMPT">Exempted</option>
              <option value="EXPEDITED">Expedited</option>
              <option value="FULL_BOARD">Full Review</option>
            </select>
          </div>
          <div className="classification-save-cell">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void handleSaveClassificationControls()}
              disabled={!canManageClassification || classificationSaving || !controlsDirty}
            >
              {classificationSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        {reviewTypePending === "FULL_BOARD" && (
          <div className="classification-panel-row">
            <div className="field">
              <label>Panel</label>
              <select
                className="field-input"
                value={panelIdPending ?? ""}
                onChange={(event) => {
                  const val = event.target.value;
                  setPanelIdPending(val ? Number(val) : null);
                }}
                disabled={!canManageClassification || classificationSaving || panelsLoading}
              >
                <option value="">— No panel assigned —</option>
                {panels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.code ? ` (${p.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {classificationMessage ? <p className="field-success">{classificationMessage}</p> : null}
        {classificationError ? <p className="error-text">{classificationError}</p> : null}
      </section>

      <ProtocolProfileSection
        profile={submission.project?.protocolProfile}
        editing={profileEditing} saving={profileSaving} error={profileError}
        profileForm={profileForm} setProfileForm={setProfileForm}
        onEdit={() => setProfileEditing(true)} onSave={handleProfileSave}
        onCancel={() => setProfileEditing(false)}
      >
        <MilestoneTable
          milestones={milestones} setMilestones={setMilestones}
          newMilestoneLabel={newMilestoneLabel} setNewMilestoneLabel={setNewMilestoneLabel}
          onAddMilestone={handleAddMilestone} onLoadStandardTimeline={handleLoadStandardTimeline}
          onSaveMilestone={handleMilestoneSave} onDeleteMilestone={handleMilestoneDelete}
        />
      </ProtocolProfileSection>

      <ReviewerAssignmentsCard reviewerRows={reviewerRows} />
      <DocumentsCard documents={submission.documents ?? []} />
      {slaSummary && <SlaTrackingCard slaSummary={slaSummary} />}
      <ReminderLogCard reminders={submission.reminderLogs ?? []} />

      {submission.statusHistory && (
        <section className="card detail-card">
          <Timeline entries={submission.statusHistory} />
        </section>
      )}

      <EditHistoryCard changeHistory={changeHistory} committees={committees} />

      {deleteDialogOpen ? (
        <div
          className="archive-dialog-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={closeDeleteDialog}
        >
          <div className="archive-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="archive-dialog-header">
              <div>
                <h3>Delete Protocol</h3>
                <p>
                  Deleting moves this protocol to Recently Deleted for 30 days. It
                  becomes read-only until restored.
                </p>
              </div>
              <button
                type="button"
                className="archive-dialog-close"
                onClick={closeDeleteDialog}
                aria-label="Close delete dialog"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>
            <div className="archive-dialog-body">
              <label htmlFor="submission-delete-reason" className="archive-dialog-label">
                Reason
              </label>
              <textarea
                id="submission-delete-reason"
                className="archive-dialog-textarea"
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                placeholder="Explain why this protocol is being deleted."
                disabled={deleteSubmitting || isColdStart}
              />
              {isColdStart ? (
                <p className="archive-dialog-error" role="status">
                  The server is still waking up. Wait for the banner to clear before deleting.
                </p>
              ) : null}
              {deleteError ? (
                <p className="archive-dialog-error" role="alert">
                  {deleteError}
                </p>
              ) : null}
            </div>
            <div className="archive-dialog-footer">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeDeleteDialog}
                disabled={deleteSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleDeleteProtocol}
                disabled={deleteSubmitting || isColdStart}
              >
                {deleteSubmitting ? "Deleting..." : isColdStart ? "Server waking up..." : "Delete Protocol"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
