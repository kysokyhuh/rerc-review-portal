# Reports Date Event Mapping

This project computes report durations from source timestamps, not from stored `days` fields.

## Event definitions

- `review results notification date`
  - Primary source: first `SubmissionStatusHistory.effectiveDate` where status moves to one of:
    - `AWAITING_REVISIONS`
    - `CLOSED`
    - `WITHDRAWN`
  - Constraint: event must be on/after the first `UNDER_REVIEW` transition when present.
  - Fallback: `Submission.finalDecisionDate`.

- `notification email date` for resubmission timing
  - Proxy: each `SubmissionStatusHistory` transition to `AWAITING_REVISIONS`.

- `resubmission date`
  - Source: next `SubmissionStatusHistory` transition to `REVISION_SUBMITTED` after a pending `AWAITING_REVISIONS`.
  - Multiple revision cycles are paired in chronological order.

- `clearance date`
  - Primary source: `Project.approvalStartDate`.
  - Fallbacks:
    1. `Submission.finalDecisionDate` when `Submission.finalDecision = APPROVED`
    2. First `SubmissionStatusHistory` transition to `CLOSED`.

## Working day computation

All report durations use `computeWorkingDaysBetween(start, end, holidays)` from `backend/src/utils/workingDays.ts`.

- Counts weekdays in `[start, end)`
- Excludes Saturday/Sunday
- Excludes configured holidays from `Holiday.date`
