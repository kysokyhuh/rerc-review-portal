import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import {
  createProtocolMilestone,
  deleteProtocolMilestone,
  exportInitialAckCSV,
  exportInitialApprovalDocx,
  updateProtocolMilestone,
  updateProtocolProfile,
} from "@/services/api";
import { Timeline } from "@/components/Timeline";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  ProtocolProfileSection,
  profileToFormState,
  formStateToPayload,
} from "@/components/ProtocolProfileSection";
import type { ProtocolMilestone } from "@/types";

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [exporting, setExporting] = useState<string | null>(null);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<Record<string, string>>({});
  const [milestones, setMilestones] = useState<ProtocolMilestone[]>([]);
  const [newMilestoneLabel, setNewMilestoneLabel] = useState("");
  const backTarget = `/dashboard${location.search ?? ""}`;

  if (!projectId) {
    return <div>Project ID is required</div>;
  }

  const { project, loading, error } = useProjectDetail(parseInt(projectId));

  useEffect(() => {
    if (!project) return;
    setProfileForm(profileToFormState(project.protocolProfile));
    setMilestones(project.protocolMilestones ?? []);
  }, [project]);

  if (error) {
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

  const getStatusVariant = (status: string) => {
    const s = status.toUpperCase();
    if (['CLOSED', 'WITHDRAWN'].includes(s)) return 'badge-neutral';
    if (['AWAITING_REVISIONS', 'REVISION_SUBMITTED'].includes(s)) return 'badge-warning';
    if (['UNDER_REVIEW', 'UNDER_CLASSIFICATION', 'UNDER_COMPLETENESS_CHECK'].includes(s)) return 'badge-info';
    if (['APPROVED'].includes(s)) return 'badge-positive';
    return 'badge-positive';
  };

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

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const handleSaveProfile = async () => {
    if (!project) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const payload = formStateToPayload(profileForm);
      const saved = await updateProtocolProfile(project.id, payload);
      setProfileForm(profileToFormState(saved));
      setProfileEditing(false);
    } catch (err: any) {
      setProfileError(err?.response?.data?.message || err?.message || "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAddMilestone = async () => {
    if (!project || !newMilestoneLabel.trim()) return;
    try {
      const created = await createProtocolMilestone(project.id, {
        label: newMilestoneLabel.trim(),
        orderIndex: milestones.length,
      });
      setMilestones((prev) => [...prev, created]);
      setNewMilestoneLabel("");
    } catch {
      setProfileError("Failed to add milestone");
    }
  };

  const handleMilestoneSave = async (row: ProtocolMilestone) => {
    if (!project) return;
    try {
      const updated = await updateProtocolMilestone(project.id, row.id, {
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
    if (!project) return;
    try {
      await deleteProtocolMilestone(project.id, row.id);
      setMilestones((prev) => prev.filter((item) => item.id !== row.id));
    } catch {
      setProfileError("Failed to delete milestone");
    }
  };

  return (
    <div className="project-detail-page detail-v2">
      {/* Hero */}
      <header className="detail-hero">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: backTarget },
          { label: project.projectCode },
        ]} />
        <div className="detail-hero-content">
          <div className="detail-hero-text">
            <span className="detail-project-code">{project.projectCode}</span>
            <h1 className="detail-title">{project.title || "—"}</h1>
            <div className="detail-hero-meta">
              <span className="detail-meta-item">
                <span className="detail-meta-label">PI</span> {project.piName || "—"}
              </span>
              <span className="detail-meta-sep">·</span>
              <span className="detail-meta-item">
                <span className="detail-meta-label">Committee</span> {project.committee.name}
              </span>
            </div>
          </div>
          <span className={`badge badge-lg ${getStatusVariant(project.overallStatus)}`}>
            {project.overallStatus.replace(/_/g, ' ')}
          </span>
        </div>
      </header>

      <ProtocolProfileSection
        profile={project.protocolProfile}
        editing={profileEditing}
        saving={profileSaving}
        error={profileError}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        onEdit={() => setProfileEditing(true)}
        onSave={handleSaveProfile}
        onCancel={() => setProfileEditing(false)}
      >
        {/* Milestones */}
        <div style={{ marginTop: "1rem" }}>
          <h3 className="pp-group-name" style={{ marginBottom: 8 }}>Milestones / # days</h3>
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
                <th>Label</th>
                <th># days</th>
                <th>Date</th>
                <th>Owner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((milestone) => (
                <tr key={milestone.id}>
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
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => handleMilestoneSave(milestone)}>
                      Save
                    </button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleMilestoneDelete(milestone)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {milestones.length === 0 && (
                <tr><td colSpan={5}>No milestones yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ProtocolProfileSection>

      {/* Latest Submission */}
      {latestSubmission && (
        <section className="card detail-card">
          <div className="section-title">
            <h2>Latest submission</h2>
            <span className={`badge ${getStatusVariant(latestSubmission.status)}`}>
              {latestSubmission.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="header-grid">
            <div className="field">
              <label>Type</label>
              <p>{latestSubmission.submissionType || "—"}</p>
            </div>
            <div className="field">
              <label>Received date</label>
              <p>{formatDate(latestSubmission.receivedDate)}</p>
            </div>
            {latestSubmission.finalDecision && (
              <>
                <div className="field">
                  <label>Final decision</label>
                  <p>{latestSubmission.finalDecision}</p>
                </div>
                <div className="field">
                  <label>Decision date</label>
                  <p>{formatDate(latestSubmission.finalDecisionDate)}</p>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Actions */}
      {latestSubmission && (
        <section className="card detail-card">
          <div className="section-title">
            <h2>Actions</h2>
          </div>
          <div className="action-cards-grid">
            <button
              onClick={handleExportAckCSV}
              disabled={exporting === "ack-csv"}
              className="action-card"
            >
              <span className="action-card-icon">📄</span>
              <span className="action-card-label">
                {exporting === "ack-csv" ? "Exporting..." : "Download Initial Acknowledgement"}
              </span>
              <span className="action-card-format">CSV</span>
            </button>
            {latestSubmission.finalDecision === "APPROVED" && (
              <button
                onClick={handleExportApprovalDocx}
                disabled={exporting === "approval-docx"}
                className="action-card action-card-primary"
              >
                <span className="action-card-icon">📋</span>
                <span className="action-card-label">
                  {exporting === "approval-docx" ? "Exporting..." : "Download Approval Letter"}
                </span>
                <span className="action-card-format">DOCX</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Timeline */}
      {latestSubmission?.statusHistory && (
        <section className="card detail-card">
          <Timeline entries={latestSubmission.statusHistory} />
        </section>
      )}
    </div>
  );
};
