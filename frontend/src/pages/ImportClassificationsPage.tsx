import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type CsvUploadProgress,
  commitClassificationsCsvImport,
  type ImportResult,
  previewClassificationsCsv,
  type ClassificationImportPreview,
} from "@/services/api";
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
  return `"${safeValue.replace(/"/g, '""')}"`;
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

const formatStatus = (value: string | null) =>
  value ? value.replace(/_/g, " ").toLowerCase() : "Not matched";

const statusClassName = (status: string) => {
  if (status === "MATCHED") return "import-pill import-pill-success";
  if (status === "NO_REVIEW_TYPE") return "import-pill import-pill-warning";
  return "import-pill import-pill-danger";
};

export default function ImportClassificationsPage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ClassificationImportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewProgress, setPreviewProgress] = useState<RequestProgressState>(IDLE_PROGRESS);
  const [importProgress, setImportProgress] = useState<RequestProgressState>(IDLE_PROGRESS);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const canImport = Boolean(selectedFile) && Boolean(preview) && !previewLoading && !uploading;
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
    setStatusMessage("Uploading classification file for preview...");

    try {
      const previewResponse = await previewClassificationsCsv(file, {
        onUploadProgress: (progress) => {
          const next = resolveProgressState(progress);
          setPreviewProgress(next);
          if (next.phase === "processing") {
            setStatusMessage("Matching classification rows by protocol title...");
          }
        },
      });
      setPreview(previewResponse);
      setStatusMessage("Preview ready. Review the matched titles before importing.");
    } catch (err: unknown) {
      setError(resolveImportErrorMessage(err, "Failed to preview classification file."));
      setStatusMessage(null);
      setPreview(null);
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

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a .csv file.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    await loadPreview(file);
  };

  const handleImport = async () => {
    if (!selectedFile || !preview) return;

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
      setStatusMessage("Uploading classification file for import...");
      const response = await commitClassificationsCsvImport(selectedFile, {
        onUploadProgress: (progress) => {
          const next = resolveProgressState(progress);
          setImportProgress(next);
          if (next.phase === "processing") {
            setStatusMessage("File uploaded. Updating matched classifications...");
          }
        },
      });
      setResult(response);
      setStatusMessage(
        `Import finished: ${response.insertedRows} updated, ${response.failedRows} skipped.`
      );
    } catch (err: unknown) {
      setStatusMessage(null);
      setError(resolveImportErrorMessage(err, "Failed to import classification file."));
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
    link.download = "classification_import_errors.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setStatusMessage("Error report downloaded.");
  };

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
          { label: "Import Classifications" },
        ]}
      />

      <header className="page-header portal-context">
        <button type="button" className="back-link back-link-button" onClick={handleBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <h1>Import Classifications</h1>
        <p>
          Upload the classification CSV with headers. The portal matches rows by protocol title, skips titles that do not match exactly enough, and appends imported remarks to the classification notes.
        </p>
      </header>

      <div className="portal-summary">
        <ImportStepper currentStep={currentStep} warningsCount={preview?.summary.warningRows ?? 0} />
      </div>

      <div className="import-live-region" role="status" aria-live="polite">
        {statusMessage}
      </div>

      <section className="import-panel portal-content">
        <div className="import-grid">
          <div className="import-main-col">
            <section className="import-card" aria-labelledby="classification-step-1-title">
              <div className="import-card-head">
                <h2 id="classification-step-1-title">Step 1: Upload classification file</h2>
              </div>

              <CsvDropzone
                selectedFile={selectedFile}
                onFileSelected={handleFileSelect}
                maxFileSizeMb={MAX_FILE_SIZE_MB}
                disabled={uploading || previewLoading}
                accept="csv"
              />
            </section>

            <section className="import-card" aria-labelledby="classification-step-2-title">
              <div className="import-card-head">
                <h2 id="classification-step-2-title">Step 2: Preview title matches</h2>
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
                        ? "Matching titles and building preview"
                        : "Uploading file for preview"}
                    </strong>
                    <span>
                      {previewProgress.phase === "processing"
                        ? "The portal is checking titles against existing protocols."
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
                      <strong>Classification preview ready:</strong> Matched rows will update the latest submission for that protocol title. Unmatched and ambiguous titles will be skipped.
                    </p>
                  </div>

                  {preview.warnings.length > 0 && (
                    <div className="import-alert warning">
                      {preview.warnings.map((warning) => (
                        <p key={warning} className="import-alert-line">{warning}</p>
                      ))}
                    </div>
                  )}

                  <div className="import-summary-grid">
                    <div className="import-metric">
                      <span>Rows read</span>
                      <strong>{preview.receivedRows}</strong>
                    </div>
                    <div className="import-metric">
                      <span>Matched</span>
                      <strong>{preview.summary.matchedRows}</strong>
                    </div>
                    <div className="import-metric">
                      <span>Notes only</span>
                      <strong>{preview.summary.notesOnlyRows}</strong>
                    </div>
                    <div className="import-metric">
                      <span>Unmatched</span>
                      <strong>{preview.summary.unmatchedRows}</strong>
                    </div>
                    <div className="import-metric">
                      <span>Ambiguous</span>
                      <strong>{preview.summary.ambiguousRows}</strong>
                    </div>
                  </div>

                  <div className="preview-table-wrap">
                    <h3>Preview rows ({preview.previewRows.length} shown)</h3>
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th scope="col">Row</th>
                          <th scope="col">Title</th>
                          <th scope="col">Proponent</th>
                          <th scope="col">Recommended review</th>
                          <th scope="col">Category</th>
                          <th scope="col">Reviewer suggestions</th>
                          <th scope="col">Link</th>
                          <th scope="col">Match</th>
                          <th scope="col">Portal status</th>
                          <th scope="col">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.previewRows.map((row) => (
                          <tr key={row.rowNumber}>
                            <td>{row.rowNumber}</td>
                            <td>{row.title}</td>
                            <td>{row.proponent || "—"}</td>
                            <td>{row.recommendedTypeRaw || "—"}</td>
                            <td>{row.reviewCategory || "—"}</td>
                            <td>
                              {row.suggestedScientificReviewer || row.suggestedNonScientificReviewer ? (
                                <span>
                                  {row.suggestedScientificReviewer
                                    ? `S: ${row.suggestedScientificReviewer}`
                                    : ""}
                                  {row.suggestedScientificReviewer &&
                                  row.suggestedNonScientificReviewer
                                    ? "; "
                                    : ""}
                                  {row.suggestedNonScientificReviewer
                                    ? `NS: ${row.suggestedNonScientificReviewer}`
                                    : ""}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              {row.sourceLink ? (
                                <a href={row.sourceLink} target="_blank" rel="noreferrer">
                                  Open
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              <span className={statusClassName(row.matchStatus)}>
                                {row.matchStatus.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td>{formatStatus(row.portalStatus)}</td>
                            <td>{row.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <section className="import-card" aria-labelledby="classification-step-3-title">
              <div className="import-card-head">
                <h2 id="classification-step-3-title">Step 3: Import</h2>
                <button className="btn btn-primary" type="button" onClick={handleImport} disabled={!canImport}>
                  {uploading ? "Importing..." : "Import classifications"}
                </button>
              </div>

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
                        ? "Updating matched classifications"
                        : "Uploading file for import"}
                    </strong>
                    <span>
                      {importProgress.phase === "processing"
                        ? "The portal is applying review types and appending notes."
                        : importTransferMeta || "Sending the file to the server."}
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

              {!preview && !result && (
                <p className="import-hint">
                  Preview a classification CSV first. The file must include headers, especially <code>Title</code> and <code>Recommended Type of Review</code>.
                </p>
              )}

              {result && (
                <>
                  <ImportSummary result={result} onDownloadErrors={handleDownloadErrors} />
                  <RowErrorsTable errors={result.errors} maxDisplay={MAX_ERRORS_DISPLAY} />
                </>
              )}
            </section>
          </div>

          <aside className="import-side-col">
            <section className="import-card compact" aria-labelledby="classification-guide-title">
              <h2 id="classification-guide-title">Classification CSV guide</h2>
              <ul className="import-guide-list">
                <li>The file must have a header row.</li>
                <li><code>Title</code> is used to find the existing protocol.</li>
                <li><code>Recommended Type of Review</code> maps to Exempt, Expedited, or Full Board.</li>
                <li><code>Link</code> is saved as the classification source link.</li>
                <li>Remarks and research notes are appended to classification notes.</li>
                <li>Unmatched and duplicate title matches are skipped and reported.</li>
              </ul>
            </section>

            {error && (
              <section className="import-alert danger" role="alert">
                <strong>Import error</strong>
                <p>{error}</p>
              </section>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
