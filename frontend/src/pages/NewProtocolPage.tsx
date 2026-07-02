import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createProjectWithInitialSubmission,
  fetchCommittees,
  fetchColleges,
  type CommitteeSummary,
} from "@/services/api";
import { Breadcrumbs } from "@/components";
import { BRAND } from "@/config/branding";
import {
  COLLEGE_OPTIONS,
  SUBMISSION_TYPE_OPTIONS,
  getDepartmentOptionsForCollege,
  getSubmissionTypeLabel,
} from "@/constants/protocolOptions";
import { getErrorData, getErrorMessage, getErrorStatus } from "@/utils";
import "../styles/new-protocol.css";

type FormState = {
  projectCode: string;
  title: string;
  projectLeader: string;
  committeeCode: string;
  collegeOrUnit: string;
  collegeOrUnitOther: string;
  department: string;
  departmentOther: string;
  submissionType: string;
  dateOfSubmission: string;
  proponent: string;
  proponentCategory: string;
  fundingType: string;
  researchTypePHREB: string;
  researchTypePHREBOther: string;
  remarks: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const INITIAL_FORM: FormState = {
  projectCode: "",
  title: "",
  projectLeader: "",
  committeeCode: "",
  collegeOrUnit: "",
  collegeOrUnitOther: "",
  department: "",
  departmentOther: "",
  submissionType: "",
  dateOfSubmission: "",
  proponent: "",
  proponentCategory: "",
  fundingType: "",
  researchTypePHREB: "",
  researchTypePHREBOther: "",
  remarks: "",
};

const FUNDING_TYPES = ["INTERNAL", "EXTERNAL", "SELF_FUNDED", "NO_FUNDING"] as const;
const PROPONENT_CATEGORIES = ["UNDERGRAD", "GRAD", "FACULTY", "OTHER"] as const;
const RESEARCH_TYPES = [
  "BIOMEDICAL",
  "SOCIAL_BEHAVIORAL",
  "PUBLIC_HEALTH",
  "CLINICAL_TRIAL",
  "EPIDEMIOLOGICAL",
  "OTHER",
] as const;

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const monthLabelFromDate = (value: string) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};

const validateForm = (form: FormState): FieldErrors => {
  const errors: FieldErrors = {};
  if (!form.projectCode.trim()) errors.projectCode = "Project code is required.";
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.projectLeader.trim()) errors.projectLeader = "Project Leader is required.";
  if (form.dateOfSubmission && Number.isNaN(new Date(form.dateOfSubmission).getTime())) {
    errors.dateOfSubmission = "Date of Submission is invalid.";
  }
  if (form.researchTypePHREB === "OTHER" && !form.researchTypePHREBOther.trim()) {
    errors.researchTypePHREBOther = "Please specify the research type.";
  }
  return errors;
};

