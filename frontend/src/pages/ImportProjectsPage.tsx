import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  commitProjectsCsvImport,
  fetchProjectImportTemplate,
  previewProjectsCsv,
  type ImportResult,
  type ProjectImportPreview,
} from "@/services/api";
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

const REQUIRED_FIELDS = [
  { key: "projectCode", label: "Project Code" },
  { key: "title", label: "Project Title" },
  { key: "piName", label: "Principal Investigator" },
  { key: "fundingType", label: "Funding Type" },
  { key: "committeeCode", label: "Committee Code" },
  { key: "submissionType", label: "Submission Type" },
  { key: "receivedDate", label: "Date Received" },
] as const;

type RequiredFieldKey = (typeof REQUIRED_FIELDS)[number]["key"];
type MappingState = Record<RequiredFieldKey, string | null>;

const EMPTY_MAPPING: MappingState = {
  projectCode: null,
  title: null,
  piName: null,
  fundingType: null,
  committeeCode: null,
  submissionType: null,
  receivedDate: null,
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

const toMappingState = (preview: ProjectImportPreview): MappingState => ({
  projectCode: preview.suggestedMapping.projectCode ?? null,
  title: preview.suggestedMapping.title ?? null,
  piName: preview.suggestedMapping.piName ?? null,
  fundingType: preview.suggestedMapping.fundingType ?? null,
  committeeCode: preview.suggestedMapping.committeeCode ?? null,
  submissionType: preview.suggestedMapping.submissionType ?? null,
  receivedDate: preview.suggestedMapping.receivedDate ?? null,
});

export default function ImportProjectsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProjectImportPreview | null>(null);
  const [mapping, setMapping] = useState<MappingState>(EMPTY_MAPPING);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const missingMappings = REQUIRED_FIELDS.filter((field) => !mapping[field.key]);
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
    setMapping(EMPTY_MAPPING);

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
    setStatusMessage("Analyzing file and suggesting column mapping...");

    try {
      const previewResponse = await previewProjectsCsv(file);
      setPreview(previewResponse);
      setMapping(toMappingState(previewResponse));
      if (previewResponse.missingRequiredFields.length > 0) {
        setStatusMessage("We can't find some required fields. Map columns to continue.");
      } else {
        setStatusMessage("Preview ready. Review mapping, then import.");
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to preview CSV.";
      setError(message);
      setPreview(null);
      setMapping(EMPTY_MAPPING);
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

  const handleMappingChange = (field: RequiredFieldKey, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value || null,
    }));
  };

  const handleImport = async () => {
    if (!selectedFile || !preview) return;
    if (missingMappings.length > 0) {
      setError("Map all required fields before importing.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setResult(null);
      setStatusMessage("Import in progress...");
      const response = await commitProjectsCsvImport(selectedFile, mapping);
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
  const previewRows = (preview?.previewRows ?? []).slice(0, PREVIEW_ROWS_LIMIT);

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
        <p>Upload any CSV format. We will preview and help map columns before importing.</p>
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
                <h2 id="step-2-title">Step 2: Preview and mapping</h2>
                <span className="import-file-meta">
                  {fileMeta ? `${fileMeta.name} • ${fileMeta.formattedSize}` : "No file loaded"}
                </span>
              </div>

              {previewLoading && <p className="import-loading-note">Generating preview...</p>}

              {!previewLoading && preview && (
                <>
                  {preview.warnings.length > 0 && (
                    <div className="import-alert warning">
                      {preview.warnings.map((warning) => (
                        <p key={warning} className="import-alert-line">
                          {warning}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="preview-validation">
                    <h3>Detected headers</h3>
                    <div className="header-list" role="list">
                      {previewHeaders.map((header) => (
                        <span key={header} className="header-chip" role="listitem">
                          {header}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mapping-form" aria-label="Required field mapping">
                    {REQUIRED_FIELDS.map((field) => {
                      const selected = mapping[field.key] || "";
                      const isMissing = !mapping[field.key];
                      return (
                        <label key={field.key} className="mapping-row">
                          <span>{field.label}</span>
                          <select
                            value={selected}
                            onChange={(event) => handleMappingChange(field.key, event.target.value)}
                            disabled={uploading}
                          >
                            <option value="">Select column...</option>
                            {previewHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                          {isMissing && (
                            <small className="mapping-help-error">
                              Your file does not include a column for {field.label}; please add it or map correctly.
                            </small>
                          )}
                        </label>
                      );
                    })}
                  </div>

                  <div className="preview-table-wrap">
                    <h3>Preview rows ({Math.min(PREVIEW_ROWS_LIMIT, previewRows.length)} shown)</h3>
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
                              <td key={`${rowIndex}-${header}`}>{row[header] || <span className="cell-empty">—</span>}</td>
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
              <p className="import-hint">Import stays disabled until all required fields are mapped.</p>
            </section>

            {result && <ImportSummary result={result} onDownloadErrors={handleDownloadErrors} />}
            {result && <RowErrorsTable errors={result.errors} maxDisplay={MAX_ERRORS_DISPLAY} />}
          </div>

          <aside className="import-side-col">
            <div className="import-card import-guide-card">
              <h3>Required fields</h3>
              <ul>
                {REQUIRED_FIELDS.map((field) => (
                  <li key={field.key}>{field.label}</li>
                ))}
              </ul>
              <p>Any CSV shape is accepted, but these fields must be mapped for import.</p>
            </div>
            <div className="import-card import-guide-card">
              <h3>Safety checks</h3>
              <ul>
                <li>Maximum file size: 5MB.</li>
                <li>Maximum rows: 5,000.</li>
                <li>Server re-validates file and mapping on commit.</li>
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
