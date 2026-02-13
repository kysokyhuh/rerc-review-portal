import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createProjectWithInitialSubmission,
  fetchCommittees,
  type CommitteeSummary,
} from "@/services/api";
import { Breadcrumbs } from "@/components";
import "../styles/new-protocol.css";

/* ── Form state shape ─────────────────────────────────────────────── */

type FormState = {
  // Core
  projectCode: string;
  title: string;
  piName: string;
  committeeCode: string;
  submissionType: string;
  receivedDate: string;
  // Details
  collegeOrUnit: string;
  department: string;
  proponent: string;
  proponentCategory: string;
  fundingType: string;
  researchTypePHREB: string;
  researchTypePHREBOther: string;
  // Review & Panel
  panel: string;
  scientistReviewer: string;
  layReviewer: string;
  independentConsultant: string;
  honorariumStatus: string;
  // Dates & Status
  classificationDate: string;
  finishDate: string;
  monthOfSubmission: string;
  monthOfClearance: string;
  status: string;
  // Notes
  notes: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const INITIAL_FORM: FormState = {
  projectCode: "",
  title: "",
  piName: "",
  committeeCode: "",
  submissionType: "",
  receivedDate: "",
  collegeOrUnit: "",
  department: "",
  proponent: "",
  proponentCategory: "",
  fundingType: "",
  researchTypePHREB: "",
  researchTypePHREBOther: "",
  panel: "",
  scientistReviewer: "",
  layReviewer: "",
  independentConsultant: "",
  honorariumStatus: "",
  classificationDate: "",
  finishDate: "",
  monthOfSubmission: "",
  monthOfClearance: "",
  status: "",
  notes: "",
};

/* ── Option lists ─────────────────────────────────────────────────── */

const SUBMISSION_TYPES = [
  "INITIAL",
  "RESUBMISSION",
  "AMENDMENT",
  "CONTINUING_REVIEW",
  "FINAL_REPORT",
  "WITHDRAWAL",
  "SAFETY_REPORT",
  "PROTOCOL_DEVIATION",
];

const FUNDING_TYPES = ["INTERNAL", "EXTERNAL", "SELF_FUNDED", "NO_FUNDING"];
const PROPONENT_CATEGORIES = ["UNDERGRAD", "GRAD", "FACULTY", "OTHER"];
const RESEARCH_TYPES = [
  "BIOMEDICAL",
  "SOCIAL_BEHAVIORAL",
  "PUBLIC_HEALTH",
  "CLINICAL_TRIAL",
  "EPIDEMIOLOGICAL",
  "OTHER",
];
const REVIEW_TYPES = ["EXEMPT", "EXPEDITED", "FULL_BOARD"];
const STATUS_OPTIONS = ["RECEIVED", "CLEARED", "EXEMPTED", "WITHDRAWN"];
const HONORARIUM_OPTIONS = ["PAID", "PROCESSING", "PENDING", "NOT_APPLICABLE"];

/* ── Helpers ──────────────────────────────────────────────────────── */

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const validateForm = (form: FormState): FieldErrors => {
  const errors: FieldErrors = {};
  if (!form.projectCode.trim()) errors.projectCode = "Project code is required.";
  if (!form.committeeCode.trim()) errors.committeeCode = "Committee is required.";
  if (form.receivedDate.trim() && Number.isNaN(new Date(form.receivedDate).getTime())) {
    errors.receivedDate = "Received date is invalid.";
  }
  if (form.classificationDate.trim() && Number.isNaN(new Date(form.classificationDate).getTime())) {
    errors.classificationDate = "Invalid date.";
  }
  if (form.finishDate.trim() && Number.isNaN(new Date(form.finishDate).getTime())) {
    errors.finishDate = "Invalid date.";
  }
  return errors;
};

/* ── Section definitions for preview ──────────────────────────────── */

type SectionDef = {
  title: string;
  fields: Array<{ key: keyof FormState; label: string }>;
};

const PREVIEW_SECTIONS: SectionDef[] = [
  {
    title: "Core Information",
    fields: [
      { key: "projectCode", label: "Project Code" },
      { key: "title", label: "Project Title" },
      { key: "piName", label: "Project Leader / PI" },
      { key: "committeeCode", label: "Committee" },
      { key: "submissionType", label: "Submission Type" },
      { key: "receivedDate", label: "Date Received" },
    ],
  },
  {
    title: "Institution & Proponent",
    fields: [
      { key: "collegeOrUnit", label: "College / Service Unit" },
      { key: "department", label: "Department" },
      { key: "proponent", label: "Proponent" },
      { key: "proponentCategory", label: "Proponent Category" },
      { key: "fundingType", label: "Funding Type" },
      { key: "researchTypePHREB", label: "Research Type (PHREB)" },
      { key: "researchTypePHREBOther", label: "Research Type (Specify)" },
    ],
  },
  {
    title: "Panel & Reviewers",
    fields: [
      { key: "panel", label: "Panel" },
      { key: "scientistReviewer", label: "Scientist Reviewer" },
      { key: "layReviewer", label: "Lay Reviewer" },
      { key: "independentConsultant", label: "Independent Consultant" },
      { key: "honorariumStatus", label: "Honorarium Status" },
    ],
  },
  {
    title: "Status & Dates",
    fields: [
      { key: "status", label: "Status" },
      { key: "classificationDate", label: "Classification Date" },
      { key: "finishDate", label: "Finish Date" },
      { key: "monthOfSubmission", label: "Month of Submission" },
      { key: "monthOfClearance", label: "Month of Clearance" },
    ],
  },
  {
    title: "Notes",
    fields: [{ key: "notes", label: "Remarks / Notes" }],
  },
];

/* ── Component ────────────────────────────────────────────────────── */

type Step = "form" | "preview";

export default function NewProtocolPage() {
  const [form, setForm] = useState<FormState>({ ...INITIAL_FORM });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [committees, setCommittees] = useState<CommitteeSummary[]>([]);
  const [committeeLoading, setCommitteeLoading] = useState(true);
  const [committeeError, setCommitteeError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ projectId: number; submissionId: number } | null>(null);
  const [step, setStep] = useState<Step>("form");

  useEffect(() => {
    const loadCommittees = async () => {
      try {
        setCommitteeLoading(true);
        const result = await fetchCommittees();
        setCommittees(result);
        if (!form.committeeCode && result.length > 0) {
          setForm((prev) => ({ ...prev, committeeCode: result[0].code }));
        }
      } catch (error: any) {
        setCommitteeError(error?.message || "Failed to load committees.");
      } finally {
        setCommitteeLoading(false);
      }
    };
    loadCommittees();
  }, []);

  const canSubmit = useMemo(() => Object.keys(validateForm(form)).length === 0 && !loading, [form, loading]);

  const filledCount = useMemo(() => {
    return (Object.keys(form) as (keyof FormState)[]).filter(
      (k) => k !== "committeeCode" && form[k].trim() !== ""
    ).length;
  }, [form]);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handlePreview = () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setStep("preview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      setLoading(true);
      const response = await createProjectWithInitialSubmission({
        projectCode: form.projectCode,
        title: form.title || undefined,
        piName: form.piName || undefined,
        committeeCode: form.committeeCode,
        submissionType: form.submissionType || undefined,
        receivedDate: form.receivedDate || undefined,
        fundingType: form.fundingType || undefined,
        collegeOrUnit: form.collegeOrUnit || undefined,
        department: form.department || undefined,
        proponent: form.proponent || undefined,
        researchTypePHREB: form.researchTypePHREB || undefined,
        researchTypePHREBOther: form.researchTypePHREBOther || undefined,
        proponentCategory: (form.proponentCategory || undefined) as
          | "UNDERGRAD" | "GRAD" | "FACULTY" | "OTHER" | undefined,
        notes: form.notes || undefined,
        panel: form.panel || undefined,
        scientistReviewer: form.scientistReviewer || undefined,
        layReviewer: form.layReviewer || undefined,
        independentConsultant: form.independentConsultant || undefined,
        honorariumStatus: form.honorariumStatus || undefined,
        classificationDate: form.classificationDate || undefined,
        finishDate: form.finishDate || undefined,
        status: form.status || undefined,
        monthOfSubmission: form.monthOfSubmission || undefined,
        monthOfClearance: form.monthOfClearance || undefined,
      });
      setCreated(response);
    } catch (error: any) {
      if (error?.response?.status === 400) {
        const fieldErrors = error?.response?.data?.errors as Array<{ field: string; message: string }> | undefined;
        if (fieldErrors?.length) {
          const mapped: FieldErrors = {};
          fieldErrors.forEach((fe) => {
            const key = fe.field as keyof FormState;
            if (key in INITIAL_FORM) mapped[key] = fe.message;
          });
          setErrors(mapped);
          setStep("form");
          return;
        }
      }

      if (error?.response?.status === 409 && error?.response?.data?.projectId) {
        setSubmitError("Project code already exists. You can open the existing project.");
        setCreated({ projectId: error.response.data.projectId, submissionId: 0 });
        return;
      }

      setSubmitError(error?.response?.data?.message || error?.message || "Failed to create protocol.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ ...INITIAL_FORM, committeeCode: committees[0]?.code || "" });
    setErrors({});
    setSubmitError(null);
    setCreated(null);
    setStep("form");
  };

  /* ── Render helpers ─────────────────────────────────────────────── */

  const renderSelect = (
    field: keyof FormState,
    label: string,
    options: string[],
    placeholder = "Select…"
  ) => (
    <label>
      {label}
      <select value={form[field]} onChange={(e) => setField(field, e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{formatLabel(opt)}</option>
        ))}
      </select>
      {errors[field] && <small className="field-error">{errors[field]}</small>}
    </label>
  );

  const renderInput = (
    field: keyof FormState,
    label: string,
    placeholder = "",
    type: "text" | "date" = "text"
  ) => (
    <label>
      {label}
      <input
        type={type}
        value={form[field]}
        onChange={(e) => setField(field, e.target.value)}
        placeholder={placeholder}
      />
      {errors[field] && <small className="field-error">{errors[field]}</small>}
    </label>
  );

  /* ── Preview rendering ──────────────────────────────────────────── */

  const renderPreview = () => {
    const hasValue = (key: keyof FormState) => form[key].trim() !== "";

    return (
      <div className="np-preview">
        <div className="np-preview-header">
          <div className="np-preview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
          </div>
          <div>
            <h2>Review before creating</h2>
            <p className="np-preview-sub">Please verify the information below. Empty fields will be saved as blank and can be filled later.</p>
          </div>
        </div>

        {PREVIEW_SECTIONS.map((section) => {
          const sectionHasData = section.fields.some((f) => hasValue(f.key));
          return (
            <div key={section.title} className="np-preview-section">
              <h3>{section.title}</h3>
              <dl className="np-preview-grid">
                {section.fields.map((f) => (
                  <div key={f.key} className={`np-preview-item ${!hasValue(f.key) ? "empty" : ""}`}>
                    <dt>{f.label}</dt>
                    <dd>{hasValue(f.key) ? (f.key.includes("Date") && form[f.key] ? new Date(form[f.key]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : formatLabel(form[f.key])) : "—"}</dd>
                  </div>
                ))}
              </dl>
              {!sectionHasData && (
                <p className="np-preview-empty">No fields filled in this section.</p>
              )}
            </div>
          );
        })}

        {submitError && <div className="new-protocol-alert" role="alert">{submitError}</div>}

        <div className="np-preview-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setStep("form")} disabled={loading}>
            ← Back to edit
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating…" : "Confirm & Create Protocol"}
          </button>
        </div>
      </div>
    );
  };

  /* ── Success state ──────────────────────────────────────────────── */

  if (created) {
    return (
      <div className="new-protocol-page detail-v2">
        <header className="detail-hero">
          <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "New Protocol" }]} />
          <div className="detail-hero-content">
            <div className="detail-hero-text">
              <span className="detail-project-code">NEW PROTOCOL</span>
              <h1 className="detail-title">Create Protocol</h1>
            </div>
          </div>
        </header>
        <section className="new-protocol-card card detail-card">
          <div className="new-protocol-success" role="status" aria-live="polite">
            <div className="np-success-icon">✓</div>
            <h2>Protocol created successfully</h2>
            <p>Project <strong>{form.projectCode}</strong> (#{created.projectId}) is ready.</p>
            <div className="new-protocol-success-actions">
              <Link className="btn btn-primary" to={`/projects/${created.projectId}`}>View Project</Link>
              <button className="btn btn-secondary" type="button" onClick={resetForm}>Create another</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  /* ── Main render ────────────────────────────────────────────────── */

  return (
    <div className="new-protocol-page detail-v2">
      <header className="detail-hero">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "New Protocol" }]} />
        <div className="detail-hero-content">
          <div className="detail-hero-text">
            <span className="detail-project-code">NEW PROTOCOL</span>
            <h1 className="detail-title">Create Protocol</h1>
            <span className="detail-subtitle">
              {step === "form"
                ? "Fill in the fields below. Only Project Code and Committee are required — everything else is optional."
                : "Review the details before creating the protocol."}
            </span>
          </div>
        </div>
      </header>

      {/* Step indicator */}
      <div className="np-steps">
        <div className={`np-step ${step === "form" ? "active" : "done"}`}>
          <span className="np-step-num">{step === "preview" ? "✓" : "1"}</span>
          <span>Fill details</span>
        </div>
        <div className="np-step-line" />
        <div className={`np-step ${step === "preview" ? "active" : ""}`}>
          <span className="np-step-num">2</span>
          <span>Preview & confirm</span>
        </div>
      </div>

      <section className="new-protocol-card card detail-card">
        {step === "preview" ? renderPreview() : (
          <form onSubmit={(e) => { e.preventDefault(); handlePreview(); }} noValidate>

            {/* Section 1: Core */}
            <section className="np-section">
              <div className="np-section-header">
                <h2>Core Information</h2>
                <span className="np-section-hint">Only Project Code and Committee are required</span>
              </div>
              <div className="new-protocol-grid">
                <label>
                  Project Code <span className="np-required">*</span>
                  <input
                    type="text"
                    value={form.projectCode}
                    onChange={(e) => setField("projectCode", e.target.value)}
                    placeholder="e.g. 2026-001"
                  />
                  {errors.projectCode && <small className="field-error">{errors.projectCode}</small>}
                </label>

                {renderInput("title", "Project Title", "Enter project title")}
                {renderInput("piName", "Project Leader / PI", "Dr. Jane Doe")}

                <label>
                  Committee <span className="np-required">*</span>
                  <select
                    value={form.committeeCode}
                    onChange={(e) => setField("committeeCode", e.target.value)}
                    disabled={committeeLoading || committees.length === 0}
                  >
                    {committees.map((c) => (
                      <option key={c.id} value={c.code}>{c.code} – {c.name}</option>
                    ))}
                  </select>
                  {committeeError && <small className="field-error">{committeeError}</small>}
                  {errors.committeeCode && <small className="field-error">{errors.committeeCode}</small>}
                </label>

                {renderSelect("submissionType", "Submission Type", SUBMISSION_TYPES)}
                {renderInput("receivedDate", "Date of Submission", "", "date")}
              </div>
            </section>

            {/* Section 2: Institution & Proponent */}
            <section className="np-section">
              <h2>Institution & Proponent</h2>
              <div className="new-protocol-grid">
                {renderInput("collegeOrUnit", "College / Service Unit", "e.g. College of Science")}
                {renderInput("department", "Department", "e.g. Psychology")}
                {renderInput("proponent", "Proponent", "Name of proponent")}
                {renderSelect("proponentCategory", "Proponent Category", PROPONENT_CATEGORIES)}
                {renderSelect("fundingType", "Funding Type", FUNDING_TYPES)}
                {renderSelect("researchTypePHREB", "Type of Research (PHREB)", RESEARCH_TYPES)}
                {form.researchTypePHREB === "OTHER" &&
                  renderInput("researchTypePHREBOther", "Research Type (Specify)", "Specify research type")}
              </div>
            </section>

            {/* Section 3: Panel & Reviewers */}
            <section className="np-section">
              <h2>Panel & Reviewers</h2>
              <div className="new-protocol-grid">
                {renderInput("panel", "Panel", "e.g. Panel 1")}
                {renderInput("scientistReviewer", "Scientist Reviewer", "Full name")}
                {renderInput("layReviewer", "Lay Reviewer", "Full name")}
                {renderInput("independentConsultant", "Independent Consultant", "Full name (if applicable)")}
                {renderSelect("honorariumStatus", "Honorarium Status", HONORARIUM_OPTIONS)}
              </div>
            </section>

            {/* Section 4: Status & Dates */}
            <section className="np-section">
              <h2>Status & Dates</h2>
              <div className="new-protocol-grid">
                {renderSelect("status", "Status", STATUS_OPTIONS)}
                {renderInput("classificationDate", "Classification Date", "", "date")}
                {renderInput("finishDate", "Finish Date", "", "date")}
                {renderInput("monthOfSubmission", "Month of Submission", "e.g. January 2026")}
                {renderInput("monthOfClearance", "Month of Clearance", "e.g. March 2026")}
              </div>
            </section>

            {/* Section 5: Notes */}
            <section className="np-section">
              <h2>Remarks</h2>
              <div className="new-protocol-grid">
                <label className="notes-field">
                  Notes / Remarks
                  <textarea
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                    placeholder="Optional remarks, observations, or context"
                    rows={3}
                  />
                  {errors.notes && <small className="field-error">{errors.notes}</small>}
                </label>
              </div>
            </section>

            {submitError && <div className="new-protocol-alert" role="alert">{submitError}</div>}

            <div className="new-protocol-actions">
              <span className="np-field-count">{filledCount} of {Object.keys(INITIAL_FORM).length - 1} fields filled</span>
              <button className="btn btn-secondary" type="button" onClick={resetForm} disabled={loading}>
                Reset
              </button>
              <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
                Preview →
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
