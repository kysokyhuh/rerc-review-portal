import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createProjectWithInitialSubmission,
  fetchCommittees,
  type CommitteeSummary,
} from "@/services/api";
import { Breadcrumbs } from "@/components";
import "../styles/new-protocol.css";

type FormState = {
  projectCode: string;
  title: string;
  piName: string;
  committeeCode: string;
  submissionType: string;
  receivedDate: string;
  fundingType: string;
  notes: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const INITIAL_FORM: FormState = {
  projectCode: "",
  title: "",
  piName: "",
  committeeCode: "",
  submissionType: "INITIAL",
  receivedDate: "",
  fundingType: "",
  notes: "",
};

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

const getTodayISO = () => new Date().toISOString().slice(0, 10);

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const validateForm = (form: FormState): FieldErrors => {
  const errors: FieldErrors = {};
  if (!form.projectCode.trim()) errors.projectCode = "Project code is required.";
  if (!form.title.trim()) errors.title = "Project title is required.";
  if (!form.piName.trim()) errors.piName = "PI name is required.";
  if (!form.committeeCode.trim()) errors.committeeCode = "Committee is required.";
  if (!form.submissionType.trim()) errors.submissionType = "Submission type is required.";
  if (!form.receivedDate.trim()) {
    errors.receivedDate = "Received date is required.";
  } else if (Number.isNaN(new Date(form.receivedDate).getTime())) {
    errors.receivedDate = "Received date is invalid.";
  }
  return errors;
};

export default function NewProtocolPage() {
  const [form, setForm] = useState<FormState>({ ...INITIAL_FORM, receivedDate: getTodayISO() });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [committees, setCommittees] = useState<CommitteeSummary[]>([]);
  const [committeeLoading, setCommitteeLoading] = useState(true);
  const [committeeError, setCommitteeError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ projectId: number; submissionId: number } | null>(null);

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setLoading(true);
      const response = await createProjectWithInitialSubmission({
        projectCode: form.projectCode,
        title: form.title,
        piName: form.piName,
        committeeCode: form.committeeCode,
        submissionType: form.submissionType,
        receivedDate: form.receivedDate,
        fundingType: form.fundingType || undefined,
        notes: form.notes || undefined,
      });
      setCreated(response);
    } catch (error: any) {
      if (error?.response?.status === 400) {
        const fieldErrors = error?.response?.data?.errors as Array<{ field: string; message: string }> | undefined;
        if (fieldErrors?.length) {
          const mapped: FieldErrors = {};
          fieldErrors.forEach((fieldError) => {
            const key = fieldError.field as keyof FormState;
            if (key in INITIAL_FORM) {
              mapped[key] = fieldError.message;
            }
          });
          setErrors(mapped);
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
    setForm({ ...INITIAL_FORM, committeeCode: committees[0]?.code || "", receivedDate: getTodayISO() });
    setErrors({});
    setSubmitError(null);
    setCreated(null);
  };

  return (
    <div className="new-protocol-page">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "New Protocol" },
        ]}
      />

      <header className="page-header">
        <Link to="/dashboard" className="back-link">
          Back to Dashboard
        </Link>
        <h1>New Protocol</h1>
        <p>Create one project and its initial submission in a single step.</p>
      </header>

      <section className="new-protocol-card">
        {created ? (
          <div className="new-protocol-success" role="status" aria-live="polite">
            <h2>Protocol created</h2>
            <p>
              Project #{created.projectId} is ready.
            </p>
            <div className="new-protocol-success-actions">
              <Link className="btn btn-primary" to={`/projects/${created.projectId}`}>
                View Project
              </Link>
              <button className="btn btn-secondary" type="button" onClick={resetForm}>
                Create another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <section className="new-protocol-section">
              <h2>Required info</h2>
              <div className="new-protocol-grid">
                <label>
                  Project Code
                  <input
                    type="text"
                    value={form.projectCode}
                    onChange={(event) => setField("projectCode", event.target.value)}
                    placeholder="e.g. 2026-001"
                  />
                  {errors.projectCode && <small className="field-error">{errors.projectCode}</small>}
                </label>

                <label>
                  Project Title
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) => setField("title", event.target.value)}
                    placeholder="Enter project title"
                  />
                  {errors.title && <small className="field-error">{errors.title}</small>}
                </label>

                <label>
                  Principal Investigator
                  <input
                    type="text"
                    value={form.piName}
                    onChange={(event) => setField("piName", event.target.value)}
                    placeholder="Dr. Jane Doe"
                  />
                  {errors.piName && <small className="field-error">{errors.piName}</small>}
                </label>

                <label>
                  Committee
                  <select
                    value={form.committeeCode}
                    onChange={(event) => setField("committeeCode", event.target.value)}
                    disabled={committeeLoading || committees.length === 0}
                  >
                    {committees.map((committee) => (
                      <option key={committee.id} value={committee.code}>
                        {committee.code} - {committee.name}
                      </option>
                    ))}
                  </select>
                  {committeeError && <small className="field-error">{committeeError}</small>}
                  {errors.committeeCode && <small className="field-error">{errors.committeeCode}</small>}
                </label>

                <label>
                  Submission Type
                  <select
                    value={form.submissionType}
                    onChange={(event) => setField("submissionType", event.target.value)}
                  >
                    {SUBMISSION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {formatLabel(type)}
                      </option>
                    ))}
                  </select>
                  {errors.submissionType && <small className="field-error">{errors.submissionType}</small>}
                </label>

                <label>
                  Date Received
                  <input
                    type="date"
                    value={form.receivedDate}
                    onChange={(event) => setField("receivedDate", event.target.value)}
                  />
                  {errors.receivedDate && <small className="field-error">{errors.receivedDate}</small>}
                </label>
              </div>
            </section>

            <details className="new-protocol-optional">
              <summary>Add details (optional)</summary>
              <div className="new-protocol-grid">
                <label>
                  Funding Type
                  <select
                    value={form.fundingType}
                    onChange={(event) => setField("fundingType", event.target.value)}
                  >
                    <option value="">Select funding type</option>
                    {FUNDING_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {formatLabel(type)}
                      </option>
                    ))}
                  </select>
                  {errors.fundingType && <small className="field-error">{errors.fundingType}</small>}
                </label>

                <label className="notes-field">
                  Notes
                  <textarea
                    value={form.notes}
                    onChange={(event) => setField("notes", event.target.value)}
                    placeholder="Optional remarks"
                    rows={3}
                  />
                  {errors.notes && <small className="field-error">{errors.notes}</small>}
                </label>
              </div>
            </details>

            {submitError && <div className="new-protocol-alert" role="alert">{submitError}</div>}

            <div className="new-protocol-actions">
              <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
                {loading ? "Creating..." : "Create Protocol"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={resetForm} disabled={loading}>
                Reset
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
