export type ReportView = "summary" | "analytics" | "records";

type ReportViewSwitchProps = {
  active: ReportView;
  onChange: (view: ReportView) => void;
};

export default function ReportViewSwitch({ active, onChange }: ReportViewSwitchProps) {
  return (
    <section className="report-view-switch" aria-label="Report view switch">
      <button
        type="button"
        className={active === "summary" ? "active" : ""}
        onClick={() => onChange("summary")}
      >
        Summary
      </button>
      <button
        type="button"
        className={active === "analytics" ? "active" : ""}
        onClick={() => onChange("analytics")}
      >
        Analytics
      </button>
      <button
        type="button"
        className={active === "records" ? "active" : ""}
        onClick={() => onChange("records")}
      >
        Records
      </button>
    </section>
  );
}
