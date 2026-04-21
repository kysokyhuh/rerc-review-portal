import React, { useEffect, useMemo, useState } from "react";
import type { ProtocolProfile, UpdateProtocolProfilePayload } from "@/types";
import { formatDateDisplay } from "@/utils/dateUtils";
import "../styles/protocol-profile.css";

/* ── Field & Group definitions ───────────────────────────────────── */

type ProfileField = {
  key: keyof UpdateProtocolProfilePayload;
  label: string;
  type: "text" | "date" | "number" | "select";
  options?: string[];
};

type ProfileGroup = {
  name: string;
  icon: string;
  defaultOpen: boolean;
  fields: ProfileField[];
  hasWithdrawn?: boolean;
};

const COLLEGE_OPTIONS = ["BAGCED", "CCS", "CLA", "COS", "GCOE", "RVRCOB", "OTHERS"];
const TYPE_OF_REVIEW_OPTIONS = ["EXEMPT", "EXPEDITED", "FULL_BOARD"];
const PROPONENT_OPTIONS = ["UNDERGRADUATE", "GRADUATE", "FACULTY", "NON-TEACHING/STAFF"];
const DEPARTMENT_OPTIONS = [
  "AdRIC",
  "CENSER",
  "CLT-SOE",
  "CPS",
  "IBEHT",
  "School of Innovation and Sustainability",
  "SOE",
];

/** Fields that represent true reference/identity data for the protocol. */
const CORE_GROUPS: ProfileGroup[] = [
  {
    name: "Core Information",
    icon: "📋",
    defaultOpen: true,
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "projectLeader", label: "Project Leader", type: "text" },
      { key: "college", label: "College", type: "select", options: COLLEGE_OPTIONS },
      { key: "department", label: "Department", type: "select", options: DEPARTMENT_OPTIONS },
      { key: "dateOfSubmission", label: "Date of Submission", type: "date" },
      { key: "monthOfSubmission", label: "Month of Submission", type: "text" },
      { key: "typeOfReview", label: "Type of Review", type: "select", options: TYPE_OF_REVIEW_OPTIONS },
      { key: "proponent", label: "Proponent", type: "select", options: PROPONENT_OPTIONS },
      { key: "funding", label: "Funding", type: "text" },
      { key: "typeOfResearchPhreb", label: "Type of Research PHREB", type: "text" },
      { key: "typeOfResearchPhrebOther", label: "Type of Research PHREB (Other)", type: "text" },
      { key: "remarks", label: "Remarks", type: "text" },
    ],
  },
  {
    name: "Clearance & Dates",
    icon: "📅",
    defaultOpen: false,
    hasWithdrawn: true,
    fields: [
      { key: "finishDate", label: "Finish Date", type: "date" },
      { key: "monthOfClearance", label: "Month of Clearance", type: "text" },
      { key: "projectEndDate6A", label: "Project End Date (6A)", type: "date" },
      { key: "clearanceExpiration", label: "Clearance Expiration", type: "date" },
    ],
  },
];

/**
 * Fields carried over from legacy spreadsheet imports. These are NOT the live
 * operational source of truth — live workflow data is tracked via Submission,
 * Classification, and ReviewAssignment records. These fields are kept for
 * historical reference and should not be read as authoritative workflow state.
 */
