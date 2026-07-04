import { Link } from "react-router-dom";
import { Breadcrumbs } from "@/components";
import "@/styles/imports.css";

const importOptions = [
  {
    title: "Import Database",
    description:
      "Use this for the main protocol database CSV with headers, project records, reviewers, milestones, and report reference fields.",
    href: "/imports/projects",
    icon: "database",
    details: ["Requires database headers", "Creates protocol records", "Keeps legacy workflow dates"],
  },
  {
    title: "Import Classification",
    description:
      "Use this for the classification CSV. Rows are matched by protocol title and saved as classification notes and reviewer suggestions.",
    href: "/imports/classifications",
    icon: "classification",
    details: ["Matches by title", "Stores source links", "Adds Chair confirmation placeholders"],
  },
] as const;

const ImportIcon = ({ type }: { type: "database" | "classification" }) => {
  if (type === "database") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path d="M5 5v6c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
        <path d="M5 11v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 12h10" />
      <path d="M4 18h7" />
      <path d="M17 14l2 2 3-4" />
    </svg>
  );
};

export default function ImportCsvPage() {
  return (
    <div className="import-page import-choice-page portal-page portal-page--dense">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Import CSV" },
        ]}
      />

      <header className="page-header portal-context import-choice-header">
        <h1>Import CSV</h1>
        <p>
          Choose the type of spreadsheet before uploading. This keeps database uploads and
          classification uploads separate, so each file is checked with the right rules.
        </p>
      </header>

      <section className="import-choice-grid" aria-label="CSV import options">
        {importOptions.map((option) => (
          <Link key={option.href} to={option.href} className="import-choice-card">
            <span className="import-choice-icon">
              <ImportIcon type={option.icon} />
            </span>
            <span className="import-choice-copy">
              <strong>{option.title}</strong>
              <span>{option.description}</span>
            </span>
            <span className="import-choice-details">
              {option.details.map((detail) => (
                <span key={detail}>{detail}</span>
              ))}
            </span>
            <span className="import-choice-action">Continue</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
