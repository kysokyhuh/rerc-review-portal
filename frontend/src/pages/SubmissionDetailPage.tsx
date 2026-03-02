import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
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
  EditHistoryCard,
  MilestoneTable,
  toInputDate,
  getStatusVariant,
  STANDARD_MILESTONES,
} from "@/components/submission";
import type { OverviewFormState } from "@/components/submission";
import type { CommitteeSummary, ProtocolMilestone, SubmissionDetail } from "@/types";

export const SubmissionDetailPage: React.FC = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

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
    piName: "", committeeId: "", submissionType: "", receivedDate: "",
    status: "", finalDecision: "", finalDecisionDate: "", changeReason: "",
  });

  const numericId = submissionId ? Number(submissionId) : NaN;
  const { submission, slaSummary, loading, error, setSubmission } =
    useSubmissionDetail(numericId);
  const backTarget = `/dashboard${location.search ?? ""}`;
  const projectId = submission?.project?.id;

  /* ── helpers ── */
  const resetFormState = (source: SubmissionDetail) => {
    setFormState({
      piName: source.project?.piName ?? "",
      committeeId: source.project?.committee?.id ? String(source.project.committee.id) : "",
      submissionType: source.submissionType ?? "",
      receivedDate: toInputDate(source.receivedDate),
      status: source.status ?? "",
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
    setMilestones((submission.project as any)?.protocolMilestones ?? []);
  }, [submission]);

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
        status: formState.status || undefined,
        finalDecision: formState.finalDecision || null,
        finalDecisionDate: formState.finalDecisionDate ? new Date(formState.finalDecisionDate).toISOString() : null,
        piName: formState.piName.trim() || undefined,
        committeeId: formState.committeeId ? Number(formState.committeeId) : undefined,
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
    return <div className="loading-state"><p>Loading submission details...</p></div>;
  }

  const projectCode = submission.project?.projectCode ?? "N/A";
  const title = submission.project?.title ?? "Untitled submission";

  /* ── render ── */
  return (
    <div className="project-detail-page detail-v2">
      <header className="detail-hero">
        <Breadcrumbs items={[{ label: "Dashboard", href: backTarget }, { label: projectCode }]} />
        <div className="detail-hero-content">
          <div className="detail-hero-text">
            <span className="detail-project-code">{projectCode}</span>
            <h1 className="detail-title">{title}</h1>
            <span className="detail-subtitle">Submission #{submission.id}</span>
          </div>
          <span className={`badge badge-lg ${getStatusVariant(submission.status)}`}>
            {submission.status.replace(/_/g, " ")}
          </span>
        </div>
      </header>

      <SubmissionOverviewCard
        submission={submission} isEditing={isEditing}
        saving={saving} saveError={saveError}
        formState={formState} setFormState={setFormState}
        committees={committees}
        onEditStart={handleEditStart} onEditCancel={handleEditCancel} onSave={handleSave}
      />

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

      {submission.statusHistory && (
        <section className="card detail-card">
          <Timeline entries={submission.statusHistory} />
        </section>
      )}

      <EditHistoryCard changeHistory={changeHistory} committees={committees} />
    </div>
  );
};
