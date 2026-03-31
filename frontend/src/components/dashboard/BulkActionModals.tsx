import React, { useEffect, useMemo, useState } from "react";
import {
  bulkAssignReviewers,
  bulkCreateReminders,
  bulkRunStatusAction,
  fetchReviewerCandidates,
} from "@/services/api";
import type {
  BulkActionResponse,
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
      <div className="bulk-modal" onClick={(event) => event.stopPropagation()}>
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

function getStatusActionAvailability(selectedItems: DecoratedQueueItem[]) {
  const availableActions = BULK_STATUS_ACTION_OPTIONS.filter((action) =>
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
  const [reviewerRole, setReviewerRole] = useState<
    "SCIENTIST" | "LAY" | "INDEPENDENT_CONSULTANT"
  >("SCIENTIST");
  const [dueDate, setDueDate] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkActionResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setReviewerId("");
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

  const handleSubmit = async () => {
    if (!reviewerId) {
      setError("Select a reviewer before running the assignment.");
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
      description="Apply one reviewer configuration to every selected submission in this batch."
      footer={
        <>
          <button className="ghost-btn" type="button" onClick={onClose}>
            Close
          </button>
          <button className="primary-btn" type="button" onClick={handleSubmit} disabled={submitting || loadingCandidates}>
            {submitting ? "Assigning…" : "Run bulk assignment"}
          </button>
        </>
      }
    >
      <div className="bulk-modal-selection">
        <strong>{selectedItems.length} submissions selected</strong>
        <span>{selectionPreview(selectedItems)}</span>
      </div>

      <div className="bulk-form-grid bulk-form-grid-2">
        <label className="bulk-form-field">
          <span>Reviewer</span>
          <select
            className="field-input"
            value={reviewerId}
            onChange={(event) => setReviewerId(event.target.value)}
            disabled={loadingCandidates || submitting}
          >
            <option value="">Select reviewer</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.fullName} · {candidate.email}
              </option>
            ))}
          </select>
        </label>

        <label className="bulk-form-field">
          <span>Reviewer role</span>
          <select
            className="field-input"
            value={reviewerRole}
            onChange={(event) =>
              setReviewerRole(
                event.target.value as "SCIENTIST" | "LAY" | "INDEPENDENT_CONSULTANT"
              )
            }
            disabled={submitting}
          >
            <option value="SCIENTIST">Scientist</option>
            <option value="LAY">Lay</option>
            <option value="INDEPENDENT_CONSULTANT">Independent consultant</option>
          </select>
        </label>

        <label className="bulk-form-field">
          <span>Due date</span>
          <input
            className="field-input"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            disabled={submitting}
          />
        </label>

        <label className="bulk-checkbox-field">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(event) => setIsPrimary(event.target.checked)}
            disabled={submitting}
          />
          <span>Mark this reviewer as primary for the batch</span>
        </label>
      </div>

      {error ? <div className="bulk-form-error">{error}</div> : null}
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
  const { availableActions, reasons } = useMemo(
    () => getStatusActionAvailability(selectedItems),
    [selectedItems]
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
