import type { ImportResult } from "@/types";

interface ImportSummaryProps {
  result: ImportResult;
  onDownloadErrors: () => void;
}

export function ImportSummary({ result, onDownloadErrors }: ImportSummaryProps) {
  const hasErrors = result.errors.length > 0;

  return (
    <section className="import-summary-card" aria-labelledby="import-summary-title">
      <div className="import-summary-header">
        <h2 id="import-summary-title">Step 3: Import results</h2>
        <span className={`import-pill ${hasErrors ? "import-pill-warning" : "import-pill-success"}`}>
          {hasErrors ? "Completed with issues" : "Import successful"}
        </span>
      </div>

      <div className="import-summary-grid">
        <div className="import-metric">
          <span>Rows received</span>
          <strong>{result.receivedRows}</strong>
        </div>
        <div className="import-metric">
          <span>Rows imported</span>
          <strong>{result.insertedRows}</strong>
        </div>
        <div className="import-metric">
          <span>Rows failed</span>
          <strong>{result.failedRows}</strong>
        </div>
      </div>

      <div className="import-summary-actions">
        <button
          className="btn btn-secondary"
          type="button"
          onClick={onDownloadErrors}
          disabled={!hasErrors}
        >
          Download Error Report
        </button>
      </div>
    </section>
  );
}