const LEGACY_REFERENCE_GROUPS: ProfileGroup[] = [
  {
    name: "Legacy Status & Counts",
    icon: "📊",
    defaultOpen: false,
    fields: [
      { key: "status", label: "Status (legacy)", type: "text" },
      { key: "reviewDurationDays", label: "Review Duration Days (legacy)", type: "number" },
      { key: "classificationOfProposalRerc", label: "Classification of Proposal (RERC)", type: "text" },
      { key: "totalDays", label: "Total Days (legacy)", type: "number" },
      { key: "submissionCount", label: "# Submissions (legacy)", type: "number" },
    ],
  },
  {
    name: "Legacy Panel & Reviewers",
    icon: "👥",
    defaultOpen: false,
    fields: [
      { key: "panel", label: "Panel (legacy)", type: "select", options: ["Panel 1", "Panel 2", "Panel 3", "Panel 4"] },
      { key: "scientistReviewer", label: "Scientist Reviewer (legacy)", type: "text" },
      { key: "layReviewer", label: "Lay Reviewer (legacy)", type: "text" },
      { key: "independentConsultant", label: "Independent Consultant (legacy)", type: "text" },
      { key: "primaryReviewer", label: "Primary Reviewer (legacy)", type: "text" },
      { key: "finalLayReviewer", label: "Lay Reviewer — Final (legacy)", type: "text" },
      { key: "honorariumStatus", label: "Honorarium Status (legacy)", type: "text" },
    ],
  },
  {
    name: "Legacy Progress Report",
    icon: "📈",
    defaultOpen: false,
    fields: [
      { key: "progressReportTargetDate", label: "Target Date", type: "date" },
      { key: "progressReportSubmission", label: "Submission", type: "date" },
      { key: "progressReportApprovalDate", label: "Approval Date", type: "date" },
      { key: "progressReportStatus", label: "Status", type: "text" },
      { key: "progressReportDays", label: "# of Days", type: "number" },
    ],
  },
  {
    name: "Legacy Final Report",
    icon: "📄",
    defaultOpen: false,
    fields: [
      { key: "finalReportTargetDate", label: "Target Date", type: "date" },
      { key: "finalReportSubmission", label: "Submission", type: "date" },
      { key: "finalReportCompletionDate", label: "Completion Date", type: "date" },
      { key: "finalReportStatus", label: "Status", type: "text" },
      { key: "finalReportDays", label: "# of Days", type: "number" },
    ],
  },
  {
    name: "Legacy Amendment",
    icon: "✏️",
    defaultOpen: false,
    fields: [
      { key: "amendmentSubmission", label: "Submission", type: "date" },
      { key: "amendmentStatusOfRequest", label: "Status of Request", type: "text" },
      { key: "amendmentApprovalDate", label: "Approval Date", type: "date" },
      { key: "amendmentDays", label: "# of Days", type: "number" },
    ],
  },
  {
    name: "Legacy Continuing Review",
    icon: "🔄",
    defaultOpen: false,
    fields: [
      { key: "continuingSubmission", label: "Submission", type: "date" },
      { key: "continuingStatusOfRequest", label: "Status of Request", type: "text" },
      { key: "continuingApprovalDate", label: "Approval Date", type: "date" },
      { key: "continuingDays", label: "# of Days", type: "number" },
    ],
  },
];

const ADDABLE_LEGACY_GROUP_NAMES = new Set([
  "Legacy Progress Report",
  "Legacy Final Report",
  "Legacy Amendment",
  "Legacy Continuing Review",
]);

const ALWAYS_VISIBLE_LEGACY_GROUPS = LEGACY_REFERENCE_GROUPS.filter(
  (group) => !ADDABLE_LEGACY_GROUP_NAMES.has(group.name)
);
const ADDABLE_LEGACY_GROUPS = LEGACY_REFERENCE_GROUPS.filter((group) =>
  ADDABLE_LEGACY_GROUP_NAMES.has(group.name)
);

/** All groups combined — used by profileToFormState / formStateToPayload so every field round-trips correctly. */
const PROFILE_GROUPS: ProfileGroup[] = [...CORE_GROUPS, ...LEGACY_REFERENCE_GROUPS];

/* ── Helpers ──────────────────────────────────────────────────────── */

const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : "");
const toNumberInput = (value?: number | null) =>
  value === null || value === undefined ? "" : String(value);

/** Build a flat Record<string, string> from a ProtocolProfile for editing. */
export function profileToFormState(profile?: ProtocolProfile | null): Record<string, string> {
  const state: Record<string, string> = {};
  for (const group of PROFILE_GROUPS) {
    for (const field of group.fields) {
      const value = profile?.[field.key as keyof ProtocolProfile];
      if (field.type === "date") {
        state[field.key] = toDateInput((value as string | null) ?? null);
      } else if (field.type === "number") {
        state[field.key] = toNumberInput((value as number | null) ?? null);
      } else {
        state[field.key] = (value as string | null) ?? "";
      }
    }
  }
  state.withdrawn = profile?.withdrawn === true ? "true" : "false";
  return state;
}

/** Build an UpdateProtocolProfilePayload from form state. */
export function formStateToPayload(formState: Record<string, string>): UpdateProtocolProfilePayload {
  const payload: UpdateProtocolProfilePayload = {};
  for (const group of PROFILE_GROUPS) {
    for (const field of group.fields) {
      const raw = (formState[field.key] ?? "").trim();
      if (!raw) {
        (payload as Record<string, unknown>)[field.key] = null;
        continue;
      }
      if (field.type === "number") {
        const parsed = Number(raw);
        (payload as Record<string, unknown>)[field.key] = Number.isFinite(parsed) ? Math.trunc(parsed) : null;
      } else {
        (payload as Record<string, unknown>)[field.key] = raw;
      }
    }
  }
  payload.withdrawn = formState.withdrawn === "true";
  return payload;
}

