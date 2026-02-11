# Reports Discovery Notes

## Existing fields used

- College / service unit source:
  - Existing: `Project.piAffiliation` (used as fallback)
  - Added: `Project.collegeOrUnit` (preferred reporting field)

- Proponent type:
  - Existing: no normalized enum field found for Undergrad/Grad/Faculty
  - Added: `Project.proponentCategory` enum (`UNDERGRAD`, `GRAD`, `FACULTY`, `OTHER`)

- Review classification:
  - Existing: `Classification.reviewType` (`EXEMPT`, `EXPEDITED`, `FULL_BOARD`)

- Withdrawn:
  - Existing: `Submission.status = WITHDRAWN`
  - History source: `SubmissionStatusHistory.newStatus = WITHDRAWN`

## Proposal definition

- "Proposal received" is counted as initial submissions only:
  - `Submission.sequenceNumber = 1`
  - filtered by `Submission.receivedDate` within selected academic-year/term range

## Date sources used for averages

- Submission received date:
  - `Submission.receivedDate`

- Review results notification date:
  - Primary proxy from `SubmissionStatusHistory.effectiveDate` on first outcome status after review:
    - `AWAITING_REVISIONS`, `CLOSED`, or `WITHDRAWN`
  - Fallback: `Submission.finalDecisionDate`

- Resubmission timing:
  - Notification proxy: each `AWAITING_REVISIONS` transition timestamp
  - Resubmission date: next `REVISION_SUBMITTED` timestamp
  - Multiple cycles are paired in chronological order

- Ethics clearance date:
  - Primary: `Project.approvalStartDate`
  - Fallbacks:
    1. `Submission.finalDecisionDate` when `finalDecision = APPROVED`
    2. first `CLOSED` status-history timestamp

## Working days rule

- Do not use stored `daysFromPrevious` values.
- All durations use `computeWorkingDaysBetween(start, end, holidays)` with:
  - weekends excluded
  - `Holiday.date` excluded
