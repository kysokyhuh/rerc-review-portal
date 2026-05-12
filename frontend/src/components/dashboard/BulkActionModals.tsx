import React, { useEffect, useMemo, useRef, useState } from "react";
import { useColdStartStatus } from "@/hooks/useColdStartStatus";
import {
  bulkAssignReviewers,
  bulkCreateReminders,
  bulkRunStatusAction,
  deleteProjectRecordsBulk,
  fetchReviewerCandidates,
  waitForBackendReady,
} from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleCapabilities } from "@/utils/roleUtils";
import type {
  BulkActionResponse,
  BulkProjectDeleteResponse,
  BulkReminderTarget,
  BulkStatusAction,
  DecoratedQueueItem,
  ReviewerCandidate,
} from "@/types";
import { formatStatusLabel } from "./utils";

interface BulkModalBaseProps {
  open: boolean;
  onClose: () => void;
  selectedItems: DecoratedQueueItem[];
  onApplied?: () => void;
}

interface BulkModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  modalClassName?: string;
}

type ScreeningCompletenessStatus =
  | "COMPLETE"
  | "MINOR_MISSING"
  | "MAJOR_MISSING"
  | "MISSING_SIGNATURES"
  | "OTHER";

type StatusActionOption = {
  value: BulkStatusAction;
  label: string;
  description: string;
};

const BULK_STATUS_ACTION_OPTIONS: StatusActionOption[] = [
  {
    value: "START_COMPLETENESS_CHECK",
    label: "Start completeness check",
    description: "Move intake-ready submissions into completeness screening.",
  },
  {
    value: "RETURN_FOR_COMPLETION",
    label: "Return for completion",
    description: "Send selected submissions back for missing requirements.",
  },
  {
    value: "MARK_NOT_ACCEPTED",
    label: "Mark not accepted",
    description: "Close out intake items that should not proceed further.",
  },
  {
    value: "ACCEPT_FOR_CLASSIFICATION",
    label: "Accept for classification",
    description: "Advance screened submissions into the classification lane.",
  },
  {
    value: "MOVE_TO_UNDER_CLASSIFICATION",
    label: "Move to under classification",
    description: "Mark accepted submissions as currently being classified.",
  },
  {
    value: "MARK_CLASSIFIED",
    label: "Mark classified",
    description: "Advance classified-ready submissions to the next workflow stage.",
  },
  {
    value: "START_REVIEW",
    label: "Start review",
    description: "Start reviewer routing for fully prepared classified submissions.",
  },
];

const COMPLETENESS_ACTIONS = new Set<BulkStatusAction>([
  "START_COMPLETENESS_CHECK",
  "RETURN_FOR_COMPLETION",
  "MARK_NOT_ACCEPTED",
]);

const REASON_REQUIRED_ACTIONS = new Set<BulkStatusAction>([
  "RETURN_FOR_COMPLETION",
  "MARK_NOT_ACCEPTED",
]);

const REVIEWER_REQUIRED_MESSAGE = "Select a reviewer before assigning this batch.";
const CHAIR_ONLY_STATUS_ACTIONS = new Set<BulkStatusAction>([
  "MOVE_TO_UNDER_CLASSIFICATION",
  "MARK_CLASSIFIED",
]);

const selectionPreview = (selectedItems: DecoratedQueueItem[]) => {
  const codes = selectedItems
    .map((item) => item.projectCode)
    .filter(Boolean)
    .slice(0, 4);

  if (codes.length === 0) {
    return `${selectedItems.length} submissions selected`;
  }

  const remainder = selectedItems.length - codes.length;
  return remainder > 0
    ? `${codes.join(", ")} +${remainder} more`
    : codes.join(", ");
};

