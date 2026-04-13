import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type CsvUploadProgress,
  commitProjectsCsvImport,
  fetchProjectImportTemplate,
  previewProjectsCsv,
  type ImportResult,
  type ProjectImportPreview,
} from "@/services/api";
import type { ProjectImportRowEdit } from "@/types";
import {
  Breadcrumbs,
  CsvDropzone,
  ImportStepper,
  ImportSummary,
  RowErrorsTable,
} from "@/components";
import { getErrorData, getErrorMessage } from "@/utils";
import "../styles/imports.css";

const MAX_FILE_SIZE_MB = 5;
const MAX_ERRORS_DISPLAY = 50;
const PREVIEW_ROWS_LIMIT = 10;

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

const isErrorValue = (v: string) => /^[#]/.test(v);

type RequestProgressState = {
  phase: "idle" | "uploading" | "processing";
  loaded: number;
  total: number | null;
  percent: number | null;
};

const IDLE_PROGRESS: RequestProgressState = {
  phase: "idle",
  loaded: 0,
  total: null,
  percent: null,
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const escapeCsvValue = (value: string) => {
  const unsafe = /^[=+\-@]/.test(value);
  const safeValue = unsafe ? `'${value}` : value;
  const escaped = safeValue.replace(/"/g, '""');
  return `"${escaped}"`;
};

const buildErrorsCsv = (result: ImportResult) => {
  const header = ["row", "field", "message"].join(",");
  const lines = result.errors.map((error) =>
    [String(error.row), error.field, error.message]
      .map((value) => escapeCsvValue(value))
      .join(",")
  );
  return [header, ...lines].join("\n");
};

const resolveImportErrorMessage = (err: unknown, fallback: string) => {
  if (getErrorData(err)?.code === "INVALID_CSRF_TOKEN") {
    return "Your session was refreshed. Please try the upload again.";
  }
  return getErrorMessage(err, fallback);
};

const resolveProgressState = (progress: CsvUploadProgress): RequestProgressState => ({
  phase: progress.percent === 100 ? "processing" : "uploading",
  loaded: progress.loaded,
  total: progress.total,
  percent: progress.percent,
});

const renderTransferMeta = (progress: RequestProgressState) => {
  if (progress.phase !== "uploading") return null;
  if (progress.total && progress.total > 0) {
    return `${formatBytes(progress.loaded)} of ${formatBytes(progress.total)} uploaded`;
  }
  if (progress.loaded > 0) {
    return `${formatBytes(progress.loaded)} uploaded`;
  }
  return null;
};

export default function ImportProjectsPage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProjectImportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewProgress, setPreviewProgress] = useState<RequestProgressState>(IDLE_PROGRESS);
  const [importProgress, setImportProgress] = useState<RequestProgressState>(IDLE_PROGRESS);
  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [editablePreviewRows, setEditablePreviewRows] = useState<Record<string, string>[]>([]);
  const [stepTimingsOpen, setStepTimingsOpen] = useState(false);

  const missingMappings = preview?.missingRequiredFields ?? [];
  const canImport =
    Boolean(selectedFile) &&
    Boolean(preview) &&
    !previewLoading &&
    !uploading &&
    missingMappings.length === 0;
  const currentStep: 1 | 2 | 3 = result ? 3 : preview ? 2 : 1;

  const fileMeta = useMemo(() => {
    if (!selectedFile) return null;
    return {
      name: selectedFile.name,
      formattedSize: formatBytes(selectedFile.size),
    };
  }, [selectedFile]);

  const loadPreview = async (file: File) => {
    setPreviewLoading(true);
    setPreviewProgress({
      phase: "uploading",
      loaded: 0,
      total: file.size,
      percent: 0,
    });
    setStatusMessage("Uploading file for preview...");

    try {
      const previewResponse = await previewProjectsCsv(file, {
        onUploadProgress: (progress) => {
          const next = resolveProgressState(progress);
          setPreviewProgress(next);
          if (next.phase === "processing") {
            setStatusMessage("Analyzing headers and preparing the import preview...");
          }
        },
      });
      setPreview(previewResponse);
      setEditablePreviewRows(previewResponse.previewRows.map((row) => ({ ...row })));
      if (previewResponse.missingRequiredFields.length > 0) {
        setStatusMessage("We can't read required headers from this file.");
      } else if (previewResponse.detectedFormat === "legacy_headerless") {
        setStatusMessage("Legacy no-header CSV detected. Preview ready using legacy column order.");
      } else {
        setStatusMessage("Preview ready. You can edit blank cells in the preview before import.");
      }
    } catch (err: unknown) {
      const message = resolveImportErrorMessage(err, "Failed to preview file.");
      setError(message);
      setStatusMessage(null);
      setPreview(null);
      setEditablePreviewRows([]);
    } finally {
      setPreviewLoading(false);
      setPreviewProgress(IDLE_PROGRESS);
    }
  };

  const handleFileSelect = async (file: File | null) => {
    setError(null);
    setStatusMessage(null);
    setResult(null);
    setPreview(null);
    setPreviewProgress(IDLE_PROGRESS);
    setImportProgress(IDLE_PROGRESS);
    setEditablePreviewRows([]);

    if (!file) {
      setSelectedFile(null);
      setStatusMessage("No file selected.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      setSelectedFile(null);
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isSupportedFile = lowerName.endsWith(".csv") || lowerName.endsWith(".xlsx");
    if (!isSupportedFile) {
      setError("Please select a .csv or .xlsx file.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    await loadPreview(file);
  };

  const handleTemplateDownload = async () => {
    try {
      setTemplateDownloading(true);
      setError(null);
      const blob = await fetchProjectImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "project_import_template.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatusMessage("Template downloaded.");
    } catch {
      setError("Failed to download template.");
    } finally {
      setTemplateDownloading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !preview) return;
    if (missingMappings.length > 0) {
      setError("Missing required header in the uploaded file.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setResult(null);
      setImportProgress({
        phase: "uploading",
        loaded: 0,
        total: selectedFile.size,
        percent: 0,
      });
      setStatusMessage("Uploading file for import...");
      const previewHeaders = preview.detectedHeaders;
      const rowNumbers =
        preview.previewRowNumbers && preview.previewRowNumbers.length === preview.previewRows.length
          ? preview.previewRowNumbers
          : preview.previewRows.map((_, index) => index + 2);

      const rowEdits: ProjectImportRowEdit[] = editablePreviewRows
        .map((editedRow, index) => {
          const original = preview.previewRows[index] ?? {};
          const changed: Record<string, string> = {};
          for (const header of previewHeaders) {
            const before = original[header] ?? "";
            const after = editedRow[header] ?? "";
            if (before !== after) {
              changed[header] = after;
            }
          }
          return {
            rowNumber: rowNumbers[index] ?? index + 2,
            values: changed,
          };
        })
        .filter((edit) => Object.keys(edit.values).length > 0);

      const response = await commitProjectsCsvImport(selectedFile, undefined, rowEdits, {
        onUploadProgress: (progress) => {
          const next = resolveProgressState(progress);
          setImportProgress(next);
          if (next.phase === "processing") {
            setStatusMessage("File uploaded. Validating rows and importing records...");
          }
        },
      });
      setResult(response);
      setStatusMessage(
        `Import finished: ${response.insertedRows} inserted, ${response.failedRows} failed.`
      );
    } catch (err: unknown) {
      const message = resolveImportErrorMessage(err, "Failed to import file.");
      setStatusMessage(null);
      setError(message);
    } finally {
      setUploading(false);
      setImportProgress(IDLE_PROGRESS);
    }
  };

  const handleDownloadErrors = () => {
    if (!result || result.errors.length === 0) return;
    const csv = buildErrorsCsv(result);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "project_import_errors.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setStatusMessage("Error report downloaded.");
  };

  const previewHeaders = preview?.detectedHeaders ?? [];
  const previewRows = editablePreviewRows.slice(0, PREVIEW_ROWS_LIMIT);
  const previewWarnings = preview?.warnings ?? [];
  const blockingWarnings =
    preview && preview.missingRequiredFields.length > 0
      ? ["We can't auto-detect required headers for import."]
      : [];
  const visibleWarnings = Array.from(new Set([...previewWarnings, ...blockingWarnings]));
  const previewTransferMeta = renderTransferMeta(previewProgress);
  const importTransferMeta = renderTransferMeta(importProgress);
  const handleBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
      return;
    }
    navigate("/dashboard");
  };

  return (
    <div className="import-page portal-page portal-page--dense">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Import Projects" },
        ]}
      />

      <header className="page-header portal-context">
        <button type="button" className="back-link back-link-button" onClick={handleBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <h1>Import Projects</h1>
        <p>
          Upload a CSV or the original legacy XLSX workbook. The portal will detect the file structure automatically, preserve any historical spreadsheet fields for reference, and create live workflow records.
        </p>
      </header>

      <div className="portal-summary">
        <ImportStepper currentStep={currentStep} warningsCount={missingMappings.length} />
      </div>

      <div className="import-live-region" role="status" aria-live="polite">
        {statusMessage}
      </div>

      <section className="import-panel portal-content">
        <div className="import-grid">
          <div className="import-main-col">
            <section className="import-card" aria-labelledby="step-1-title">
              <div className="import-card-head">
                <h2 id="step-1-title">Step 1: Upload file</h2>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={handleTemplateDownload}
                  disabled={templateDownloading}
                >
                  {templateDownloading ? "Downloading template..." : "Download Template"}
                </button>
              </div>

              <CsvDropzone
                selectedFile={selectedFile}
                onFileSelected={handleFileSelect}
                maxFileSizeMb={MAX_FILE_SIZE_MB}
                disabled={uploading || previewLoading}
                accept="both"
              />
            </section>

            <section className="import-card" aria-labelledby="step-2-title">
              <div className="import-card-head">
                <h2 id="step-2-title">Step 2: Preview</h2>
                <span className="import-file-meta">
                  {fileMeta ? `${fileMeta.name} • ${fileMeta.formattedSize}` : "No file loaded"}
                </span>
              </div>

              {previewLoading && (
                <div
                  className={`import-progress-shell${
                    previewProgress.phase === "processing" ? " is-processing" : ""
                  }`}
                  aria-live="polite"
                >
                  <div className="import-progress-copy">
                    <strong>
                      {previewProgress.phase === "processing"
                        ? "Analyzing headers and generating preview"
                        : "Uploading file for preview"}
                    </strong>
                    <span>
                      {previewProgress.phase === "processing"
                        ? "The file is already on the server. The portal is checking headers and building the preview."
                        : previewTransferMeta || "Sending the file to the server."}
                    </span>
                  </div>
                  <div className="import-progress-track" aria-hidden="true">
                    <div
                      className={`import-progress-fill${
                        previewProgress.phase === "processing" ? " is-indeterminate" : ""
                      }`}
                      style={
                        previewProgress.phase === "processing"
                          ? undefined
                          : { width: `${previewProgress.percent ?? 0}%` }
                      }
                    />
                  </div>
                  <div className="import-progress-meta">
                    <span>
                      {previewProgress.phase === "processing"
                        ? "Processing on server"
                        : `${previewProgress.percent ?? 0}%`}
                    </span>
                    {previewTransferMeta && previewProgress.phase !== "processing" && (
                      <span>{previewTransferMeta}</span>
                    )}
                  </div>
                </div>
              )}

              {!previewLoading && preview && (
                <>
                  <div className="import-alert info">
                    <p className="import-alert-line">
                      <strong>Import preview ready:</strong> The uploaded rows will be created as live workflow records after commit.
                    </p>
                    <p className="import-alert-line">
                      Historical spreadsheet-only columns, when present, will be preserved in the project record for reference.
                    </p>
                  </div>
                  {(preview.sourceWarnings ?? []).length > 0 && (
                    <div className="import-alert warning">
                      <p className="import-alert-line"><strong>Source warning:</strong></p>
                      {(preview.sourceWarnings ?? []).map((w) => (
                        <p key={w} className="import-alert-line">{w}</p>
                      ))}
                    </div>
                  )}
                  {visibleWarnings.length > 0 && (
                    <div className="import-alert warning">
                      {visibleWarnings.map((warning) => (
                        <p key={warning} className="import-alert-line">
                          {warning}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="preview-table-wrap">
                    <h3>Preview rows ({Math.min(PREVIEW_ROWS_LIMIT, previewRows.length)} shown, editable)</h3>
                    <table className="preview-table">
                      <thead>
                        <tr>
                          {previewHeaders.map((header) => (
                            <th key={header} scope="col">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, rowIndex) => (
                          <tr key={`preview-${rowIndex}`}>
                            {previewHeaders.map((header) => (
                              <td key={`${rowIndex}-${header}`}>
                                <input
                                  type="text"
                                  value={row[header] ?? ""}
                                  onChange={(event) =>
                                    setEditablePreviewRows((prev) =>
                                      prev.map((item, idx) =>
                                        idx === rowIndex
                                          ? { ...item, [header]: event.target.value }
                                          : item
                                      )
                                    )
                                  }
                                  placeholder="—"
                                  disabled={uploading}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {(preview.detectedFormat === "legacy_headered" || preview.detectedFormat === "legacy_headerless") && (() => {
                    const visibleSteps = MILESTONE_STEPS.filter((step) =>
                      previewRows.some((row) => {
                        const date = step.dateKey ? (row[step.dateKey] ?? "").trim() : "";
                        const days = (row[step.daysKey] ?? "").trim();
                        return date !== "" || days !== "";
                      })
                    );
                    if (visibleSteps.length === 0) return null;
                    const rowNumbers = preview.previewRowNumbers?.length === previewRows.length
                      ? preview.previewRowNumbers
                      : previewRows.map((_, i) => i + 2);
                    return (
                      <div className="preview-table-wrap" style={{ marginTop: "16px" }}>
                        <h3
                          style={{ cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: "6px" }}
                          onClick={() => setStepTimingsOpen((v) => !v)}
                        >
                          <span style={{ fontSize: "12px", color: "var(--neutral-400)" }}>{stepTimingsOpen ? "▾" : "▸"}</span>
                          Review step timings ({visibleSteps.length} steps with data)
                        </h3>
                        {stepTimingsOpen && (
                          <table className="preview-table" style={{ fontSize: "12px" }}>
                            <thead>
                              <tr>
                                <th scope="col" style={{ minWidth: "200px" }}>Step</th>
                                {previewRows.map((_, i) => (
                                  <th key={i} scope="col" colSpan={2} style={{ textAlign: "center" }}>
                                    Row {rowNumbers[i]}
                                  </th>
                                ))}
                              </tr>
                              <tr>
                                <th scope="col" />
                                {previewRows.map((_, i) => (
                                  <>
                                    <th key={`${i}-date`} scope="col" style={{ fontWeight: 500, color: "var(--neutral-500)" }}>Date</th>
                                    <th key={`${i}-days`} scope="col" style={{ fontWeight: 500, color: "var(--neutral-500)" }}># Days</th>
                                  </>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {visibleSteps.map((step) => (
                                <tr key={step.daysKey}>
                                  <td style={{ fontWeight: 500 }}>{step.label}</td>
                                  {previewRows.map((row, i) => {
                                    const dateRaw = step.dateKey ? (row[step.dateKey] ?? "") : "";
                                    const daysRaw = row[step.daysKey] ?? "";
                                    return (
                                      <>
                                        {step.dateKey ? (
                                          <td key={`${i}-date`}>
                                            <input
                                              type="text"
                                              value={dateRaw}
                                              onChange={(e) =>
                                                setEditablePreviewRows((prev) =>
                                                  prev.map((item, idx) =>
                                                    idx === i ? { ...item, [step.dateKey!]: e.target.value } : item
                                                  )
                                                )
                                              }
                                              placeholder="—"
                                              disabled={uploading}
                                              style={{ color: isErrorValue(dateRaw) ? "var(--danger-red, #c0392b)" : undefined }}
                                            />
                                          </td>
                                        ) : (
                                          <td key={`${i}-date`} style={{ color: "var(--neutral-300)" }}>—</td>
                                        )}
                                        <td key={`${i}-days`}>
                                          <input
                                            type="text"
                                            value={daysRaw}
                                            onChange={(e) =>
                                              setEditablePreviewRows((prev) =>
                                                prev.map((item, idx) =>
                                                  idx === i ? { ...item, [step.daysKey]: e.target.value } : item
                                                )
                                              )
                                            }
                                            placeholder="—"
                                            disabled={uploading}
                                            style={{ color: isErrorValue(daysRaw) ? "var(--danger-red, #c0392b)" : undefined }}
                                          />
                                        </td>
                                      </>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </section>

            <section className="import-card" aria-labelledby="step-3-title">
              <div className="import-card-head">
                <h2 id="step-3-title">Step 3: Import</h2>
                <button className="btn btn-primary" type="button" onClick={handleImport} disabled={!canImport}>
                  {uploading
                    ? importProgress.phase === "processing"
                      ? "Processing..."
                      : "Uploading..."
                    : "Import file"}
                </button>
              </div>
              <p className="import-hint">
                Import stays disabled when required fields are missing from the uploaded file.
              </p>
              {uploading && (
                <div
                  className={`import-progress-shell${
                    importProgress.phase === "processing" ? " is-processing" : ""
                  }`}
                  aria-live="polite"
                >
                  <div className="import-progress-copy">
                    <strong>
                      {importProgress.phase === "processing"
                        ? "Validating rows and importing records"
                        : "Uploading file for import"}
                    </strong>
                    <span>
                      {importProgress.phase === "processing"
                        ? "The upload is finished. The server is still validating the file and creating records, so this can take a little longer on larger files."
                        : importTransferMeta || "Sending the import file to the server."}
                    </span>
                  </div>
                  <div className="import-progress-track" aria-hidden="true">
                    <div
                      className={`import-progress-fill${
                        importProgress.phase === "processing" ? " is-indeterminate" : ""
                      }`}
                      style={
                        importProgress.phase === "processing"
                          ? undefined
                          : { width: `${importProgress.percent ?? 0}%` }
                      }
                    />
                  </div>
                  <div className="import-progress-meta">
                    <span>
                      {importProgress.phase === "processing"
                        ? "Processing on server"
                        : `${importProgress.percent ?? 0}%`}
                    </span>
                    {importTransferMeta && importProgress.phase !== "processing" && (
                      <span>{importTransferMeta}</span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {result && <ImportSummary result={result} onDownloadErrors={handleDownloadErrors} />}
            {result && <RowErrorsTable errors={result.errors} maxDisplay={MAX_ERRORS_DISPLAY} />}
          </div>

          <aside className="import-side-col">
            <div className="import-card import-guide-card">
              <h3>Required headers</h3>
              <ul>
                <li>Header-based CSV intake files are supported.</li>
                <li>The known legacy no-header RERC export is also supported.</li>
                <li>Original legacy XLSX workbooks preserve formula-derived snapshot fields better than CSV exports.</li>
              </ul>
              <p>
                Legacy no-header files still use the fixed historical column order, while normal intake files rely on recognizable headers.
              </p>
            </div>
            <div className="import-card import-guide-card">
              <h3>Safety checks</h3>
              <ul>
                <li>Maximum file size: 5MB.</li>
                <li>Maximum rows: 5,000.</li>
                <li>Server re-validates file and auto-detected fields on commit.</li>
              </ul>
            </div>
          </aside>
        </div>

        {error && (
          <div className="import-alert error" role="alert">
            {error}
          </div>
        )}
      </section>
    </div>
  );
}
