import type { ReportPdfSection } from "@/utils/reportPdfExport";
import { getReportPdfPageKinds, REPORT_PDF_RECORDS_PER_PAGE } from "@/utils/reportPdfExport";

export type ReportPdfPreset = "executive" | "summary" | "full" | "custom";

type ReportPdfPresetConfig = {
  key: ReportPdfPreset;
  label: string;
  badge?: string;
  description: string;
  sections: ReportPdfSection[];
};

type ReportPdfExportDialogProps = {
  open: boolean;
  selectedPreset: ReportPdfPreset;
  selectedSections: ReportPdfSection[];
  estimatedPages: number;
  estimatedRecordCount: number;
  previewPageKinds: ReturnType<typeof getReportPdfPageKinds>;
  exporting: boolean;
  exportDisabled: boolean;
  onClose: () => void;
  onPresetChange: (preset: ReportPdfPreset) => void;
  onSectionToggle: (section: ReportPdfSection) => void;
  onExport: () => void;
};

export const REPORT_PDF_PRESETS: ReportPdfPresetConfig[] = [
  {
    key: "executive",
    label: "Executive 1-page",
    badge: "Best for one-page sharing",
    description: "A concise page with report scope, key totals, category totals, and the overview insight.",
    sections: ["executive"],
  },
  {
    key: "summary",
    label: "Summary Pack",
    description: "A readable report packet with executive overview, tables, comparative detail, and analytics.",
    sections: ["executive", "overview", "matrix", "comparative", "analytics"],
  },
  {
    key: "full",
    label: "Full Report Pack",
    badge: "Default",
    description: "The complete summary packet plus a capped submission-records appendix.",
    sections: ["executive", "overview", "matrix", "comparative", "analytics", "records"],
  },
];

const SECTION_OPTIONS: Array<{
  key: ReportPdfSection;
  label: string;
  description: string;
}> = [
  {
    key: "executive",
    label: "Executive overview",
    description: "One-page scope, key totals, and narrative insight.",
  },
  {
    key: "overview",
    label: "Overview table",
    description: "High-level totals for the selected report filters.",
  },
  {
    key: "matrix",
    label: "Review mix matrix",
    description: "Review paths by proponent category.",
  },
  {
    key: "comparative",
    label: "Comparative breakdown",
    description: "Detailed comparative tables by category.",
  },
  {
    key: "analytics",
    label: "Analytics",
    description: "Current visual chart selection.",
  },
  {
    key: "records",
    label: "Records appendix",
    description: `Up to 100 matching submissions, ${REPORT_PDF_RECORDS_PER_PAGE} rows per PDF page.`,
  },
];

export function getReportPdfPresetConfig(preset: ReportPdfPreset) {
  return REPORT_PDF_PRESETS.find((item) => item.key === preset) ?? REPORT_PDF_PRESETS[2];
}

export default function ReportPdfExportDialog({
  open,
  selectedPreset,
  selectedSections,
  estimatedPages,
  estimatedRecordCount,
  previewPageKinds,
  exporting,
  exportDisabled,
  onClose,
  onPresetChange,
  onSectionToggle,
  onExport,
}: ReportPdfExportDialogProps) {
  if (!open) return null;

  const selectedSet = new Set(selectedSections);
  const hasRecords = selectedSet.has("records");
  const previewKinds = previewPageKinds.length
    ? previewPageKinds
    : getReportPdfPageKinds(selectedSections, estimatedRecordCount);

  return (
    <div className="report-export-dialog-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="report-export-dialog" onClick={(event) => event.stopPropagation()}>
        <header className="report-export-dialog-header">
          <div>
            <span className="section-kicker">PDF Export</span>
            <h2>Choose what to include</h2>
            <p>
              Use the executive one-page preset for sharing, or export a full readable packet with appendices.
            </p>
          </div>
          <button
            type="button"
            className="report-export-dialog-close"
            onClick={onClose}
            aria-label="Close export dialog"
            disabled={exporting}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </header>

        <div className="report-export-presets">
          {REPORT_PDF_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={`report-export-preset ${selectedPreset === preset.key ? "active" : ""}`}
              onClick={() => onPresetChange(preset.key)}
              disabled={exporting}
            >
              <span className="report-export-preset-title">
                {preset.label}
                {preset.badge ? <span>{preset.badge}</span> : null}
              </span>
              <span className="report-export-preset-description">{preset.description}</span>
            </button>
          ))}
        </div>

        {selectedPreset === "custom" ? (
          <div className="report-export-custom-note">
            Custom selection active. Presets remain available above if you want to reset the package.
          </div>
        ) : null}

        <div className="report-export-dialog-grid">
          <section className="report-export-options">
            <h3>Sections</h3>
            {SECTION_OPTIONS.map((section) => (
              <label key={section.key} className="report-export-option">
                <input
                  type="checkbox"
                  checked={selectedSet.has(section.key)}
                  onChange={() => onSectionToggle(section.key)}
                  disabled={exporting}
                />
                <span>
                  <strong>{section.label}</strong>
                  <small>{section.description}</small>
                </span>
              </label>
            ))}
          </section>

          <aside className="report-export-estimate">
            <h3>Page estimate</h3>
            <div className="report-export-page-count">
              {estimatedPages}
              <span>{estimatedPages === 1 ? "page" : "pages"}</span>
            </div>
            <p>
              Recommended one-page layout: Executive overview only. Detailed tables and appendices stay readable
              when exported as additional pages.
            </p>
            {hasRecords ? (
              <p>
                Records appendix will include up to{" "}
                {Math.min(estimatedRecordCount || 100, 100).toLocaleString("en-US")} rows. If more match,
                the PDF will note that it is showing the first 100.
              </p>
            ) : null}
          </aside>
        </div>

        <section className="report-export-preview" aria-label="PDF preview">
          <div className="report-export-preview-head">
            <div>
              <h3>Preview</h3>
              <p>Approximate page order and density before export.</p>
            </div>
            <span>{estimatedPages} {estimatedPages === 1 ? "page" : "pages"}</span>
          </div>
          <div className="report-export-preview-strip">
            {previewKinds.map((kind, index) => (
              <article key={`${kind}-${index}`} className={`report-export-preview-page preview-${kind}`}>
                <div className="report-export-preview-paper">
                  <span>{index + 1}</span>
                  <strong>
                    {kind === "executive"
                      ? "Executive overview"
                      : kind === "details"
                      ? "Summary details"
                      : kind === "comparative"
                      ? "Comparative summary"
                      : kind === "analytics"
                      ? "Analytics"
                      : "Records appendix"}
                  </strong>
                  <div className="report-export-preview-lines">
                    <i />
                    <i />
                    <i />
                    {kind !== "executive" ? <i /> : null}
                    {kind === "records" ? <i /> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="report-export-dialog-footer">
          <button type="button" className="report-btn-secondary" onClick={onClose} disabled={exporting}>
            Cancel
          </button>
          <button type="button" className="report-btn-primary" onClick={onExport} disabled={exportDisabled}>
            {exporting ? "Exporting PDF..." : "Export PDF"}
          </button>
        </footer>
      </section>
    </div>
  );
}
