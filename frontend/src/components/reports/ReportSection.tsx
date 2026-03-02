import type { ReactNode } from "react";

type ReportSectionProps = {
  title: string;
  subtitle?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
};

export default function ReportSection({
  title,
  subtitle,
  collapsible = false,
  defaultOpen = true,
  children,
}: ReportSectionProps) {
  if (collapsible) {
    return (
      <section className="report-section">
        <details open={defaultOpen} className="report-section-details">
          <summary className="report-section-summary">
            <div>
              <h3>{title}</h3>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </summary>
          <div className="report-section-body">{children}</div>
        </details>
      </section>
    );
  }

  return (
    <section className="report-section">
      <div className="report-section-header">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="report-section-body">{children}</div>
    </section>
  );
}

