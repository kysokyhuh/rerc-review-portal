# QA Test Strategy & High-Priority Test Suite
## RERC Review Portal (RERP) – Internal Workflow System

**Document Version:** 1.0  
**Last Updated:** December 14, 2025  
**Status:** Draft – Ready for team review and refinement

---

## Executive Summary

This document outlines a risk-based QA strategy and comprehensive test suite for the RERC/RERP internal workflow system. It aligns with:

- Your **Prisma schema** (Project, Submission, Classification, Review, SubmissionStatusHistory, ConfigSLA, Committee/Panel membership)
- Your **SOP workflow** (completeness checks → classification → review assignment → decision → status lifecycle → approval window → mail-merge)
- Your **stated quality goals** (data integrity, audit trail correctness, RBAC enforcement, SLA compliance)

**Key testing focus areas (P0 – must not break):**

1. Workflow correctness & lifecycle integrity (illegal transitions blocked)
2. Data integrity & relational constraints (no orphans; correct foreign keys)
3. RBAC + IDOR prevention (users only see/modify data they're authorized for)
4. Audit trail correctness (key changes captured: status, reviewers, decisions)
5. Working-day/SOP compliance (Mon–Fri calculations; SLA thresholds; overdue flags)
6. Mail-merge CSV correctness (Form 6B fields, formatting, row selection)

---

## 1) Test Strategy Overview

### 1.1 Quality Risks (Risk-Based Priorities)

#### **P0 (Must Not Break)**

| Risk | Impact | Test Focus |
|------|--------|-----------|
| Workflow transitions violate SOP (e.g., RECEIVED→APPROVED without review) | High | Transition guards; illegal move rejection |
| Orphan submissions/reviews (no parent project; duplicate classifications) | High | Uniqueness constraints; cascades |
| Reviewers see unauthorized submissions (IDOR) | Critical | Authorization checks; query scoping |
| Status changes not audited | High | StatusHistory completeness; sequence integrity |
| Working-day calculations wrong; SLA overdue flags incorrect | High | Math verification; ConfigSLA lookups |
| CSV export contains wrong data or formatting issues | High | Column mapping; date format; CSV escaping |

#### **P1 (Important)**

| Risk | Impact | Test Focus |
|------|--------|-----------|
| Dashboard/queue counts incorrect | Medium | Aggregation logic; filtering |
| Validation errors unclear; silent failures | Medium | Error messages; input constraints |
| Performance: dashboard queries timeout on large datasets | Medium | Query optimization; indexing |

#### **P2 (Nice to Have Early)**

- Rate limiting; logging; security hardening
- (Deferred until closer to production deployment)

---

### 1.2 Test Levels (What Each Must Prove)

#### **A) Unit Tests (Fast, Deterministic)**

- **Pure functions**: working-day calculations, SLA breach detection, status transition guards, CSV field formatting, date formatting
- **Validators**: Zod/class-validator for DTOs
- **No DB, no network**

#### **B) Integration Tests (DB + Prisma)**

- Prisma model invariants:
  - `Project` → `Submission` → `Classification` → `Review` → `SubmissionStatusHistory` linkage
  - Uniqueness constraints (`projectCode`, `submissionId` on Classification, `(submissionId, reviewerId)` on Review)
  - Foreign key cascades/restrictions
  - Transaction integrity (multi-write operations)
- Seed/factory verification of relational correctness

#### **C) API Tests (Express + supertest)**

- Endpoint contracts, validation errors, HTTP status codes
- RBAC guards (committee scoping, reviewer assignment scoping)
- IDOR prevention (unauthorized users get 403/404)
- Workflow correctness (status transitions, classification rules, review decisions)
- Error handling (clear messages, no stack traces in production responses)

#### **D) E2E Tests (Playwright – UI + API)**

- RA creates project + submission, marks completeness
- Chair classifies and assigns reviewers
- Reviewer submits review decision
- RA generates Form 6B CSV and verifies correctness
- Focus: top 5 workflows only (smoke + regression)

#### **E) UAT (Scripted, Manual or Recorded)**

- Chair/RA run real scenarios against staging dataset (production-like)
- Queues match expectations; appendix/report totals match manual counts
- *Frequency: before release and after major changes*

#### **F) Non-Functional (Minimal but Real)**

- Dashboard endpoint response time < 2s on 5k projects
- CSV export < 5s on 100+ submissions
- Security: RBAC scoping, IDOR proofs, basic rate limiting recommendations

---

### 1.3 Environments & Test Data Strategy

#### **Environments**

- **Local Dev**: local PostgreSQL + seeded DB (`npm run seed`)
- **CI (GitHub Actions)**: ephemeral PostgreSQL in Docker + Prisma migrate
- **Staging** (recommended next): production-like config; role-based accounts; redacted real data

#### **Test Data Fixtures**

Create deterministic **seed packs** (in `src/seed.ts` or separate test factories):

**Happy Path Pack:**
- 1 Project per classification type (EXEMPT, EXPEDITED, FULL_BOARD)
- Submissions in each status (RECEIVED, UNDER_CLASSIFICATION, CLASSIFIED, UNDER_REVIEW, APPROVED, AWAITING_REVISIONS)
- At least 1 complete review cycle per path

**Edge Cases Pack:**
- Missing PI affiliation, long titles, special characters (", ', newlines)
- Withdrawn projects; overdue revisions
- Continuing review due soon; final report due past date

**Volume Pack:**
- N=100 projects (dashboard performance testing)

**Fixture Requirements:**
- Explicit dates for working-day math (e.g., Dec 1–5, 2025 spans a weekend)
- Committee memberships with all role types (CHAIR, MEMBER, RESEARCH_ASSOCIATE, REVIEWER)
- Panel rosters with PanelMember assignments
- ConfigSLA entries for each committee and stage

---

### 1.4 Explicit Requirement Defaults (To Avoid Ambiguity)

Until you confirm otherwise, tests will assume:

1. **Working-day count**: Exclude start date, include end date; count Mon–Fri only (no weekends). Example: Dec 1 (Mon) to Dec 3 (Wed) = 2 working days (Dec 2, Dec 3).

2. **Classification prerequisite**: Submission must be `completenessStatus = COMPLETE` before classification is allowed. This prevents wasted committee time and invalid downstream states.

3. **Status change audit requirements**: Every status change must write both:
   - `SubmissionStatusHistory` record (reason + user)
   - (Future) `AuditLog` record if you add it (field diffs)

4. **CSV null handling**: Never emit `null` or `undefined`. Missing values → empty strings. Dates → consistent format (`YYYY-MM-DD`).

5. **RBAC default policy**:
   - Authorization derived from `CommitteeMember` (committee-scoped actions)
   - Reviewer actions require `Review` assignment
   - Panel access requires `PanelMember` membership
   - Cross-committee access forbidden (403/404)

---

## 2) Comprehensive Test Suite (Spreadsheet Format)

### Legend

| Column | Meaning |
|--------|---------|
| Test ID | Unique identifier (e.g., `PRJ-001`, `REV-005`) |
| Title | One-line description of the test case |
| Precondition | Initial state or seeded data required |
| Steps | What the test does (API call, form submission, etc.) |
| Expected Result | What should happen if the system works correctly |
| Priority | P0 (critical), P1 (important), P2 (nice to have) |
| Type | API, Integration, Security, E2E, Unit |

---

### 2.1 Projects (Project Model)

| Test ID | Title | Precondition | Steps | Expected Result | Priority | Type |
|---------|-------|--------------|-------|-----------------|----------|------|
| PRJ-001 | Create project (valid minimal) | RA is active CommitteeMember | POST `/projects` with `projectCode, title, piName, fundingType, committeeId` | 201; `overallStatus=DRAFT`; `createdById` set; timestamps present | P0 | API |
| PRJ-002 | Reject duplicate projectCode | Project `2025-001` exists | POST `/projects` with same `projectCode` | 409 or 400; no new record created | P0 | API |
| PRJ-003 | Reject invalid fundingType | RA token | POST `/projects` with `fundingType="GRANTZZ"` | 400; enum validation error | P0 | API |
| PRJ-004 | Committee scoping on create | User is RA of committee A only | POST `/projects` with `committeeId=2` (committee B) | 403 or rejected; no record created | P0 | Security |
| PRJ-005 | Validate approval dates (end > start) | Project exists | PATCH `/projects/:id` with `approvalStartDate > approvalEndDate` | 400 or 409; no update | P0 | API |
| PRJ-006 | List projects respects committee scoping | User in committee A; project in committee B | GET `/projects` | Returns only committee A projects; committee B projects not visible | P0 | Security |

---

### 2.2 Submissions (Submission Model)

| Test ID | Title | Precondition | Steps | Expected Result | Priority | Type |
|---------|-------|--------------|-------|-----------------|----------|------|
| SUB-001 | Create initial submission | Project exists | POST `/projects/:id/submissions` with `submissionType=INITIAL, receivedDate` | 201; `status=RECEIVED`; `sequenceNumber=1`; `StatusHistory` created | P0 | API |
| SUB-002 | Reject orphan submission | None | POST `/projects/999/submissions` | 404; no record | P0 | API |
| SUB-003 | Enforce completeness workflow | Submission exists | PATCH `/submissions/:id/completeness` to `MINOR_MISSING` with empty `completenessRemarks` | 400; require remarks | P0 | API |
| SUB-004 | Complete allows empty remarks | Submission exists | PATCH `/submissions/:id/completeness` to `COMPLETE` (remark empty) | 200; stored | P1 | API |
| SUB-005 | Completeness COMPLETE required before classification | `completenessStatus=MAJOR_MISSING` | Try POST `/submissions/:id/classification` | 409; blocked; clear message | P0 | Functional |
| SUB-006 | Status transition RECEIVED→UNDER_COMPLETENESS_CHECK | Submission RECEIVED | POST `/submissions/:id/status` with `newStatus=UNDER_COMPLETENESS_CHECK` | 200; `StatusHistory` appended | P0 | API |
| SUB-007 | Illegal transition RECEIVED→APPROVED blocked | RECEIVED | POST status to `APPROVED` | 409; blocked; message explains prerequisites | P0 | Functional |
| SUB-008 | Revisions due date set when status→AWAITING_REVISIONS | Reviewer decides MINOR_REVISIONS; ConfigSLA exists | System auto-sets `revisionDueDate` (~70 working days from now) | 200; date stored; StatusHistory written | P0 | Integration |

---

### 2.3 Completeness Checks & Classification (Submission + Classification)

| Test ID | Title | Precondition | Steps | Expected Result | Priority | Type |
|---------|-------|--------------|-------|-----------------|----------|------|
| CLS-001 | Create EXPEDITED classification | Submission `completenessStatus=COMPLETE` + `AWAITING_CLASSIFICATION` | POST `/submissions/:id/classification` with `reviewType=EXPEDITED, classificationDate, rationale` | 201; classification created; `classifiedById` set | P0 | API |
| CLS-002 | Create FULL_BOARD requires panelId | COMPLETE submission | POST classification `reviewType=FULL_BOARD` without `panelId` | 400; validation error | P0 | API |
| CLS-003 | Create FULL_BOARD with valid panelId | Panel exists in same committee | POST `reviewType=FULL_BOARD, panelId=valid` | 201; panel linked | P0 | API |
| CLS-004 | Create EXEMPT classification | COMPLETE submission | POST `reviewType=EXEMPT` | 201; classification created | P0 | API |
| CLS-005 | Reject duplicate classification | Classification exists for submission | POST classification again | 409/constraint error; prevented | P0 | Integration |
| CLS-006 | Cross-committee panel rejected | Submission committee A; panel committee B | POST classification with panel from committee B | 400 or 403; no link created | P0 | Security |
| CLS-007 | Only CHAIR (in committee) can classify | RA token (committee member but not CHAIR) | POST classification | 403; forbidden | P0 | Security |
| CLS-008 | Status auto-transitions on classification | (if auto-transition enabled) | Classify submission | `status` becomes `CLASSIFIED` or `UNDER_REVIEW` depending on design | P1 | Functional |

---

### 2.4 Reviews (Review Model + Decisions)

| Test ID | Title | Precondition | Steps | Expected Result | Priority | Type |
|---------|-------|--------------|-------|-----------------|----------|------|
| REV-001 | Assign reviewer (unique constraint) | Submission CLASSIFIED | POST `/submissions/:id/reviews` with `reviewerId` | 201; `Review` created with `reviewerId, submissionId` | P0 | API |
| REV-002 | Reject duplicate assignment | Review exists | Assign same reviewer again | 409/constraint error; prevented | P0 | Integration |
| REV-003 | Assign primary reviewer | RA/Chair token | POST with `isPrimary=true` | 201; `isPrimary` flag set | P1 | API |
| REV-004 | Assigned reviewer can respond | Reviewer A token; assigned to review | PATCH `/reviews/:id` with `decision=APPROVED, remarks` | 200; decision recorded; `respondedAt` set | P0 | API |
| REV-005 | Unassigned reviewer cannot respond (IDOR) | Reviewer B token; not assigned | PATCH `/reviews/:id` | 403 or 404; no access | P0 | Security |
| REV-006 | Reject invalid decision enum | Reviewer token | PATCH with `decision="NOPE"` | 400; enum validation | P0 | API |
| REV-007 | Reviewer decision APPROVED sets respondedAt | Reviewer token | PATCH decision=APPROVED | 200; `respondedAt` not null | P0 | API |
| REV-008 | Reviewer decision MINOR_REVISIONS recorded | Reviewer token | PATCH decision=MINOR_REVISIONS, remarks | 200; decision stored | P0 | API |
| REV-009 | Reviewer decision MAJOR_REVISIONS recorded | Reviewer token | PATCH decision=MAJOR_REVISIONS, remarks | 200; decision stored | P0 | API |
| REV-010 | Reviewer decision DISAPPROVED recorded | Reviewer token | PATCH decision=DISAPPROVED, remarks | 200; decision stored | P0 | API |
| REV-011 | RA/Chair cannot impersonate reviewer decision | RA token; reviewer not RA | PATCH `/reviews/:id` decision (reviewer's review) | 403; forbidden | P0 | Security |
| REV-012 | Final decision aggregation (if multi-reviewer) | 2+ reviews for same submission | Aggregate decision logic (Chair POST to finalize) | Correct aggregation (unanimous APPROVED vs mixed revisions) | P1 | Functional |

---

### 2.5 Status Lifecycle & Transitions (SubmissionStatusHistory)

**Define allowed transitions** (adjust per your SOP):

```
RECEIVED 
  → UNDER_COMPLETENESS_CHECK (RA checks completeness)
    → AWAITING_CLASSIFICATION (ready for chair)
      → UNDER_CLASSIFICATION (chair reviewing)
        → CLASSIFIED (chair done, ready for reviewer assignment)
          → UNDER_REVIEW (reviewers assigned + active)
            → AWAITING_REVISIONS (if decision = MINOR/MAJOR_REVISIONS)
              → REVISION_SUBMITTED (PI resubmits)
                → UNDER_REVIEW (re-review)
            → APPROVED (decision = APPROVED)
            → DISAPPROVED (decision = DISAPPROVED) [terminal]
            → CLOSED [terminal]
          → WITHDRAWN (any point, needs reason) [terminal]
```

| Test ID | Title | Precondition | Steps | Expected Result | Priority | Type |
|---------|-------|--------------|-------|-----------------|----------|------|
| STS-001 | Creation auto-sets status=RECEIVED | New submission | Create submission | `status=RECEIVED`; `StatusHistory` has first entry | P0 | API |
| STS-002 | Move RECEIVED→UNDER_COMPLETENESS_CHECK | RECEIVED | POST `/submissions/:id/status` newStatus=UNDER_COMPLETENESS_CHECK, reason | 200; status updated; `StatusHistory` appended | P0 | API |
| STS-003 | Move UNDER_COMPLETENESS_CHECK→AWAITING_CLASSIFICATION when completeness=COMPLETE | completeness COMPLETE | POST status to AWAITING_CLASSIFICATION | 200 | P0 | Functional |
| STS-004 | Block UNDER_COMPLETENESS_CHECK→AWAITING_CLASSIFICATION when completeness≠COMPLETE | completeness=INCOMPLETE | POST status | 409; require COMPLETE first | P0 | Functional |
| STS-005 | Move AWAITING_CLASSIFICATION→UNDER_CLASSIFICATION | AWAITING_CLASSIFICATION | POST status to UNDER_CLASSIFICATION | 200 | P0 | API |
| STS-006 | Move UNDER_CLASSIFICATION→CLASSIFIED | UNDER_CLASSIFICATION | POST status to CLASSIFIED | 200 | P0 | API |
| STS-007 | Move CLASSIFIED→UNDER_REVIEW only if classification exists | no classification | POST status to UNDER_REVIEW | 409; require classification | P0 | Functional |
| STS-008 | Move CLASSIFIED→UNDER_REVIEW when classification exists | classification exists | POST status to UNDER_REVIEW | 200 | P0 | API |
| STS-009 | Move UNDER_REVIEW→AWAITING_REVISIONS (if decision=MINOR/MAJOR) | decision recorded | RA POST status to AWAITING_REVISIONS | 200; `revisionDueDate` must be set | P0 | Functional |
| STS-010 | Move AWAITING_REVISIONS→REVISION_SUBMITTED | AWAITING_REVISIONS | POST status to REVISION_SUBMITTED | 200 | P0 | API |
| STS-011 | Move REVISION_SUBMITTED→UNDER_REVIEW | REVISION_SUBMITTED | POST status back to UNDER_REVIEW | 200 (loop for re-review) | P1 | API |
| STS-012 | Move to APPROVED only after reviews done | reviews pending | POST status to APPROVED | 409; blocked until decisions complete | P0 | Functional |
| STS-013 | APPROVED requires approval dates | reviews done | POST status APPROVED with valid approval dates | 200; dates stored; project.overallStatus=ACTIVE | P0 | Functional |
| STS-014 | DISAPPROVED is terminal (blocks further transitions) | status=DISAPPROVED | Try POST to any other status | 409; terminal; clear message | P0 | Functional |
| STS-015 | WITHDRAWN is terminal, requires reason | any state | POST status WITHDRAWN without reason | 400; reason required | P0 | API |
| STS-016 | WITHDRAWN succeeds with reason | any non-terminal | POST status WITHDRAWN with reason | 200; terminal; removed from active queues | P0 | Functional |
| STS-017 | CLOSED is terminal | APPROVED | POST status CLOSED | 200 (or via project closure if design varies) | P1 | Functional |
| STS-018 | StatusHistory entries in correct order | multiple transitions | Fetch submission timeline | Events ordered by `effectiveDate`; durations computed | P0 | Integration |
| STS-019 | Each transition writes StatusHistory with old/new + user | any transition | Inspect StatusHistory after change | `oldStatus, newStatus, changedById, reason, effectiveDate` all set | P0 | Integration |

---

### 2.6 Working-Days & SLA (ConfigSLA Model)

| Test ID | Title | Precondition | Steps | Expected Result | Priority | Type |
|---------|-------|--------------|-------|-----------------|----------|------|
| SLA-001 | Working-day calculation: same weekday = 0 | none | workingDays(Mon, Mon) | 0 | P0 | Unit |
| SLA-002 | Working-day calculation: Mon→Tue = 1 | none | workingDays(Mon, Tue) | 1 | P0 | Unit |
| SLA-003 | Working-day calculation: Fri→Mon = 1 (weekend skipped) | Fri Dec 5, Mon Dec 8 | workingDays(Fri, Mon) | 1 | P0 | Unit |
| SLA-004 | Working-day calculation: Mon→next Mon = 5 | Mon Dec 1, Mon Dec 8 | workingDays(Mon, next Mon) | 5 | P0 | Unit |
| SLA-005 | SLA lookup by committee + stage (default) | ConfigSLA(committeeId, stage=CLASSIFICATION, reviewType=null, workingDays=3) | Trigger classification SLA computation | Uses 3 working days | P0 | Integration |
| SLA-006 | SLA lookup prefers reviewType-specific | ConfigSLA(stage=REVIEW, reviewType=null, 10 days) AND (reviewType=EXPEDITED, 5 days) | Trigger EXPEDITED review SLA | Uses 5 working days (specific) | P0 | Integration |
| SLA-007 | Missing SLA gracefully handled | No ConfigSLA for stage | Trigger computation | Returns null; dashboard shows "SLA not configured"; no crash | P0 | Functional |
| SLA-008 | Overdue flag computed correctly | StatusHistory created; ConfigSLA exists; now > (classification date + SLA days) | GET `/dashboard/queues` | Overdue=true; appears in "overdue" filter | P0 | Integration |
| SLA-009 | Days remaining computed correctly | current date = Dec 10; due date = Dec 20 (8 working days ahead) | Fetch queue or submission details | `daysRemaining=8` | P0 | Integration |

---

### 2.7 Mail-Merge CSV Export (Form 6B) (Priority P0)

**Required Fields (Lock This Contract with Stakeholders):**

Based on your schema, Form 6B should include:

```
project_code, project_title, pi_name, pi_affiliation,
review_type, final_decision, final_decision_date,
approval_start_date, approval_end_date,
letter_date, ra_full_name, ra_email
```

(Adjust fields once you confirm the actual template.)

| Test ID | Title | Precondition | Steps | Expected Result | Priority | Type |
|---------|-------|--------------|-------|-----------------|----------|------|
| CSV-001 | Export 6B for approved submission (happy path) | Submission APPROVED; classification + reviews done | GET `/mail-merge/initial-approval/1/csv` | 200; `text/csv`; header row + 1 data row | P0 | API |
| CSV-002 | CSV field mapping matches contract exactly | Known seeded submission | Export 6B; compare to golden file | All fields present, in correct order, correct values | P0 | Integration |
| CSV-003 | Date formatting consistent (YYYY-MM-DD) | Known dates | Export 6B | `approval_start_date, approval_end_date, final_decision_date` all `YYYY-MM-DD` | P0 | Integration |
| CSV-004 | CSV proper escaping (commas, quotes, newlines) | Title contains `,` and `"` | Export 6B | RFC 4180 compliant; loads correctly in Excel | P0 | Integration |
| CSV-005 | Missing optional fields → empty string (not `null`) | `pi_affiliation=null` | Export 6B | Cell is empty, not `"null"` | P0 | API |
| CSV-006 | Reject export if finalDecision=null (not finalized) | finalDecision=null | GET export | 409 or clear error message | P0 | Functional |
| CSV-007 | RBAC: reviewer cannot export | Reviewer token | GET export | 403; forbidden | P0 | Security |
| CSV-008 | RBAC: RA and Chair can export | RA or Chair token | GET export | 200 for both | P0 | Security |
| CSV-009 | Cross-committee scoping | User in committee A; submission committee B | GET export | 404 or 403; no data leaked | P0 | Security |
| CSV-010 | Not found for invalid submissionId | none | GET export with `submissionId=999` | 404 | P0 | API |
| CSV-011 | Export uses current authoritative decision | Multiple decisions/overrides exist | Export 6B | Reflects latest decision and valid approval dates | P0 | Integration |
| CSV-012 | Concurrent CSV downloads do not corrupt data | 2+ export requests simultaneously | Both complete correctly | Both files match expected; no interleaved/partial data | P1 | Integration |

---

## 3) Test Automation Approach

### 3.1 Tools & Framework

| Layer | Tool | Rationale |
|-------|------|-----------|
| Unit | Jest + ts-jest | Fast; TypeScript support; built-in mocking |
| Integration | Jest + Prisma + PostgreSQL (Docker) | Same runner; direct DB access; deterministic seeding |
| API | supertest + Jest | No separate server startup; request/response assertions |
| E2E | Playwright | Cross-browser; visual debugging; CI-friendly |
| Reporting | Jest + HTML reporter | CI artifacts; trend analysis |

### 3.2 Project Structure (Recommended)

```
rerc-system/
├── src/
│   ├── server.ts
│   ├── prisma.ts
│   ├── seed.ts
│   └── lib/
│       ├── workingDays.ts
│       ├── statusTransitions.ts
│       └── csvFormatter.ts
├── tests/
│   ├── unit/
│   │   ├── workingDays.test.ts
│   │   ├── statusTransitions.test.ts
│   │   └── csvFormatter.test.ts
│   ├── integration/
│   │   ├── projectIntegrity.test.ts
│   │   ├── classificationIntegrity.test.ts
│   │   ├── reviewIntegrity.test.ts
│   │   └── statusHistoryIntegrity.test.ts
│   ├── api/
│   │   ├── projects.test.ts
│   │   ├── submissions.test.ts
│   │   ├── classifications.test.ts
│   │   ├── reviews.test.ts
│   │   ├── security.idor.test.ts
│   │   └── export6b.test.ts
│   ├── e2e/
│   │   ├── workflows.spec.ts
│   │   └── mailMerge.spec.ts
│   ├── fixtures/
│   │   ├── happyPath.seed.ts
│   │   ├── edgeCases.seed.ts
│   │   └── goldenFiles/
│   │       └── 6b_submission_123.csv
│   └── helpers/
│       ├── auth.ts (token minting)
│       ├── prismaCleanup.ts
│       └── factories.ts (entity creation helpers)
├── jest.config.js
├── jest.setup.ts
└── package.json
```

### 3.3 CI Pipeline (GitHub Actions Concept)

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:api
      - run: npm run test:e2e --if-present
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-reports
          path: coverage/
```

---

## 4) Definition of Done (Release Gates)

Before any version goes to staging/production:

- [ ] All **P0 API regression tests** pass (workflow + RBAC + export)
- [ ] All **P0 integration tests** pass (schema invariants, constraints)
- [ ] All **P0 unit tests** pass (working-day math, status guards, CSV formatting)
- [ ] No open **P0 defects**
- [ ] Audit logs verified for key state changes (status, reviewer assignments, decisions)
- [ ] CSV output validated against golden file for Form 6B
- [ ] IDOR checks pass (reviewer IDOR, cross-committee scoping)
- [ ] Working-day calculations verified for SLA compliance
- [ ] Smoke E2E passes (happy path: create project → classify → assign → review → finalize → export)

---

## 5) Next Steps

### Immediate (This Week)

1. **Review & Confirm** this QA plan with your team (especially workflow transitions and CSV field mappings)
2. **Refine Transition Guards** in your `src/server.ts` or new `lib/statusTransitions.ts` file
3. **Create Test Fixtures** (`tests/fixtures/happyPath.seed.ts`, `edgeCases.seed.ts`)

### Short-Term (Next 1–2 Weeks)

1. **Implement Unit Tests** (Jest) for working-day calculations and status transition logic
2. **Implement Integration Tests** (Prisma + Jest) for schema constraints and relational integrity
3. **Implement API Tests** (supertest) for RBAC, IDOR, and workflow correctness
4. **Golden File for Form 6B CSV** – lock field mapping and create sample export

### Medium-Term (Weeks 3–4)

1. **E2E Smoke Tests** (Playwright) for top 5 workflows
2. **CI Pipeline** setup (GitHub Actions) with automated test runs
3. **Performance Baseline** (response times, query optimization)

### Before Production Deployment

1. **UAT** with Chair, RA, and Reviewer roles (real SOP scenarios)
2. **Security Review** (RBAC, IDOR, rate limiting)
3. **Load Testing** (5k+ projects; concurrent dashboard users)

---

## 6) Assumptions & Constraints

This plan assumes:

- **Auth mechanism**: Header-based token with role claims (e.g., `Authorization: Bearer <token>` with decoded role/committeeId)
- **Status transitions**: Follow the SOP-aligned state machine defined in Section 2.5
- **Working-day rule**: Exclude start, include end; Mon–Fri only
- **CSV format**: UTF-8, RFC 4180 compliant, one row per submission export event
- **Completeness as workflow prerequisite**: Cannot classify before completeness check is complete
- **RBAC scoping**: Committee-based for RA/Chair; reviewer-assignment-based for reviewers

**If any assumption differs from your actual SOP, please clarify and we'll update test expectations accordingly.**

---

## Appendix A: Working-Day Calculation Examples

```
Dates (Dec 2025):
Sun 30  Mon 1  Tue 2  Wed 3  Thu 4  Fri 5
Sun 7   Mon 8  Tue 9  Wed 10 Thu 11 Fri 12
Sun 14  Mon 15 Tue 16 Wed 17 Thu 18 Fri 19
Sun 21  Mon 22 Tue 23 Wed 24 Thu 25 Fri 26

Rule: exclude start date, include end date; count Mon–Fri only

Mon Dec 1 → Wed Dec 3  →  2 working days (Dec 2, Dec 3)
Mon Dec 1 → Fri Dec 5  →  4 working days (Dec 2, 3, 4, 5)
Fri Dec 5 → Mon Dec 8  →  1 working day (Dec 8)  [weekend skipped]
Mon Dec 8 → Mon Dec 15 →  5 working days (Dec 9, 10, 11, 12, 15)
```

---

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **SOP** | Standard Operating Procedure (the workflow defined in your meeting minutes) |
| **IDOR** | Insecure Direct Object Reference (accessing data without authorization) |
| **RBAC** | Role-Based Access Control (committee/role-scoped permissions) |
| **StatusHistory** | Audit log for submission status transitions |
| **ConfigSLA** | Configuration table storing working-day thresholds per committee/stage |
| **Golden File** | Reference output (e.g., expected CSV) to compare against test results |
| **Smoke Test** | Quick sanity check (happy path only) |
| **Regression Test** | Tests to catch breaking changes in existing functionality |
| **P0/P1/P2** | Priority levels (P0 = critical, P1 = important, P2 = nice to have) |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 14, 2025 | Copilot | Initial draft aligned to Prisma schema + existing implementation |

**Next Review Date:** December 21, 2025  
**Owner:** QA Lead / Test Automation Engineer  
**Status:** Ready for team review