/* ── Chevron SVG ──────────────────────────────────────────────────── */

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    className={`pp-chevron ${open ? "pp-chevron-open" : ""}`}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 4 10 8 6 12" />
  </svg>
);

/* ── Component ────────────────────────────────────────────────────── */

export type ProtocolProfileSectionProps = {
  profile?: ProtocolProfile | null;
  editing: boolean;
  saving: boolean;
  error: string | null;
  profileForm: Record<string, string>;
  setProfileForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  /** Optional: slot for extra content after the profile (e.g. milestones table) */
  children?: React.ReactNode;
};

export const ProtocolProfileSection: React.FC<ProtocolProfileSectionProps> = ({
  profile,
  editing,
  saving,
  error,
  profileForm,
  setProfileForm,
  onEdit,
  onSave,
  onCancel,
  children,
}) => {
  // Track which groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    PROFILE_GROUPS.forEach((g) => {
      initial[g.name] = g.defaultOpen;
    });
    return initial;
  });
  const [enabledLegacySections, setEnabledLegacySections] = useState<Record<string, boolean>>({});
  const [legacyPickerOpen, setLegacyPickerOpen] = useState(false);
  const [legacyPickerValue, setLegacyPickerValue] = useState("");

  const hasSavedValue = (group: ProfileGroup) =>
    group.fields.some((field) => {
      const value = profile?.[field.key as keyof ProtocolProfile];
      return value !== null && value !== undefined && value !== "";
    });

  const autoEnabledLegacyNames = useMemo(
    () => ADDABLE_LEGACY_GROUPS.filter((group) => hasSavedValue(group)).map((group) => group.name),
    [profile]
  );

  useEffect(() => {
    if (!autoEnabledLegacyNames.length) return;
    setEnabledLegacySections((prev) => {
      const next = { ...prev };
      autoEnabledLegacyNames.forEach((name) => {
        next[name] = true;
      });
      return next;
    });
    setOpenGroups((prev) => {
      const next = { ...prev };
      autoEnabledLegacyNames.forEach((name) => {
        next[name] = true;
      });
      return next;
    });
  }, [autoEnabledLegacyNames]);

  const visibleAddableLegacyGroups = ADDABLE_LEGACY_GROUPS.filter(
    (group) => enabledLegacySections[group.name]
  );
  const availableLegacyGroups = ADDABLE_LEGACY_GROUPS.filter(
    (group) => !enabledLegacySections[group.name]
  );

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    PROFILE_GROUPS.forEach((g) => { next[g.name] = true; });
    setOpenGroups(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    PROFILE_GROUPS.forEach((g) => { next[g.name] = false; });
    setOpenGroups(next);
  };

  const allOpen = CORE_GROUPS.every((g) => openGroups[g.name]);

  const handleLegacySectionSelect = (name: string) => {
    if (!name) return;
    setEnabledLegacySections((prev) => ({ ...prev, [name]: true }));
    setOpenGroups((prev) => ({ ...prev, [name]: true }));
    setLegacyPickerOpen(false);
    setLegacyPickerValue("");
  };

  const handleLegacySectionHide = (name: string) => {
    setEnabledLegacySections((prev) => ({ ...prev, [name]: false }));
    setLegacyPickerOpen(false);
    setLegacyPickerValue("");
  };

  /** Count filled fields in a group. */
  const filledCount = (group: ProfileGroup) => {
    let count = 0;
    for (const f of group.fields) {
      const v = profile?.[f.key as keyof ProtocolProfile];
      if (v !== null && v !== undefined && v !== "") count++;
    }
    return count;
  };

  /** Format a single value for read mode. */
  const formatValue = (field: ProfileField) => {
    if (!profile) return "—";
    const raw = profile[field.key as keyof ProtocolProfile];
    if (raw === null || raw === undefined || raw === "") return "—";
    if (field.type === "date" && typeof raw === "string") {
      return formatDateDisplay(raw);
    }
    return String(raw);
  };

  const renderGroup = (
    group: ProfileGroup,
    options?: {
      canHide?: boolean;
      onHide?: () => void;
    }
  ) => {
    const isOpen = openGroups[group.name] ?? group.defaultOpen;
    const filled = filledCount(group);
    const total = group.fields.length + (group.hasWithdrawn ? 1 : 0);

    return (
      <div className={`pp-group ${isOpen ? "pp-group-open" : ""}`} key={group.name}>
        <div className="pp-group-head">
          <button
            type="button"
            className="pp-group-toggle"
            onClick={() => toggleGroup(group.name)}
            aria-expanded={isOpen}
          >
            <Chevron open={isOpen} />
            <span className="pp-group-icon">{group.icon}</span>
            <span className="pp-group-name">{group.name}</span>
            <span className="pp-group-count">{filled}/{total}</span>
          </button>
          {options?.canHide ? (
            <button type="button" className="btn btn-ghost btn-sm pp-hide-btn" onClick={options.onHide}>
              Hide
            </button>
          ) : null}
        </div>

        {isOpen && (
          <div className="pp-group-body">
            <div className="pp-fields">
              {group.fields.map((field) => {
                const isEmpty = !profile?.[field.key as keyof ProtocolProfile] && !editing;
                return (
                  <div className={`pp-field ${isEmpty ? "pp-field-empty" : ""}`} key={field.key}>
                    <label className="pp-field-label">{field.label}</label>
                    {editing ? (
                      field.type === "select" ? (
                        (() => {
                          const currentValue = profileForm[field.key] ?? "";
                          const options = field.options ?? [];
                          const hasCurrent = currentValue !== "" && options.includes(currentValue);
                          return (
                            <select
                              className="pp-field-input"
                              value={currentValue}
                              onChange={(e) =>
                                setProfileForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                            >
                              <option value="">Select...</option>
                              {!hasCurrent ? <option value={currentValue}>{currentValue}</option> : null}
                              {field.options?.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          );
                        })()
                      ) : (
                        <input
                          className="pp-field-input"
                          type={field.type}
                          value={profileForm[field.key] ?? ""}
                          onChange={(e) =>
                            setProfileForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                        />
                      )
                    ) : (
                      <span className="pp-field-value">{formatValue(field)}</span>
                    )}
                  </div>
                );
              })}
              {group.hasWithdrawn && (
                <div className="pp-field" key="withdrawn">
                  <label className="pp-field-label">Withdrawn</label>
                  {editing ? (
                    <select
                      className="pp-field-input"
                      value={profileForm.withdrawn ?? "false"}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, withdrawn: e.target.value }))
                      }
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  ) : (
                    <span className="pp-field-value">
                      {profile?.withdrawn ? "Yes" : "No"}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="card detail-card pp-section">
      {/* Header */}
      <div className="pp-header">
        <div className="pp-header-left">
          <h2>Protocol Profile</h2>
          {error && <p className="pp-error">{error}</p>}
        </div>
        <div className="pp-header-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={allOpen ? collapseAll : expandAll}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
          {editing ? (
            <>
              <button className="btn btn-primary btn-sm" type="button" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel} disabled={saving}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn btn-secondary btn-sm" type="button" onClick={onEdit}>
              Edit profile
            </button>
          )}
        </div>
      </div>

      {/* Core profile groups */}
      <div className="pp-groups">
        {CORE_GROUPS.map((group) => renderGroup(group))}
      </div>

      {/* Legacy reference fields — not live workflow truth */}
      <div className="pp-legacy-section">
        <div className="pp-legacy-header">
          <span className="pp-legacy-label">Legacy reference fields</span>
          <span className="pp-legacy-note">
            Carried over from spreadsheet imports. Not the live operational source of truth — live status, reviewers, and classifications are tracked separately.
          </span>
        </div>
        <div className="pp-legacy-controls">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setLegacyPickerOpen((prev) => !prev)}
            disabled={availableLegacyGroups.length === 0}
          >
            Add Legacy Section
          </button>
          {legacyPickerOpen ? (
            <select
              className="pp-field-input pp-legacy-picker"
              value={legacyPickerValue}
              onChange={(event) => {
                const next = event.target.value;
                setLegacyPickerValue(next);
                handleLegacySectionSelect(next);
              }}
            >
              <option value="">Select section...</option>
              {availableLegacyGroups.map((group) => (
                <option key={group.name} value={group.name}>
                  {group.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <div className="pp-groups">
          {ALWAYS_VISIBLE_LEGACY_GROUPS.map((group) => renderGroup(group))}
          {visibleAddableLegacyGroups.map((group) =>
            renderGroup(group, {
              canHide: true,
              onHide: () => handleLegacySectionHide(group.name),
            })
          )}
        </div>
      </div>

      {/* Slot for extensions (milestones, etc.) */}
      {children}
    </section>
  );
};
