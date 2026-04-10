import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type CsvUploadProgress,
  commitProjectsCsvImport,
  fetchProjectImportTemplate,
  type ImportMode,
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

const IMPORT_MODE_OPTIONS: Array<{
  value: ImportMode;
  label: string;
  description: string;
}> = [
  {
    value: "INTAKE_IMPORT",
    label: "Intake import",
    description: "Creates native portal-ready records and ignores spreadsheet-only workflow history.",
  },
  {
    value: "LEGACY_MIGRATION",
    label: "Legacy migration",
    description: "Imports historical spreadsheet data as a read-only legacy snapshot without reconstructing workflow.",
  },
];

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
  const [importMode, setImportMode] = useState<ImportMode>("INTAKE_IMPORT");
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

  const missingMappings = preview?.missingRequiredFields ?? [];
  const modeBlocked = preview?.modeFit === "blocked";
  const canImport =
    Boolean(selectedFile) &&
    Boolean(preview) &&
    !previewLoading &&
    !uploading &&
    missingMappings.length === 0 &&
    !modeBlocked;
  const currentStep: 1 | 2 | 3 = result ? 3 : preview ? 2 : 1;

  const fileMeta = useMemo(() => {
    if (!selectedFile) return null;
    return {
      name: selectedFile.name,
      formattedSize: formatBytes(selectedFile.size),
    };
  }, [selectedFile]);

  const loadPreview = async (file: File, mode: ImportMode) => {
    setPreviewLoading(true);
    setPreviewProgress({
      phase: "uploading",
      loaded: 0,
      total: file.size,
      percent: 0,
    });
    setStatusMessage("Uploading CSV for preview...");

    try {
      const previewResponse = await previewProjectsCsv(file, {
        mode,
        onUploadProgress: (progress) => {
          const next = resolveProgressState(progress);
          setPreviewProgress(next);
          if (next.phase === "processing") {
            setStatusMessage("Analyzing file and auto-detecting required headers...");
          }
        },
      });
      setPreview(previewResponse);
      setEditablePreviewRows(previewResponse.previewRows.map((row) => ({ ...row })));
      if (previewResponse.modeFit === "blocked") {
        setStatusMessage("Selected import mode does not fit this file. Review the recommended mode before importing.");
      } else if (previewResponse.missingRequiredFields.length > 0) {
        setStatusMessage("We can't read required headers from this file.");
      } else if (previewResponse.modeFit === "warn") {
        setStatusMessage("Preview ready with warnings. Review the recommended import mode before committing.");
      } else if (previewResponse.detectedFormat === "legacy_headerless") {
        setStatusMessage("Legacy no-header CSV detected. Preview ready using legacy column order.");
      } else {
        setStatusMessage("Preview ready. You can edit blank cells in the preview before import.");
      }
    } catch (err: unknown) {
      const message = resolveImportErrorMessage(err, "Failed to preview CSV.");
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

    const isCsvName = file.name.toLowerCase().endsWith(".csv");
    if (!isCsvName) {
      setError("Please select a .csv file.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    await loadPreview(file, importMode);
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
      setError("Missing required header in CSV.");
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
      setStatusMessage("Uploading CSV for import...");
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
        mode: importMode,
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
      const message = resolveImportErrorMessage(err, "Failed to import CSV.");
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
      : preview?.modeFit === "blocked"
        ? ["The selected import mode is blocked for this file."]
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
        <h1>Import Projects CSV</h1>
        <p>
          Upload a header-based CSV or the known legacy no-header RERC export. We
          auto-detect supported formats and let you edit preview cells before import.
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
                <h2 id="step-1-title">Step 1: Upload CSV</h2>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={handleTemplateDownload}
                  disabled={templateDownloading}
                >
                  {templateDownloading ? "Downloading template..." : "Download Template"}
                </button>
              </div>

              <div className="field">
                <label htmlFor="import-mode">Import mode</label>
                <select
                  id="import-mode"
                  value={importMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as ImportMode;
                    setImportMode(nextMode);
                    if (selectedFile) {
                      void loadPreview(selectedFile, nextMode);
                    }
                  }}
                  disabled={uploading || previewLoading}
                >
                  {IMPORT_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="import-hint">
                  {
                    IMPORT_MODE_OPTIONS.find((option) => option.value === importMode)
                      ?.description
                  }
                </p>
              </div>

              <CsvDropzone
                selectedFile={selectedFile}
                onFileSelected={handleFileSelect}
                maxFileSizeMb={MAX_FILE_SIZE_MB}
                disabled={uploading || previewLoading}
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
                        : "Uploading CSV for preview"}
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
                      <strong>Selected mode:</strong> {preview.selectedMode?.replace("_", " ").toLowerCase()}
                    </p>
                    <p className="import-alert-line">
                      <strong>Recommended mode:</strong> {preview.recommendedMode?.replace("_", " ").toLowerCase()}
                    </p>
                    <p className="import-alert-line">
                      <strong>Mode fit:</strong> {preview.modeFit}
                    </p>
                  </div>
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
                    : "Import CSV"}
                </button>
              </div>
              <p className="import-hint">
                Import stays disabled when required fields are missing or the selected mode is blocked for the file.
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
                        : "Uploading CSV for import"}
                    </strong>
                    <span>
                      {importProgress.phase === "processing"
                        ? "The upload is finished. The server is still validating the file and creating records, so this can take a little longer on larger CSVs."
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
                <li>Header-based CSVs are supported.</li>
                <li>The known legacy no-header RERC export is also supported.</li>
              </ul>
              <p>
                In legacy mode, project code is read from column 1 and the remaining
                columns follow the fixed legacy order.
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
