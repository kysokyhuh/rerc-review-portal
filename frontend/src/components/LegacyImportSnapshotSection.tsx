import React from "react";
import type { LegacyImportSnapshot } from "@/types";
import { formatDateDisplay } from "@/utils/dateUtils";
import "../styles/protocol-profile.css";

type SnapshotField = {
  label: string;
  value: string | number | boolean | null | undefined;
  type?: "date" | "boolean";
};

const formatSnapshotValue = (field: SnapshotField) => {
  if (field.value === null || field.value === undefined || field.value === "") {
    return "—";
  }
  if (field.type === "date" && typeof field.value === "string") {
    return formatDateDisplay(field.value);
  }
  if (field.type === "boolean") {
    return field.value ? "Yes" : "No";
  }
  return String(field.value);
};

const renderFieldGrid = (fields: SnapshotField[]) => (
  <div className="pp-fields">
    {fields.map((field) => (
      <div className="pp-field" key={field.label}>
        <label className="pp-field-label">{field.label}</label>
        <div className="pp-field-read">{formatSnapshotValue(field)}</div>
      </div>
    ))}
  </div>
);

export const LegacyImportSnapshotSection: React.FC<{
  snapshot: LegacyImportSnapshot;
}> = ({ snapshot }) => {
  const workflowFields: SnapshotField[] = [
    { label: "Imported spreadsheet status", value: snapshot.importedStatus },
    { label: "Imported type of review", value: snapshot.importedTypeOfReview },
    {
      label: "Imported classification of proposal",
      value: snapshot.importedClassificationOfProposal,
    },
    {
      label: "Imported classification date",
      value: snapshot.importedClassificationDate,
      type: "date",
    },
    { label: "Imported finish date", value: snapshot.importedFinishDate, type: "date" },
    {
      label: "Imported month of clearance",
      value: snapshot.importedMonthOfClearance,
    },
    {
      label: "Imported review duration days",
      value: snapshot.importedReviewDurationDays,
    },
    { label: "Imported total days", value: snapshot.importedTotalDays },
    { label: "Imported submission count", value: snapshot.importedSubmissionCount },
    { label: "Imported withdrawn flag", value: snapshot.importedWithdrawn, type: "boolean" },
  ];

  const reviewerFields: SnapshotField[] = [
    { label: "Imported panel", value: snapshot.importedPanel },
    {
      label: "Imported scientist reviewer",
      value: snapshot.importedScientistReviewer,
    },
    { label: "Imported lay reviewer", value: snapshot.importedLayReviewer },
    { label: "Imported primary reviewer", value: snapshot.importedPrimaryReviewer },
    {
      label: "Imported final lay reviewer",
      value: snapshot.importedFinalLayReviewer,
    },
    {
      label: "Imported independent consultant",
      value: snapshot.importedIndependentConsultant,
    },
    { label: "Imported honorarium status", value: snapshot.importedHonorariumStatus },
  ];

  const followUpFields: SnapshotField[] = [
    {
      label: "Imported project end date (6A)",
      value: snapshot.importedProjectEndDate6A,
      type: "date",
    },
    {
      label: "Imported clearance expiration",
      value: snapshot.importedClearanceExpiration,
      type: "date",
    },
    {
      label: "Progress report target date",
      value: snapshot.importedProgressReportTargetDate,
      type: "date",
    },
    {
      label: "Progress report submission",
      value: snapshot.importedProgressReportSubmission,
      type: "date",
    },
    {
      label: "Progress report approval date",
      value: snapshot.importedProgressReportApprovalDate,
      type: "date",
    },
    { label: "Progress report status", value: snapshot.importedProgressReportStatus },
    { label: "Progress report days", value: snapshot.importedProgressReportDays },
    {
      label: "Final report target date",
      value: snapshot.importedFinalReportTargetDate,
      type: "date",
    },
    {
      label: "Final report submission",
      value: snapshot.importedFinalReportSubmission,
      type: "date",
    },
    {
      label: "Final report completion date",
      value: snapshot.importedFinalReportCompletionDate,
      type: "date",
    },
    { label: "Final report status", value: snapshot.importedFinalReportStatus },
    { label: "Final report days", value: snapshot.importedFinalReportDays },
    {
      label: "Amendment submission",
      value: snapshot.importedAmendmentSubmission,
      type: "date",
    },
    { label: "Amendment status", value: snapshot.importedAmendmentStatus },
    {
      label: "Amendment approval date",
      value: snapshot.importedAmendmentApprovalDate,
      type: "date",
    },
    { label: "Amendment days", value: snapshot.importedAmendmentDays },
    {
      label: "Continuing submission",
      value: snapshot.importedContinuingSubmission,
      type: "date",
    },
    { label: "Continuing status", value: snapshot.importedContinuingStatus },
    {
      label: "Continuing approval date",
      value: snapshot.importedContinuingApprovalDate,
      type: "date",
    },
    { label: "Continuing days", value: snapshot.importedContinuingDays },
  ];

  return (
    <section className="card detail-card pp-section">
      <div className="pp-header">
        <div className="pp-header-left">
          <h2>Imported Spreadsheet Snapshot</h2>
          <p className="pp-error" style={{ color: "var(--muted-foreground, #5f6b67)" }}>
            Read-only legacy reference data preserved from the spreadsheet import.
          </p>
        </div>
      </div>

      <div className="pp-groups">
        <div className="pp-group pp-group-open">
          <div className="pp-group-toggle">
            <span className="pp-group-icon">🧾</span>
            <span className="pp-group-name">Import provenance</span>
            <span className="pp-group-count">Info</span>
          </div>
          <div className="pp-group-body">
            {renderFieldGrid([
              { label: "Imported at", value: snapshot.importedAt, type: "date" },
              { label: "Import source row", value: snapshot.sourceRowNumber },
              { label: "Import batch file", value: snapshot.importBatch?.sourceFilename },
              { label: "Import batch mode", value: snapshot.importBatch?.mode },
            ])}
          </div>
        </div>

        <div className="pp-group pp-group-open">
          <div className="pp-group-toggle">
            <span className="pp-group-icon">📌</span>
            <span className="pp-group-name">Imported workflow summary</span>
            <span className="pp-group-count">Read only</span>
          </div>
          <div className="pp-group-body">{renderFieldGrid(workflowFields)}</div>
        </div>

        <div className="pp-group pp-group-open">
          <div className="pp-group-toggle">
            <span className="pp-group-icon">👥</span>
            <span className="pp-group-name">Imported panel and reviewers</span>
            <span className="pp-group-count">Read only</span>
          </div>
          <div className="pp-group-body">{renderFieldGrid(reviewerFields)}</div>
        </div>

        <div className="pp-group pp-group-open">
          <div className="pp-group-toggle">
            <span className="pp-group-icon">📅</span>
            <span className="pp-group-name">Imported follow-up records</span>
            <span className="pp-group-count">Read only</span>
          </div>
          <div className="pp-group-body">{renderFieldGrid(followUpFields)}</div>
        </div>

        {snapshot.importedRemarks ? (
          <div className="pp-group pp-group-open">
            <div className="pp-group-toggle">
              <span className="pp-group-icon">📝</span>
              <span className="pp-group-name">Imported remarks</span>
              <span className="pp-group-count">Note</span>
            </div>
            <div className="pp-group-body">
              <p className="pp-field-read">{snapshot.importedRemarks}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
