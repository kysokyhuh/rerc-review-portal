import React from "react";
import { formatDateDisplay } from "@/utils/dateUtils";
import type { CommitteeSummary, SubmissionDetail } from "@/types";
import { SUBMISSION_TYPE_OPTIONS, FINAL_DECISION_OPTIONS } from "./submissionUtils";

interface OverviewFormState {
  piName: string;
  committeeId: string;
  submissionType: string;
  receivedDate: string;
  finalDecision: string;
  finalDecisionDate: string;
  changeReason: string;
}

interface SubmissionOverviewCardProps {
  submission: SubmissionDetail;
  isEditing: boolean;
  saving: boolean;
  saveError: string | null;
  formState: OverviewFormState;
  setFormState: React.Dispatch<React.SetStateAction<OverviewFormState>>;
  committees: CommitteeSummary[];
  onEditStart: () => void;
  onEditCancel: () => void;
  onSave: () => void;
}

export function SubmissionOverviewCard({
  submission, isEditing, saving, saveError,
  formState, setFormState, committees,
  onEditStart, onEditCancel, onSave,
}: SubmissionOverviewCardProps) {
  const updateField = (field: keyof OverviewFormState, value: string) =>
    setFormState((prev) => ({ ...prev, [field]: value }));

  return (
    <section className="card detail-card">
      <div className="section-title">
        <div className="section-title-left">
          <h2>Submission overview</h2>
          {saveError && <p className="error-text">{saveError}</p>}
        </div>
        <div className="section-actions">
          {isEditing ? (
            <>
              <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onEditCancel} disabled={saving}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={onEditStart}>
              ✎ Edit overview
            </button>
          )}
        </div>
      </div>
      <div className="header-grid">
        <div className="field">
          <label>PI</label>
          {isEditing ? (
            <input className="field-input" value={formState.piName}
              onChange={(e) => updateField("piName", e.target.value)} placeholder="Principal investigator name" />
          ) : (
            <p>{submission.project?.piName ?? "—"}</p>
          )}
        </div>
        <div className="field">
          <label>Committee</label>
          {isEditing ? (
            <select className="field-input" value={formState.committeeId}
              onChange={(e) => updateField("committeeId", e.target.value)}>
              <option value="">Select committee</option>
              {committees.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
            </select>
          ) : (
            <p>{submission.project?.committee?.name ?? "—"}</p>
          )}
        </div>
        <div className="field">
          <label>Submission type</label>
          {isEditing ? (
            <select className="field-input" value={formState.submissionType}
              onChange={(e) => updateField("submissionType", e.target.value)}>
              {SUBMISSION_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <p>{submission.submissionType}</p>
          )}
        </div>
        <div className="field">
          <label>Received</label>
          {isEditing ? (
            <input className="field-input" type="date" value={formState.receivedDate}
              onChange={(e) => updateField("receivedDate", e.target.value)} />
          ) : (
            <p>{formatDateDisplay(submission.receivedDate)}</p>
          )}
        </div>
        <div className="field">
          <label>Current status</label>
          <p>{submission.status}</p>
        </div>
        {(isEditing || submission.finalDecision) && (
          <>
            <div className="field">
              <label>Final decision</label>
              {isEditing ? (
                <select className="field-input" value={formState.finalDecision}
                  onChange={(e) => updateField("finalDecision", e.target.value)}>
                  <option value="">—</option>
                  {FINAL_DECISION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <p>{submission.finalDecision ?? "—"}</p>
              )}
            </div>
            <div className="field">
              <label>Decision date</label>
              {isEditing ? (
                <input className="field-input" type="date" value={formState.finalDecisionDate}
                  onChange={(e) => updateField("finalDecisionDate", e.target.value)} />
              ) : (
                <p>{formatDateDisplay(submission.finalDecisionDate)}</p>
              )}
            </div>
          </>
        )}
        {isEditing && (
          <div className="field field-wide">
            <label>Reason for change (optional)</label>
            <textarea className="field-input" rows={3} value={formState.changeReason}
              onChange={(e) => updateField("changeReason", e.target.value)}
              placeholder="Add context for the update..." />
          </div>
        )}
      </div>
    </section>
  );
}

export type { OverviewFormState };