export default function NewProtocolPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({ ...INITIAL_FORM });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [committees, setCommittees] = useState<CommitteeSummary[]>([]);
  const [committeeLoading, setCommitteeLoading] = useState(true);
  const [collegeOptions, setCollegeOptions] = useState<string[]>([]);
  const departmentOptions = useMemo(
    () => getDepartmentOptionsForCollege(form.collegeOrUnit),
    [form.collegeOrUnit]
  );
  const resolvedCollegeOrUnit =
    form.collegeOrUnit === "OTHERS"
      ? form.collegeOrUnitOther.trim()
      : form.collegeOrUnit.trim();
  const resolvedDepartment =
    form.department === "OTHER" ? form.departmentOther.trim() : form.department.trim();

  const monthOfSubmission = useMemo(
    () => monthLabelFromDate(form.dateOfSubmission),
    [form.dateOfSubmission]
  );

  // Finish Date is intentionally not set during Add Protocol.
  const finishDate = "";
  const monthOfClearance = useMemo(() => monthLabelFromDate(finishDate), [finishDate]);
  const systemStatus = "AWAITING_CLASSIFICATION";

  useEffect(() => {
    let active = true;
    const loadCommittees = async () => {
      try {
        setCommitteeLoading(true);
        const result = await fetchCommittees();
        if (active) {
          setCommittees(result);
          if (result.length > 0) {
            setForm((prev) => ({
              ...prev,
              committeeCode: prev.committeeCode || result[0].code,
            }));
          }
        }
      } catch {
        if (active) setCommittees([]);
      } finally {
        if (active) setCommitteeLoading(false);
      }
    };
    void loadCommittees();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      try {
        const colleges = await fetchColleges(BRAND.defaultCommitteeCode);
        if (!active) return;
        setCollegeOptions(colleges);
      } catch {
        if (!active) return;
        setCollegeOptions([]);
      }
    };
    void loadOptions();
    return () => {
      active = false;
    };
  }, []);

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

  const handleSubmit = async () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setLoading(true);
      const response = await createProjectWithInitialSubmission({
        projectCode: form.projectCode.trim(),
        title: form.title.trim(),
        piName: form.projectLeader.trim(),
        committeeCode: form.committeeCode || undefined,
        collegeOrUnit: resolvedCollegeOrUnit || undefined,
        department: resolvedDepartment || undefined,
        submissionType: form.submissionType || undefined,
        receivedDate: form.dateOfSubmission || undefined,
        proponent: form.proponent || undefined,
        proponentCategory: (form.proponentCategory || undefined) as
          | "UNDERGRAD"
          | "GRAD"
          | "FACULTY"
          | "OTHER"
          | undefined,
        fundingType: form.fundingType || undefined,
        researchTypePHREB: form.researchTypePHREB || undefined,
        researchTypePHREBOther:
          form.researchTypePHREB === "OTHER" ? form.researchTypePHREBOther || undefined : undefined,
        notes: form.remarks || undefined,
      });

      navigate(`/submissions/${response.submissionId}`, {
        replace: true,
        state: {
          createdProtocol: true,
          projectCode: form.projectCode.trim(),
          banner: "Protocol created. Next: classify the review type.",
        },
      });
    } catch (error: unknown) {
      if (getErrorStatus(error) === 400) {
        const fieldErrors = getErrorData<{
          errors?: Array<{ field: string; message: string }>;
        }>(error)?.errors as
          | Array<{ field: string; message: string }>
          | undefined;
        if (fieldErrors?.length) {
          const mapped: FieldErrors = {};
          fieldErrors.forEach((fe) => {
            const key = fe.field as keyof FormState;
            if (key in INITIAL_FORM) mapped[key] = fe.message;
            if (fe.field === "piName") mapped.projectLeader = fe.message;
          });
          setErrors(mapped);
          return;
        }
      }
      setSubmitError(getErrorMessage(error, "Failed to create protocol."));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ ...INITIAL_FORM });
    setErrors({});
    setSubmitError(null);
  };

  const mergedCollegeOptions = useMemo(() => {
    const options = new Set<string>(COLLEGE_OPTIONS);
    for (const option of collegeOptions) {
      if (option) options.add(option);
    }
    return Array.from(options);
  }, [collegeOptions]);

  return (
    <div className="new-protocol-page detail-v2">
      <header className="detail-hero">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "New Protocol" }]} />
        <div className="detail-hero-content">
          <div className="detail-hero-text">
            <span className="detail-project-code">NEW PROTOCOL</span>
            <h1 className="detail-title">Create Protocol</h1>
            <span className="detail-subtitle">
              Required at creation: Project Code, Title, Project Leader. Additional fields are optional.
            </span>
          </div>
        </div>
      </header>

      <section className="new-protocol-card card detail-card">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
          noValidate
        >
          <section className="np-section">
            <div className="np-section-header">
              <h2>Core Information</h2>
              <span className="np-section-hint">Only 3 required at creation</span>
            </div>
            <div className="new-protocol-grid">
              <label>
                <span className="np-label-row">
                  <span>Project Code</span>
                  <span className="np-required">*</span>
                </span>
                <input
                  type="text"
                  value={form.projectCode}
                  onChange={(e) => setField("projectCode", e.target.value)}
                  placeholder="e.g. 2026-001"
                />
                {errors.projectCode && <small className="field-error">{errors.projectCode}</small>}
              </label>

              <label>
                <span className="np-label-row">
                  <span>Title</span>
                  <span className="np-required">*</span>
                </span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Enter project title"
                />
                {errors.title && <small className="field-error">{errors.title}</small>}
              </label>

              <label>
                <span className="np-label-row">
                  <span>Project Leader</span>
                  <span className="np-required">*</span>
                </span>
                <input
                  type="text"
                  value={form.projectLeader}
                  onChange={(e) => setField("projectLeader", e.target.value)}
                  placeholder="Full name"
                />
                {errors.projectLeader && <small className="field-error">{errors.projectLeader}</small>}
              </label>

              <label>
                Workflow status
                <input type="text" value={systemStatus} readOnly />
              </label>
            </div>
          </section>

          <details className="np-optional-details">
            <summary>Additional Details</summary>
            <section className="np-section np-section-optional">
              <div className="np-optional-groups">
                <div className="np-optional-group">
                  <h3>Institution</h3>
                  <div className="new-protocol-grid">
                    <label>
                      College / Service Unit
                      <select
                        value={form.collegeOrUnit}
                        onChange={(e) => {
                          const next = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            collegeOrUnit: next,
                            collegeOrUnitOther: "",
                            department: "",
                            departmentOther: "",
                          }));
                        }}
                      >
                        <option value="">Select...</option>
                        {mergedCollegeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    {form.collegeOrUnit === "OTHERS" ? (
                      <label>
                        Other college / research center
                        <input
                          type="text"
                          value={form.collegeOrUnitOther}
                          onChange={(e) => setField("collegeOrUnitOther", e.target.value)}
                          placeholder="e.g. CPS, ODEL"
                        />
                      </label>
                    ) : null}

                    <label>
                      Department
                      <select
                        value={form.department}
                        onChange={(e) => {
                          const next = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            department: next,
                            departmentOther: "",
                          }));
                        }}
                        disabled={!form.collegeOrUnit && departmentOptions.length === 0}
                      >
                        <option value="">Select...</option>
                        {departmentOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                        <option value="OTHER">Other / manual entry</option>
                      </select>
                    </label>
                    {form.department === "OTHER" ? (
                      <label>
                        Other department
                        <input
                          type="text"
                          value={form.departmentOther}
                          onChange={(e) => setField("departmentOther", e.target.value)}
                          placeholder="Type department name"
                        />
                      </label>
                    ) : null}
                  </div>
                </div>

                <div className="np-optional-group">
                  <h3>Submission Setup</h3>
                  <div className="new-protocol-grid">
                    <label>
                      Submission Type
                      <select
                        value={form.submissionType}
                        onChange={(e) => setField("submissionType", e.target.value)}
                      >
                        <option value="">Select...</option>
                        {SUBMISSION_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {getSubmissionTypeLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Committee
                      <select
                        value={form.committeeCode}
                        onChange={(e) => setField("committeeCode", e.target.value)}
                        disabled={committeeLoading}
                      >
                        {committees.map((committee) => (
                          <option key={committee.id} value={committee.code}>
                            {committee.code} - {committee.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Date Received
                      <input
                        type="date"
                        value={form.dateOfSubmission}
                        onChange={(e) => setField("dateOfSubmission", e.target.value)}
                      />
                      {errors.dateOfSubmission && (
                        <small className="field-error">{errors.dateOfSubmission}</small>
                      )}
                    </label>

                    <label>
                      Month Received
                      <input
                        type="text"
                        value={monthOfSubmission}
                        readOnly
                        placeholder="Auto-derived from Date of Submission"
                      />
                    </label>
                  </div>
                </div>

                <div className="np-optional-group">
                  <h3>Proponent</h3>
                  <div className="new-protocol-grid">
                    <label>
                      Proponent
                      <input
                        type="text"
                        value={form.proponent}
                        onChange={(e) => setField("proponent", e.target.value)}
                        placeholder="Name of proponent"
                      />
                    </label>

                    <label>
                      Proponent Category
                      <select
                        value={form.proponentCategory}
                        onChange={(e) => setField("proponentCategory", e.target.value)}
                      >
                        <option value="">Select...</option>
                        {PROPONENT_CATEGORIES.map((option) => (
                          <option key={option} value={option}>
                            {formatLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="np-optional-group">
                  <h3>Research</h3>
                  <div className="new-protocol-grid">
                    <label>
                      Funding Type
                      <select
                        value={form.fundingType}
                        onChange={(e) => setField("fundingType", e.target.value)}
                      >
                        <option value="">Select...</option>
                        {FUNDING_TYPES.map((option) => (
                          <option key={option} value={option}>
                            {formatLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Type of Research PHREB
                      <select
                        value={form.researchTypePHREB}
                        onChange={(e) => setField("researchTypePHREB", e.target.value)}
                      >
                        <option value="">Select...</option>
                        {RESEARCH_TYPES.map((option) => (
                          <option key={option} value={option}>
                            {formatLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {form.researchTypePHREB === "OTHER" ? (
                      <label>
                        Type of Research PHREB (Specific for Others)
                        <input
                          type="text"
                          value={form.researchTypePHREBOther}
                          onChange={(e) => setField("researchTypePHREBOther", e.target.value)}
                          placeholder="Specify"
                        />
                        {errors.researchTypePHREBOther && (
                          <small className="field-error">{errors.researchTypePHREBOther}</small>
                        )}
                      </label>
                    ) : null}
                  </div>
                </div>

                <div className="np-optional-group">
                  <h3>Clearance</h3>
                  <div className="new-protocol-grid">
                    <label>
                      Finish Date
                      <input
                        type="text"
                        value=""
                        readOnly
                        placeholder="Set when protocol is cleared/closed"
                      />
                    </label>

                    <label>
                      Month of Clearance
                      <input
                        type="text"
                        value={monthOfClearance}
                        readOnly
                        placeholder="Auto-derived from Finish Date"
                      />
                    </label>
                  </div>
                </div>

                <div className="np-optional-group">
                  <h3>Notes</h3>
                  <div className="new-protocol-grid">
                    <label className="notes-field">
                      Remarks
                      <textarea
                        value={form.remarks}
                        onChange={(e) => setField("remarks", e.target.value)}
                        placeholder="Optional remarks"
                        rows={3}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </section>
          </details>

          {submitError ? <div className="new-protocol-alert" role="alert">{submitError}</div> : null}

          <div className="new-protocol-actions">
            <button className="btn btn-secondary" type="button" onClick={resetForm} disabled={loading}>
              Reset
            </button>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Protocol"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