function BulkModalShell({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  modalClassName,
}: BulkModalShellProps) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="bulk-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={modalClassName ? `bulk-modal ${modalClassName}` : "bulk-modal"}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bulk-modal-header">
          <div>
            <span className="bulk-modal-kicker">Dashboard bulk action</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <button
            className="quick-view-close"
            type="button"
            onClick={onClose}
            aria-label="Close bulk action modal"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="bulk-modal-body">{children}</div>
        {footer ? <div className="bulk-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

const formatSubmissionCountLabel = (count: number) =>
  `${count} submission${count === 1 ? "" : "s"} selected`;

const formatReviewerCandidateMeta = (candidate: ReviewerCandidate) => {
  if (candidate.reviewerExpertise.length > 0) {
    return candidate.reviewerExpertise.slice(0, 2).join(" • ");
  }

  const roleLabels = candidate.roles
    .map((role) => role.replace(/_/g, " ").toLowerCase())
    .map((role) => role.replace(/\b\w/g, (char) => char.toUpperCase()));

  if (candidate.isCommonReviewer) {
    roleLabels.unshift("Common reviewer");
  }

  return roleLabels.slice(0, 2).join(" • ") || "Reviewer candidate";
};

function BulkResultSummary({
  result,
}: {
  result: BulkActionResponse;
}) {
  return (
    <section className="bulk-result-summary">
      <div className="bulk-result-metrics">
        <div className="bulk-result-metric">
          <strong>{result.succeeded}</strong>
          <span>Succeeded</span>
        </div>
        <div className="bulk-result-metric">
          <strong>{result.skipped}</strong>
          <span>Skipped</span>
        </div>
        <div className="bulk-result-metric">
          <strong>{result.failed}</strong>
          <span>Failed</span>
        </div>
      </div>

      <div className="bulk-result-list">
        {result.results.map((entry) => (
          <div className="bulk-result-row" key={`${entry.submissionId}-${entry.status}`}>
            <div className="bulk-result-row-main">
              <span className="bulk-result-code">
                {entry.projectCode ?? `Submission #${entry.submissionId}`}
              </span>
              <p>{entry.message}</p>
            </div>
            <span className={`bulk-result-status bulk-result-status-${entry.status.toLowerCase()}`}>
              {entry.status.replace(/_/g, " ")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BulkProjectDeleteSummary({
  result,
}: {
  result: BulkProjectDeleteResponse;
}) {
  return (
    <section className="bulk-result-summary">
      <div className="bulk-result-metrics">
        <div className="bulk-result-metric">
          <strong>{result.succeeded}</strong>
          <span>Succeeded</span>
        </div>
        <div className="bulk-result-metric">
          <strong>{result.skipped}</strong>
          <span>Skipped</span>
        </div>
        <div className="bulk-result-metric">
          <strong>{result.failed}</strong>
          <span>Failed</span>
        </div>
      </div>

      <div className="bulk-result-list">
        {result.results.map((entry, index) => (
          <div
            className="bulk-result-row"
            key={`${entry.projectId ?? entry.projectCode ?? "unmapped"}-${entry.status}-${index}`}
          >
            <div className="bulk-result-row-main">
              <span className="bulk-result-code">
                {entry.projectCode ??
                  (entry.projectId ? `Project #${entry.projectId}` : "Unmapped submission")}
              </span>
              <p>{entry.message}</p>
            </div>
            <span
              className={`bulk-result-status bulk-result-status-${entry.status.toLowerCase()}`}
            >
              {entry.status.replace(/_/g, " ")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function actionAllowedForItem(
  action: BulkStatusAction,
  item: DecoratedQueueItem
) {
  switch (action) {
    case "START_COMPLETENESS_CHECK":
      return ["RECEIVED", "RETURNED_FOR_COMPLETION"].includes(item.status);
    case "RETURN_FOR_COMPLETION":
    case "MARK_NOT_ACCEPTED":
      return ["RECEIVED", "UNDER_COMPLETENESS_CHECK"].includes(item.status);
    case "ACCEPT_FOR_CLASSIFICATION":
      return (
        ["RECEIVED", "UNDER_COMPLETENESS_CHECK", "RETURNED_FOR_COMPLETION"].includes(
          item.status
        ) && Boolean(item.projectCode)
      );
    case "MOVE_TO_UNDER_CLASSIFICATION":
      return item.status === "AWAITING_CLASSIFICATION";
    case "MARK_CLASSIFIED":
      return (
        ["AWAITING_CLASSIFICATION", "UNDER_CLASSIFICATION"].includes(item.status) &&
        Boolean(item.classification?.reviewType)
      );
    case "START_REVIEW":
      return (
        ["CLASSIFIED", "REVISION_SUBMITTED"].includes(item.status) &&
        item.classification?.reviewType !== "EXEMPT" &&
        (item.reviews?.length ?? 0) > 0 &&
        (item.classification?.reviewType !== "FULL_BOARD" ||
          Boolean(item.classification?.panelId))
      );
    default:
      return false;
  }
}

function getStatusActionAvailability(
  selectedItems: DecoratedQueueItem[],
  options?: { includeChairOnlyActions?: boolean }
) {
  const includeChairOnlyActions = options?.includeChairOnlyActions ?? false;
  const availableActions = BULK_STATUS_ACTION_OPTIONS.filter(
    (action) =>
      (includeChairOnlyActions || !CHAIR_ONLY_STATUS_ACTIONS.has(action.value)) &&
      selectedItems.every((item) => actionAllowedForItem(action.value, item))
  );

  const reasons: string[] = [];
  const statuses = Array.from(new Set(selectedItems.map((item) => item.status)));

  if (statuses.length > 1) {
    reasons.push(
      `Selected submissions span multiple workflow stages: ${statuses
        .map((status) => formatStatusLabel(status))
        .join(", ")}.`
    );
  }

  if (
    selectedItems.some(
      (item) =>
        ["AWAITING_CLASSIFICATION", "UNDER_CLASSIFICATION"].includes(item.status) &&
        !item.classification?.reviewType
    )
  ) {
    reasons.push(
      "Some selected submissions do not have a review type yet, so they cannot be marked as classified."
    );
  }

  if (
    selectedItems.some(
      (item) =>
        ["CLASSIFIED", "REVISION_SUBMITTED"].includes(item.status) &&
        (item.reviews?.length ?? 0) < 1
    )
  ) {
    reasons.push(
      "Some selected submissions do not have reviewer assignments yet, so they cannot start review."
    );
  }

  if (
    selectedItems.some(
      (item) =>
        item.classification?.reviewType === "FULL_BOARD" &&
        !item.classification?.panelId
    )
  ) {
    reasons.push(
      "Some full board submissions still need a panel assignment before review can begin."
    );
  }

  if (
    selectedItems.some(
      (item) =>
        ["RECEIVED", "UNDER_COMPLETENESS_CHECK", "RETURNED_FOR_COMPLETION"].includes(
          item.status
        ) && !item.projectCode
    )
  ) {
    reasons.push(
      "Some intake submissions are missing a project code, so they cannot be accepted for classification in bulk."
    );
  }

  if (availableActions.length === 0 && reasons.length === 0) {
    reasons.push("No shared next action is available for the current selection.");
  }

  return { availableActions, reasons };
}

export function AssignReviewersBulkModal({
  open,
  onClose,
  selectedItems,
  onApplied,
}: BulkModalBaseProps) {
  const [candidates, setCandidates] = useState<ReviewerCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [reviewerId, setReviewerId] = useState("");
  const [reviewerQuery, setReviewerQuery] = useState("");
  const [reviewerOpen, setReviewerOpen] = useState(false);
  const [reviewerRole, setReviewerRole] = useState<
    "SCIENTIST" | "LAY" | "INDEPENDENT_CONSULTANT"
  >("SCIENTIST");
  const [dueDate, setDueDate] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkActionResponse | null>(null);
  const reviewerPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setReviewerId("");
    setReviewerQuery("");
    setReviewerOpen(false);
    setReviewerRole("SCIENTIST");
    setDueDate("");
    setIsPrimary(false);
    setError(null);
    setResult(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingCandidates(true);
    fetchReviewerCandidates()
      .then((data) => {
        if (active) {
          setCandidates(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load reviewer candidates");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingCandidates(false);
        }
      });
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!reviewerOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        reviewerPickerRef.current &&
        !reviewerPickerRef.current.contains(event.target as Node)
      ) {
        setReviewerOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [reviewerOpen]);

  const selectedReviewer = useMemo(
    () => candidates.find((candidate) => String(candidate.id) === reviewerId) ?? null,
    [candidates, reviewerId]
  );

  const filteredCandidates = useMemo(() => {
    const query = reviewerQuery.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((candidate) => {
      const haystack = [
        candidate.fullName,
        candidate.email,
        ...candidate.reviewerExpertise,
        ...candidate.roles,
        candidate.isCommonReviewer ? "common reviewer" : "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [candidates, reviewerQuery]);

  const selectionPreviewItems = selectedItems.slice(0, 3);
  const remainingSelectionCount = Math.max(0, selectedItems.length - selectionPreviewItems.length);
  const reviewerFieldError = error === REVIEWER_REQUIRED_MESSAGE;
  const generalError = reviewerFieldError ? null : error;
  const canSubmit = Boolean(reviewerId) && !loadingCandidates && !submitting;

  const handleSelectReviewer = (candidateId: number) => {
    setReviewerId(String(candidateId));
    setReviewerOpen(false);
    setReviewerQuery("");
    if (reviewerFieldError) {
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!reviewerId) {
      setError(REVIEWER_REQUIRED_MESSAGE);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await bulkAssignReviewers({
        submissionIds: selectedItems.map((item) => item.id),
        reviewerId: Number(reviewerId),
        reviewerRole,
        dueDate: dueDate || null,
        isPrimary,
      });
      setResult(response);
      if (response.succeeded > 0) {
        onApplied?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign reviewers");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BulkModalShell
      open={open}
      onClose={onClose}
      title="Assign reviewers"
      description="Apply one reviewer setup across the selected submission batch."
      modalClassName="bulk-modal--assign"
      footer={
        <>
          <button className="ghost-btn" type="button" onClick={onClose}>
            Close
          </button>
          <button className="primary-btn" type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Assigning…" : "Assign reviewers"}
          </button>
        </>
      }
    >
      <section className="bulk-modal-selection bulk-modal-selection-strong">
        <div className="bulk-modal-selection-copy">
          <span className="bulk-section-label">Selected batch</span>
          <strong>{formatSubmissionCountLabel(selectedItems.length)}</strong>
          <span>
            This reviewer setup will be applied to every eligible submission in the current batch.
          </span>
        </div>
        <div className="bulk-selection-tags" aria-label="Selected submissions">
          {selectionPreviewItems.map((item) => (
            <div className="bulk-selection-tag" key={item.id}>
              <strong>{item.projectCode || `Submission #${item.id}`}</strong>
              {selectedItems.length === 1 ? <span>{item.projectTitle}</span> : null}
            </div>
          ))}
          {remainingSelectionCount > 0 ? (
            <div className="bulk-selection-tag bulk-selection-tag-muted">
              <strong>+{remainingSelectionCount} more</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="bulk-modal-section">
        <div className="bulk-section-header">
          <span className="bulk-section-label">Reviewer assignment</span>
          <h4>Choose who will receive this batch</h4>
          <p>Set the reviewer, assign the role, and add an optional review deadline.</p>
        </div>

        <div className="bulk-form-grid bulk-form-grid-2 bulk-form-grid-assign">
          <div
            className={`bulk-form-field bulk-form-field-reviewer${
              reviewerFieldError ? " is-invalid" : ""
            }`}
          >
            <span>Reviewer</span>
            <div className="bulk-reviewer-picker" ref={reviewerPickerRef}>
              <button
                type="button"
                className={`bulk-reviewer-trigger${reviewerOpen ? " is-open" : ""}`}
                onClick={() => {
                  if (loadingCandidates || submitting) return;
                  setReviewerOpen((current) => !current);
                }}
                disabled={loadingCandidates || submitting}
                aria-haspopup="listbox"
                aria-expanded={reviewerOpen}
              >
                <div className="bulk-reviewer-trigger-copy">
                  <strong>
                    {loadingCandidates
                      ? "Loading approved accounts…"
                      : selectedReviewer?.fullName || "Select a reviewer"}
                  </strong>
                  <span>
                    {selectedReviewer
                      ? `${selectedReviewer.email} • ${formatReviewerCandidateMeta(selectedReviewer)}`
                      : "Search approved accounts by name, email, or expertise"}
                  </span>
                </div>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M6 8L10 12L14 8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {reviewerOpen ? (
                <div className="bulk-reviewer-popover">
                  <div className="bulk-reviewer-search-shell">
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path
                        d="M8.75 14.5a5.75 5.75 0 1 1 0-11.5a5.75 5.75 0 0 1 0 11.5Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <path
                        d="m13 13l4 4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                    <input
                      className="bulk-reviewer-search"
                      type="text"
                      value={reviewerQuery}
                      onChange={(event) => setReviewerQuery(event.target.value)}
                      placeholder="Search approved accounts"
                      autoFocus
                    />
                  </div>

                  <div className="bulk-reviewer-results" role="listbox">
                    {filteredCandidates.length === 0 ? (
                      <div className="bulk-reviewer-empty">
                        No reviewers match “{reviewerQuery.trim()}”.
                      </div>
                    ) : (
                      filteredCandidates.map((candidate) => {
                        const isSelected = String(candidate.id) === reviewerId;
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            className={`bulk-reviewer-option${
                              isSelected ? " is-selected" : ""
                            }`}
                            onClick={() => handleSelectReviewer(candidate.id)}
                          >
                            <div className="bulk-reviewer-option-copy">
                              <strong>{candidate.fullName}</strong>
                              <span>{candidate.email}</span>
                              <small>{formatReviewerCandidateMeta(candidate)}</small>
                            </div>
                            {isSelected ? (
                              <span className="bulk-reviewer-selected-mark">Selected</span>
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <small className={reviewerFieldError ? "bulk-field-error" : undefined}>
              {reviewerFieldError
                ? REVIEWER_REQUIRED_MESSAGE
                : "Choose from active approved accounts and apply one reviewer to every eligible submission."}
            </small>
          </div>

          <label className="bulk-form-field">
            <span>Reviewer role</span>
            <div className="bulk-select-shell">
              <select
                className="bulk-select-control"
                value={reviewerRole}
                onChange={(event) =>
                  setReviewerRole(
                    event.target.value as "SCIENTIST" | "LAY" | "INDEPENDENT_CONSULTANT"
                  )
                }
                disabled={submitting}
              >
                <option value="SCIENTIST">Scientist</option>
                <option value="LAY">Lay reviewer</option>
                <option value="INDEPENDENT_CONSULTANT">Independent consultant</option>
              </select>
            </div>
            <small>This role will be applied uniformly across the batch.</small>
          </label>

          <label className="bulk-form-field">
            <span>Review due date</span>
            <input
              className="bulk-input-control"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={submitting}
            />
            <small>Optional. Leave blank if you do not want to set a deadline yet.</small>
          </label>
        </div>

        <div className="bulk-options-card">
          <div className="bulk-options-header">
            <span className="bulk-section-label">Assignment options</span>
            <p>Use this only when the same reviewer should be the lead reviewer for the batch.</p>
          </div>

          <label className="bulk-checkbox-card">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(event) => setIsPrimary(event.target.checked)}
              disabled={submitting}
            />
            <div className="bulk-checkbox-copy">
              <strong>Mark as primary reviewer</strong>
              <span>Assign this reviewer as the primary reviewer for every eligible submission.</span>
            </div>
          </label>
        </div>
      </section>

      {generalError ? <div className="bulk-form-error">{generalError}</div> : null}
      {result ? <BulkResultSummary result={result} /> : null}
    </BulkModalShell>
  );
}

export function SendRemindersBulkModal({
  open,
  onClose,
  selectedItems,
  onApplied,
}: BulkModalBaseProps) {
  const [target, setTarget] = useState<BulkReminderTarget>("PROPONENT");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkActionResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setTarget("PROPONENT");
    setNote("");
    setError(null);
    setResult(null);
  }, [open]);

  const handleSubmit = async () => {
    if (!note.trim()) {
      setError("Enter a reminder note so the log entry is meaningful.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await bulkCreateReminders({
        submissionIds: selectedItems.map((item) => item.id),
        target,
        note: note.trim(),
      });
      setResult(response);
      if (response.succeeded > 0) {
        onApplied?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log reminders");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BulkModalShell
      open={open}
      onClose={onClose}
      title="Send reminders"
      description="Create reminder log entries for the selected submissions without sending email yet."
      footer={
        <>
          <button className="ghost-btn" type="button" onClick={onClose}>
            Close
          </button>
          <button className="primary-btn" type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Logging…" : "Log reminders"}
          </button>
        </>
      }
    >
      <div className="bulk-modal-selection">
        <strong>{selectedItems.length} submissions selected</strong>
        <span>{selectionPreview(selectedItems)}</span>
      </div>

      <div className="bulk-form-grid">
        <label className="bulk-form-field">
          <span>Reminder target</span>
          <select
            className="field-input"
            value={target}
            onChange={(event) =>
              setTarget(event.target.value as BulkReminderTarget)
            }
            disabled={submitting}
          >
            <option value="PROPONENT">Proponent</option>
            <option value="REVIEWER">Reviewer</option>
            <option value="INTERNAL_STAFF">Internal staff</option>
          </select>
        </label>

        <label className="bulk-form-field">
          <span>Reminder note</span>
          <textarea
            className="bulk-form-textarea"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Document what needs to be followed up for this batch."
            rows={4}
            disabled={submitting}
          />
        </label>
      </div>

      {error ? <div className="bulk-form-error">{error}</div> : null}
      {result ? <BulkResultSummary result={result} /> : null}
    </BulkModalShell>
  );
}

export function ChangeStatusBulkModal({
  open,
  onClose,
  selectedItems,
  onApplied,
}: BulkModalBaseProps) {
  const { user } = useAuth();
  const capabilities = useMemo(
    () => getRoleCapabilities(user?.roles ?? []),
    [user?.roles]
  );
  const { availableActions, reasons } = useMemo(
    () =>
      getStatusActionAvailability(selectedItems, {
        includeChairOnlyActions: capabilities.canManageClassification,
      }),
    [selectedItems, capabilities.canManageClassification]
  );
  const [action, setAction] = useState<BulkStatusAction | "">("");
  const [note, setNote] = useState("");
  const [completenessStatus, setCompletenessStatus] = useState<
    ScreeningCompletenessStatus | ""
  >("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkActionResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setAction(availableActions[0]?.value ?? "");
    setNote("");
    setCompletenessStatus("");
    setError(null);
    setResult(null);
  }, [open, availableActions]);

  const selectedActionMeta = BULK_STATUS_ACTION_OPTIONS.find(
    (item) => item.value === action
  );

  const handleSubmit = async () => {
    if (!action) {
      setError("Choose a shared next action for this selection.");
      return;
    }

    if (REASON_REQUIRED_ACTIONS.has(action) && !note.trim()) {
      setError("This action requires a reason.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await bulkRunStatusAction({
        submissionIds: selectedItems.map((item) => item.id),
        action,
        reason: note.trim() || null,
        completenessStatus: completenessStatus || undefined,
        completenessRemarks: note.trim() || null,
      });
      setResult(response);
      if (response.succeeded > 0) {
        onApplied?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run bulk status action");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BulkModalShell
      open={open}
      onClose={onClose}
      title="Change status"
      description="Only shared next-step actions are shown here so the batch stays operationally safe."
      footer={
        <>
          <button className="ghost-btn" type="button" onClick={onClose}>
            Close
          </button>
          <button
            className="primary-btn"
            type="button"
            onClick={handleSubmit}
            disabled={submitting || availableActions.length === 0}
          >
            {submitting ? "Applying…" : "Run status action"}
          </button>
        </>
      }
    >
      <div className="bulk-modal-selection">
        <strong>{selectedItems.length} submissions selected</strong>
        <span>{selectionPreview(selectedItems)}</span>
      </div>

      {availableActions.length === 0 ? (
        <div className="bulk-blocked-state">
          <h4>No shared next action available</h4>
          <ul>
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="bulk-form-grid">
            <label className="bulk-form-field">
              <span>Next action</span>
              <select
                className="field-input"
                value={action}
                onChange={(event) =>
                  setAction(event.target.value as BulkStatusAction)
                }
                disabled={submitting}
              >
                {availableActions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {selectedActionMeta ? (
                <small>{selectedActionMeta.description}</small>
              ) : null}
            </label>

            {action && COMPLETENESS_ACTIONS.has(action) ? (
              <label className="bulk-form-field">
                <span>Completeness status</span>
                <select
                  className="field-input"
                  value={completenessStatus}
                  onChange={(event) =>
                    setCompletenessStatus(
                      event.target.value as ScreeningCompletenessStatus | ""
                    )
                  }
                  disabled={submitting}
                >
                  <option value="">Leave unchanged</option>
                  <option value="COMPLETE">Complete</option>
                  <option value="MINOR_MISSING">Minor missing</option>
                  <option value="MAJOR_MISSING">Major missing</option>
                  <option value="MISSING_SIGNATURES">Missing signatures</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
            ) : null}

            <label className="bulk-form-field">
              <span>
                {action && REASON_REQUIRED_ACTIONS.has(action)
                  ? "Reason"
                  : "Action note"}
              </span>
              <textarea
                className="bulk-form-textarea"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  action && REASON_REQUIRED_ACTIONS.has(action)
                    ? "Explain why this batch should move through this action."
                    : "Optional context for the status change."
                }
                rows={4}
                disabled={submitting}
              />
            </label>
          </div>

          {reasons.length > 0 ? (
            <div className="bulk-form-note">
              {reasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          ) : null}
        </>
      )}

      {error ? <div className="bulk-form-error">{error}</div> : null}
      {result ? <BulkResultSummary result={result} /> : null}
    </BulkModalShell>
  );
}

export function DeleteProtocolsBulkModal({
  open,
  onClose,
  selectedItems,
  onApplied,
}: BulkModalBaseProps) {
  const isColdStart = useColdStartStatus();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkProjectDeleteResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setError(null);
    setResult(null);
  }, [open]);

  const missingProjectItems = useMemo(
    () => selectedItems.filter((item) => !item.projectId),
    [selectedItems]
  );

  const uniqueProjectEntries = useMemo(() => {
    const itemsByProjectId = new Map<number, DecoratedQueueItem>();
    selectedItems.forEach((item) => {
      if (!item.projectId || itemsByProjectId.has(item.projectId)) return;
      itemsByProjectId.set(item.projectId, item);
    });
    return Array.from(itemsByProjectId.entries()).map(([projectId, item]) => ({
      projectId,
      item,
    }));
  }, [selectedItems]);

  const duplicateSelectionCount = Math.max(
    0,
    selectedItems.filter((item) => Boolean(item.projectId)).length - uniqueProjectEntries.length
  );
  const selectionPreviewItems = selectedItems.slice(0, 3);
  const remainingSelectionCount = Math.max(0, selectedItems.length - selectionPreviewItems.length);

  const buildSkippedOnlyResult = () =>
    ({
      requestedCount: missingProjectItems.length,
      succeeded: 0,
      skipped: missingProjectItems.length,
      failed: 0,
      results: missingProjectItems.map((item) => ({
        projectId: null,
        projectCode: item.projectCode ?? null,
        status: "SKIPPED" as const,
        message: "This submission has no linked protocol record, so it was skipped.",
      })),
    }) satisfies BulkProjectDeleteResponse;

  const mergeDeleteResults = (response: BulkProjectDeleteResponse) => {
    if (missingProjectItems.length === 0) {
      return response;
    }

    const skippedResults = missingProjectItems.map((item) => ({
      projectId: null,
      projectCode: item.projectCode ?? null,
      status: "SKIPPED" as const,
      message: "This submission has no linked protocol record, so it was skipped.",
    }));

    return {
      requestedCount: response.requestedCount + missingProjectItems.length,
      succeeded: response.succeeded,
      skipped: response.skipped + missingProjectItems.length,
      failed: response.failed,
      results: [...response.results, ...skippedResults],
    } satisfies BulkProjectDeleteResponse;
  };

  const handleSubmit = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("Reason is required before deleting protocols.");
      return;
    }

    if (uniqueProjectEntries.length === 0 && missingProjectItems.length === 0) {
      setError("Select at least one protocol to delete.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await waitForBackendReady();
      const nextResult =
        uniqueProjectEntries.length > 0
          ? mergeDeleteResults(
              await deleteProjectRecordsBulk({
                projectIds: uniqueProjectEntries.map((entry) => entry.projectId),
                reason: trimmedReason,
              })
            )
          : buildSkippedOnlyResult();
      setResult(nextResult);
      if (nextResult.succeeded > 0) {
        onApplied?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete selected protocols");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BulkModalShell
      open={open}
      onClose={onClose}
      title="Delete selected protocols"
      description="Move selected protocols to Recently Deleted without permanently erasing them."
      modalClassName="bulk-modal--danger"
      footer={
        <>
          <button className="ghost-btn" type="button" onClick={onClose}>
            Close
          </button>
          <button
            className="primary-btn bulk-danger-btn"
            type="button"
            onClick={handleSubmit}
            disabled={submitting || isColdStart}
          >
            {submitting ? "Deleting…" : isColdStart ? "Server waking up..." : "Delete selected"}
          </button>
        </>
      }
    >
      <section className="bulk-modal-selection bulk-modal-selection-strong">
        <div className="bulk-modal-selection-copy">
          <span className="bulk-section-label">Selected batch</span>
          <strong>{formatSubmissionCountLabel(selectedItems.length)}</strong>
          <span>
            Each protocol is deleted once, even if multiple selected submissions point to the
            same protocol record.
          </span>
        </div>
        <div className="bulk-selection-tags" aria-label="Selected submissions">
          {selectionPreviewItems.map((item) => (
            <div className="bulk-selection-tag" key={item.id}>
              <strong>{item.projectCode || `Submission #${item.id}`}</strong>
              {selectedItems.length === 1 ? <span>{item.projectTitle}</span> : null}
            </div>
          ))}
          {remainingSelectionCount > 0 ? (
            <div className="bulk-selection-tag bulk-selection-tag-muted">
              <strong>+{remainingSelectionCount} more</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="bulk-modal-section bulk-delete-intent">
        <div className="bulk-section-header">
          <span className="bulk-section-label">Delete policy</span>
          <h4>Soft delete only</h4>
          <p>
            Deleting moves the selected protocols to Recently Deleted for 30 days. They become
            read-only until restored.
          </p>
        </div>

        <div className="bulk-form-note">
          <p>{uniqueProjectEntries.length} protocol record(s) will be sent to Recently Deleted.</p>
          {missingProjectItems.length > 0 ? (
            <p>
              {missingProjectItems.length} selected submission(s) do not have a linked protocol
              record and will be skipped.
            </p>
          ) : null}
          {duplicateSelectionCount > 0 ? (
            <p>
              {duplicateSelectionCount} duplicate submission selection(s) map to a protocol already
              included in this batch.
            </p>
          ) : null}
        </div>

        <label className="bulk-form-field">
          <span>Reason</span>
          <textarea
            className="bulk-form-textarea"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why these protocols are being deleted."
            rows={4}
            disabled={submitting || isColdStart}
          />
        </label>
      </section>

      {isColdStart ? (
        <div className="bulk-form-error" role="status">
          The server is still waking up. Wait for the banner to clear before deleting.
        </div>
      ) : null}
      {error ? <div className="bulk-form-error">{error}</div> : null}
      {result ? <BulkProjectDeleteSummary result={result} /> : null}
    </BulkModalShell>
  );
}
