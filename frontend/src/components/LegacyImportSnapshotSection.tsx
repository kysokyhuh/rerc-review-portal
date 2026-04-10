import React, { useState } from "react";
import type { LegacyImportSnapshot } from "@/types";
import { formatDateDisplay } from "@/utils/dateUtils";
import "../styles/protocol-profile.css";

const MILESTONE_STEPS: Array<{ label: string; dateKey: string | null; daysKey: string }> = [
  { label: "Classification",                     dateKey: null,                                                         daysKey: "classificationDays" },
  { label: "Provision of documents",             dateKey: "provisionOfProjectProposalDocumentsToPrimaryReviewer",       daysKey: "provisionOfProjectProposalDocumentsToPrimaryReviewerDays" },
  { label: "Accomplishment of assessment forms", dateKey: "accomplishmentOfAssessmentForms",                           daysKey: "accomplishmentOfAssessmentFormsDays" },
  { label: "Full review meeting",                dateKey: "fullReviewMeeting",                                         daysKey: "fullReviewMeetingDays" },
  { label: "Finalization of review results",     dateKey: "finalizationOfReviewResults",                               daysKey: "finalizationOfReviewResultsDays" },
  { label: "Communication to project leader",    dateKey: "communicationOfReviewResultsToProjectLeader",               daysKey: "communicationOfReviewResultsToProjectLeaderDays" },
  { label: "Resubmission 1 from proponent",      dateKey: "resubmission1FromProponent",                                daysKey: "resubmission1FromProponentDays" },
  { label: "Review of resubmission 1",           dateKey: "reviewOfResubmission1",                                     daysKey: "reviewOfResubmission1Days" },
  { label: "Finalization — resubmission 1",      dateKey: "finalizationOfReviewResultsResubmission1",                  daysKey: "finalizationOfReviewResultsResubmission1Days" },
  { label: "Resubmission 2 from proponent",      dateKey: "resubmission2FromProponent",                                daysKey: "resubmission2FromProponentDays" },
  { label: "Review of resubmission 2",           dateKey: "reviewOfResubmission2",                                     daysKey: "reviewOfResubmission2Days" },
  { label: "Finalization — resubmission 2",      dateKey: "finalizationOfReviewResultsResubmission2",                  daysKey: "finalizationOfReviewResultsResubmission2Days" },
  { label: "Resubmission 3 from proponent",      dateKey: "resubmission3FromProponent",                                daysKey: "resubmission3FromProponentDays" },
  { label: "Review of resubmission 3",           dateKey: "reviewOfResubmission3",                                     daysKey: "reviewOfResubmission3Days" },
  { label: "Finalization — resubmission 3",      dateKey: "finalizationOfReviewResultsResubmission3",                  daysKey: "finalizationOfReviewResultsResubmission3Days" },
  { label: "Resubmission 4 from proponent",      dateKey: "resubmission4FromProponent",                                daysKey: "resubmission4FromProponentDays" },
  { label: "Review of resubmission 4",           dateKey: "reviewOfResubmission4",                                     daysKey: "reviewOfResubmission4Days" },
  { label: "Finalization — resubmission 4",      dateKey: "finalizationOfReviewResultsResubmission4",                  daysKey: "finalizationOfReviewResultsResubmission4Days" },
  { label: "Issuance of ethics clearance",       dateKey: "issuanceOfEthicsClearance",                                 daysKey: "issuanceOfEthicsClearanceDays" },
];

const isErrorString = (v: string) => /^[#]/.test(v);

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    className={`pp-chevron ${open ? "pp-chevron-open" : ""}`}
    width="16" height="16" viewBox="0 0 16 16"
    fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
  >
    <polyline points="6 4 10 8 6 12" />
  </svg>
);

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
  const [stepTimingsOpen, setStepTimingsOpen] = useState(false);

  const raw = snapshot.rawRowJson ?? {};
  const visibleSteps = MILESTONE_STEPS.filter((step) => {
    const date = step.dateKey ? (raw[step.dateKey] ?? "").trim() : "";
    const days = (raw[step.daysKey] ?? "").trim();
    return date !== "" || days !== "";
  });
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

        {visibleSteps.length > 0 && (
          <div className={`pp-group ${stepTimingsOpen ? "pp-group-open" : ""}`}>
            <button
              type="button"
              className="pp-group-toggle"
              onClick={() => setStepTimingsOpen((v) => !v)}
              aria-expanded={stepTimingsOpen}
            >
              <Chevron open={stepTimingsOpen} />
              <span className="pp-group-icon">⏱️</span>
              <span className="pp-group-name">Review step timings</span>
              <span className="pp-group-count">{visibleSteps.length} steps</span>
            </button>
            {stepTimingsOpen && (
              <div className="pp-group-body">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--neutral-150, #eaedf0)" }}>
                      <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, color: "var(--neutral-500)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Step</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, color: "var(--neutral-500)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Date</th>
                      <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 600, color: "var(--neutral-500)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}># Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSteps.map((step) => {
                      const dateRaw = step.dateKey ? (raw[step.dateKey] ?? "").trim() : "";
                      const daysRaw = (raw[step.daysKey] ?? "").trim();
                      const dateDisplay = dateRaw === "" ? "—" : isErrorString(dateRaw) ? dateRaw : formatDateDisplay(dateRaw);
                      const daysDisplay = daysRaw === "" ? "—" : daysRaw;
                      const isError = isErrorString(daysRaw) || isErrorString(dateRaw);
                      return (
                        <tr key={step.daysKey} style={{ borderBottom: "1px solid var(--neutral-100, #f2f3f5)" }}>
                          <td style={{ padding: "6px 8px", color: "var(--neutral-700)" }}>{step.label}</td>
                          <td style={{ padding: "6px 8px", color: isErrorString(dateRaw) ? "var(--neutral-400)" : "var(--neutral-800)" }}>{dateDisplay}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", color: isError ? "var(--neutral-400)" : "var(--neutral-800)", fontVariantNumeric: "tabular-nums" }}>{daysDisplay}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p style={{ marginTop: "8px", fontSize: "11px", color: "var(--neutral-400)" }}>
                  Raw values from original spreadsheet. Error strings (e.g. #NAME?) indicate Excel formula errors in the source file.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
