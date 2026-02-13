import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
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
import "../styles/imports.css";

const MAX_FILE_SIZE_MB = 5;
const MAX_ERRORS_DISPLAY = 50;
const PREVIEW_ROWS_LIMIT = 10;

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

export default function ImportProjectsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProjectImportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [editablePreviewRows, setEditablePreviewRows] = useState<Record<string, string>[]>([]);

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

  const handleFileSelect = async (file: File | null) => {
    setError(null);
    setStatusMessage(null);
    setResult(null);
    setPreview(null);
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
    setPreviewLoading(true);
    setStatusMessage("Analyzing file and auto-detecting required headers...");

    try {
      const previewResponse = await previewProjectsCsv(file);
      setPreview(previewResponse);
      setEditablePreviewRows(previewResponse.previewRows.map((row) => ({ ...row })));
      if (previewResponse.missingRequiredFields.length > 0) {
        setStatusMessage("We can't read required headers from this file.");
      } else {
        setStatusMessage("Preview ready. You can edit blank cells in the preview before import.");
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to preview CSV.";
      setError(message);
      setPreview(null);
      setEditablePreviewRows([]);
    } finally {
      setPreviewLoading(false);
    }
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
      setStatusMessage("Import in progress...");
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

      const response = await commitProjectsCsvImport(selectedFile, undefined, rowEdits);
      setResult(response);
      setStatusMessage(
        `Import finished: ${response.insertedRows} inserted, ${response.failedRows} failed.`
      );
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to import CSV.";
      setError(message);
    } finally {
      setUploading(false);
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
  const blockingWarnings =
    preview && preview.missingRequiredFields.length > 0
      ? ["We can't auto-detect required headers for import."]
      : [];

  return (
    <div className="import-page">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Import Projects" },
        ]}
      />

      <header className="page-header">
        <Link to="/dashboard" className="back-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Dashboard
        </Link>
        <h1>Import Projects CSV</h1>
        <p>Upload any CSV format. We auto-detect required headers and let you edit preview cells before import.</p>
      </header>

      <ImportStepper currentStep={currentStep} warningsCount={missingMappings.length} />

      <div className="import-live-region" role="status" aria-live="polite">
        {statusMessage}
      </div>

      <section className="import-panel">
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

              {previewLoading && <p className="import-loading-note">Generating preview...</p>}

              {!previewLoading && preview && (
                <>
                  {blockingWarnings.length > 0 && (
                    <div className="import-alert warning">
                      {blockingWarnings.map((warning) => (
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
                  {uploading ? "Importing..." : "Import CSV"}
                </button>
              </div>
              <p className="import-hint">Import stays disabled until required headers are auto-detected.</p>
            </section>

            {result && <ImportSummary result={result} onDownloadErrors={handleDownloadErrors} />}
            {result && <RowErrorsTable errors={result.errors} maxDisplay={MAX_ERRORS_DISPLAY} />}
          </div>

          <aside className="import-side-col">
            <div className="import-card import-guide-card">
              <h3>Required headers</h3>
              <ul>
                <li>Column 1: projectCode (fixed)</li>
              </ul>
              <p>Any CSV shape is accepted. Project code is read from column 1.</p>
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
