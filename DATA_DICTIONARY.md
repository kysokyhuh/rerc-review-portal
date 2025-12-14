# RERC Review Portal – Data Model Dictionary & ERD

**Document Version:** 1.0  
**Last Updated:** December 14, 2025  
**Status:** Ready for stakeholder review

---

## Executive Summary

This document defines the complete data model for the RERC Review Portal (RERP), mapping database entities to the SOP workflow described in the meeting minutes. All entities are persisted in PostgreSQL via Prisma ORM.

**Key sections:**

1. Entity Relationship Diagram (ERD)
2. Data Dictionary (field-by-field definitions)
3. Google Sheets → Database mapping
4. Enum definitions (workflow states, roles, etc.)

---

## 1) Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       RERC REVIEW PORTAL DATA MODEL                         │
└─────────────────────────────────────────────────────────────────────────────┘

                                ┌──────────────┐
                                │   User       │
                                ├──────────────┤
                                │ id (PK)      │
                                │ email (U)    │
                                │ fullName     │
                                │ isActive     │
                                │ createdAt    │
                                └──────────────┘
                                      △
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
         ┌──────────▼──────────┐      │      ┌──────────▼──────────┐
         │ CommitteeMember     │      │      │ Review              │
         ├─────────────────────┤      │      ├─────────────────────┤
         │ id (PK)             │      │      │ id (PK)             │
         │ committeeId (FK)    │      │      │ submissionId (FK)   │
         │ userId (FK) ────────┼──────┘      │ reviewerId (FK) ────┼──┐
         │ role                │             │ isPrimary           │  │
         │ isPrimary           │             │ decision            │  │
         │ isActive            │             │ remarks             │  │
         │ (U: cid, uid, role) │             │ assignedAt          │  │
         └─────────────────────┘             │ respondedAt         │  │
                    △                        │ (U: subId, revId)   │  │
                    │                        └─────────────────────┘  │
                    │                                                  │
    ┌───────────────┴────────────────┐                               │
    │                                │                               │
┌───▼────────────┐       ┌───────────▼──┐                            │
│ Committee      │       │ Panel         │                            │
├────────────────┤       ├───────────────┤                            │
│ id (PK)        │◄──────│ committeeId   │                            │
│ name           │       │ name          │                            │
│ code (U)       │       │ code          │                            │
│ description    │       │ isActive      │                            │
│ isActive       │       └───────────────┘                            │
│ createdAt      │            △                                       │
└────┬───────────┘            │                                       │
     │                    ┌────┴────────────┐                         │
     │                    │ PanelMember     │                         │
     │                    ├─────────────────┤                         │
     │                    │ id (PK)         │                         │
     │                    │ panelId (FK)    │                         │
     │                    │ userId (FK) ────┼─────────────────────────┘
     │                    │ role            │
     │                    │ isActive        │
     │                    │ (U: panelId,uid)│
     │                    └─────────────────┘
     │
     │
     └────────────┬───────────────────────────────────────┐
                  │                                       │
         ┌────────▼──────────┐             ┌──────────────▼─────────┐
         │ Project           │             │ ConfigSLA              │
         ├───────────────────┤             ├────────────────────────┤
         │ id (PK)           │             │ id (PK)                │
         │ projectCode (U)   │             │ committeeId (FK)       │
         │ title             │             │ reviewType (optional)  │
         │ piName            │             │ stage                  │
         │ piAffiliation     │             │ workingDays            │
         │ fundingType       │             │ description            │
         │ committeeId (FK)  │             │ isActive               │
         │ overallStatus     │             └────────────────────────┘
         │ approvalStartDate │
         │ approvalEndDate   │
         │ createdById (FK)  │
         │ isArchived        │
         │ createdAt         │
         └────────┬──────────┘
                  │
         ┌────────▼──────────────────┐
         │ Submission                 │
         ├────────────────────────────┤
         │ id (PK)                    │
         │ projectId (FK)             │
         │ submissionType             │
         │ sequenceNumber             │
         │ receivedDate               │
         │ documentLink               │
         │ completenessStatus         │
         │ completenessRemarks        │
         │ status                     │
         │ revisionDueDate            │
         │ continuingReviewDueDate    │
         │ finalReportDueDate         │
         │ finalDecision              │
         │ finalDecisionDate          │
         │ createdById (FK)           │
         │ (I: projectId, type)       │
         └────────┬────────────────────┘
                  │
         ┌────────┴──────────────────┐
         │                           │
   ┌─────▼──────────┐      ┌────────▼──────────────┐
   │ Classification │      │ SubmissionStatusHistory│
   ├────────────────┤      ├───────────────────────┤
   │ id (PK)        │      │ id (PK)               │
   │ submissionId   │      │ submissionId (FK)     │
   │  (U, FK)       │      │ oldStatus             │
   │ reviewType     │      │ newStatus             │
   │ classifiDate   │      │ effectiveDate         │
   │ panelId (FK)   │      │ reason                │
   │ rationale      │      │ changedById (FK)      │
   │ classifiedById │      │ createdAt             │
   │ (FK)           │      └───────────────────────┘
   │ createdAt      │
   └────────────────┘
```

---

## 2) Data Dictionary

### 2.1 User

**Purpose:** Stores all system users (RAs, Chairs, Reviewers, Admins)

| Field     | Type     | Nullable | Unique   | Description                | Example              | SOP Note                             |
| --------- | -------- | -------- | -------- | -------------------------- | -------------------- | ------------------------------------ |
| id        | Integer  | No       | Yes (PK) | Auto-increment primary key | 1                    | Unique identifier                    |
| email     | String   | No       | Yes      | User email address         | ra@example.com       | Used for login; must be unique       |
| fullName  | String   | No       | No       | Full name of user          | Dr. Jane Smith       | Display name in reports              |
| isActive  | Boolean  | No       | No       | User active status         | true                 | Soft-delete; inactive users archived |
| createdAt | DateTime | No       | No       | Timestamp of creation      | 2025-12-01T10:00:00Z | Audit trail                          |
| updatedAt | DateTime | No       | No       | Timestamp of last update   | 2025-12-14T15:30:00Z | Audit trail                          |

**Relations:**

- Has many `CommitteeMember` (committee membership roles)
- Created many `Project` records
- Created many `Submission` records
- Created many `Classification` records
- Assigned many `Review` records
- Changed many `SubmissionStatusHistory` records
- Member of many `PanelMember` records

---

### 2.2 Committee

**Purpose:** Top-level organizational unit (e.g., RERC-HUMAN, RERC-ANIMAL)

| Field       | Type     | Nullable | Unique   | Description                | Example                                               | SOP Note                              |
| ----------- | -------- | -------- | -------- | -------------------------- | ----------------------------------------------------- | ------------------------------------- |
| id          | Integer  | No       | Yes (PK) | Auto-increment primary key | 1                                                     | Unique identifier                     |
| name        | String   | No       | No       | Committee full name        | Research Ethics Review Committee – Human Participants | Formal name                           |
| code        | String   | No       | Yes      | Committee short code       | RERC-HUMAN                                            | Used in project codes; must be unique |
| description | String   | Yes      | No       | Committee description      | Reviews protocols for human subject research          | Optional notes                        |
| isActive    | Boolean  | No       | No       | Committee active status    | true                                                  | Soft-delete for archive               |
| createdAt   | DateTime | No       | No       | Timestamp of creation      | 2025-01-01T08:00:00Z                                  | Audit trail                           |

**Relations:**

- Has many `Panel` (sub-groups within committee)
- Has many `Project` (projects under committee jurisdiction)
- Has many `CommitteeMember` (membership roster)
- Has many `ConfigSLA` (SLA rules)

**SOP Notes:**

- Each project is assigned to exactly one committee
- Committee determines applicable SLA thresholds, panel rosters, and approval authority

---

### 2.3 CommitteeMember

**Purpose:** Tracks committee membership and roles (CHAIR, RA, MEMBER, etc.)

| Field       | Type          | Nullable | Unique      | Description                | Example              | SOP Note                                                                       |
| ----------- | ------------- | -------- | ----------- | -------------------------- | -------------------- | ------------------------------------------------------------------------------ |
| id          | Integer       | No       | Yes (PK)    | Auto-increment primary key | 1                    | Unique identifier                                                              |
| committeeId | Integer       | No       | Part of (U) | Foreign key to Committee   | 1                    | Committee assignment                                                           |
| userId      | Integer       | No       | Part of (U) | Foreign key to User        | 42                   | User assignment                                                                |
| role        | RoleType enum | No       | Part of (U) | User role in committee     | RESEARCH_ASSOCIATE   | One of: CHAIR, MEMBER, RESEARCH_ASSOCIATE, RESEARCH_ASSISTANT, REVIEWER, ADMIN |
| isPrimary   | Boolean       | No       | No          | Primary role flag          | true                 | e.g., primary RA, primary chair                                                |
| isActive    | Boolean       | No       | No          | Membership active status   | true                 | Soft-delete; former members marked inactive                                    |
| createdAt   | DateTime      | No       | No          | Timestamp of creation      | 2025-01-15T09:00:00Z | Audit trail                                                                    |

**Constraints:**

- Unique on `(committeeId, userId, role)` – prevents duplicate role assignments

**SOP Notes:**

- RBAC is committee-scoped: a user's role/permissions apply within a specific committee
- Primary flag identifies the lead RA and lead Chair for notifications, default assignments
- Each committee has at least one CHAIR and one RESEARCH_ASSOCIATE

---

### 2.4 Panel

**Purpose:** Sub-group within a committee for full-board review assignments

| Field       | Type    | Nullable | Unique   | Description                | Example | SOP Note                    |
| ----------- | ------- | -------- | -------- | -------------------------- | ------- | --------------------------- |
| id          | Integer | No       | Yes (PK) | Auto-increment primary key | 1       | Unique identifier           |
| committeeId | Integer | No       | No (FK)  | Foreign key to Committee   | 1       | Panel belongs to committee  |
| name        | String  | No       | No       | Panel name                 | Panel 1 | Display name for roster     |
| code        | String  | Yes      | No       | Panel short code           | P1      | Optional internal reference |
| isActive    | Boolean | No       | No       | Panel active status        | true    | Soft-delete                 |

**Relations:**

- Belongs to `Committee`
- Has many `PanelMember` (roster)
- Assigned to many `Classification` (FULL_BOARD reviews)

**SOP Notes:**

- Only used for FULL_BOARD (full committee) review classifications
- Panel members are required for panel-based reviews
- Allows dynamic panel composition (e.g., different panels for different terms)

---

### 2.5 PanelMember

**Purpose:** Roster of users assigned to a specific panel

| Field     | Type                 | Nullable | Unique      | Description                | Example              | SOP Note                           |
| --------- | -------------------- | -------- | ----------- | -------------------------- | -------------------- | ---------------------------------- |
| id        | Integer              | No       | Yes (PK)    | Auto-increment primary key | 1                    | Unique identifier                  |
| panelId   | Integer              | No       | Part of (U) | Foreign key to Panel       | 1                    | Panel assignment                   |
| userId    | Integer              | No       | Part of (U) | Foreign key to User        | 42                   | User assignment                    |
| role      | PanelMemberRole enum | No       | No          | Role within panel          | CHAIR                | One of: CHAIR, MEMBER, SECRETARIAT |
| isActive  | Boolean              | No       | No          | Membership active status   | true                 | Soft-delete                        |
| createdAt | DateTime             | No       | No          | Timestamp of creation      | 2025-02-01T10:00:00Z | Audit trail                        |

**Constraints:**

- Unique on `(panelId, userId)` – one assignment per user per panel

**SOP Notes:**

- Panel chair leads deliberation; members provide votes/input; secretariat handles admin
- All panel members must be accessible for FULL_BOARD review assignments

---

### 2.6 Project

**Purpose:** Top-level protocol or research project being reviewed

| Field                 | Type               | Nullable | Unique   | Description                              | Example                      | SOP Note                                                 |
| --------------------- | ------------------ | -------- | -------- | ---------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| id                    | Integer            | No       | Yes (PK) | Auto-increment primary key               | 1                            | Unique identifier                                        |
| projectCode           | String             | No       | Yes      | Unique project identifier                | 2025-001                     | Format: YYYY-NNN or per your convention; used in letters |
| title                 | String             | No       | No       | Protocol title                           | Pilot Study on RERC Workflow | Display in all reports                                   |
| piName                | String             | No       | No       | Principal investigator name              | Dr. Jane Smith               | Used in approval letters                                 |
| piAffiliation         | String             | Yes      | No       | PI affiliation (department, institution) | College of Computer Studies  | Optional; used in correspondence                         |
| fundingType           | FundingType enum   | No       | No       | Funding source type                      | INTERNAL                     | One of: INTERNAL, EXTERNAL, SELF_FUNDED, NO_FUNDING      |
| initialSubmissionDate | DateTime           | Yes      | No       | Date of initial submission received      | 2025-12-11T14:30:00Z         | Optional; may differ from submission receivedDate        |
| committeeId           | Integer            | No       | No (FK)  | Foreign key to Committee                 | 1                            | Committee jurisdiction                                   |
| overallStatus         | ProjectStatus enum | No       | No       | Project lifecycle status                 | ACTIVE                       | One of: DRAFT, ACTIVE, INACTIVE, WITHDRAWN, CLOSED       |
| approvalStartDate     | DateTime           | Yes      | No       | Approval validity start date             | 2025-12-15T00:00:00Z         | When does approval period begin?                         |
| approvalEndDate       | DateTime           | Yes      | No       | Approval validity end date               | 2026-12-14T23:59:59Z         | When does approval expire? Must be > startDate           |
| isArchived            | Boolean            | No       | No       | Project archive flag                     | false                        | Soft-delete                                              |
| createdAt             | DateTime           | No       | No       | Timestamp of creation                    | 2025-12-01T08:00:00Z         | Audit trail                                              |
| updatedAt             | DateTime           | No       | No       | Timestamp of last update                 | 2025-12-14T15:30:00Z         | Audit trail                                              |
| createdById           | Integer            | Yes      | No (FK)  | User who created the project             | 42                           | Tracks who encoded the project                           |

**Relations:**

- Belongs to `Committee`
- Created by `User`
- Has many `Submission` records (initial + follow-ups)

**SOP Notes:**

- ProjectCode is the primary external identifier (printed on letters)
- overallStatus tracks project lifecycle (DRAFT while being encoded, ACTIVE once approved, etc.)
- approvalStartDate/approvalEndDate define the approval validity period (e.g., "approved for one year")
- Only one active/approved submission per project at a time (per SOP)

---

### 2.7 Submission

**Purpose:** Represents a specific submission/amendment/continuing review instance for a project

| Field                   | Type                    | Nullable | Unique      | Description                               | Example                           | SOP Note                                                                                                    |
| ----------------------- | ----------------------- | -------- | ----------- | ----------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| id                      | Integer                 | No       | Yes (PK)    | Auto-increment primary key                | 1                                 | Unique identifier                                                                                           |
| projectId               | Integer                 | No       | No (FK)     | Foreign key to Project                    | 1                                 | Which project is this submission for?                                                                       |
| submissionType          | SubmissionType enum     | No       | Part of (I) | Type of submission                        | INITIAL                           | One of: INITIAL, AMENDMENT, CONTINUING_REVIEW, FINAL_REPORT, WITHDRAWAL, SAFETY_REPORT, PROTOCOL_DEVIATION  |
| sequenceNumber          | Integer                 | No       | Part of (I) | Sequence within type                      | 1                                 | 1 for initial, higher for follow-ups                                                                        |
| receivedDate            | DateTime                | No       | No          | Date submission received by committee     | 2025-12-11T14:30:00Z              | Used to calculate SLA deadlines                                                                             |
| documentLink            | String                  | Yes      | No          | External link to submission documents     | https://drive.google.com/...      | Optional; e.g., Google Drive folder URL                                                                     |
| completenessStatus      | CompletenessStatus enum | No       | No          | Completeness check result                 | COMPLETE                          | One of: COMPLETE, MINOR_MISSING, MAJOR_MISSING, MISSING_SIGNATURES, OTHER                                   |
| completenessRemarks     | String                  | Yes      | No          | RA notes on completeness check            | "Missing IRB signature on page 2" | Required if completenessStatus ≠ COMPLETE                                                                   |
| status                  | SubmissionStatus enum   | No       | No          | Current submission workflow status        | UNDER_REVIEW                      | Tracks progress: RECEIVED → CLASSIFIED → UNDER_REVIEW → APPROVED/AWAITING_REVISIONS → ...                   |
| revisionDueDate         | DateTime                | Yes      | No          | Deadline for PI revisions                 | 2026-01-20T23:59:59Z              | Set when decision = MINOR/MAJOR_REVISIONS; computed from ConfigSLA.REVISION_RESPONSE (~70 working days)     |
| continuingReviewDueDate | DateTime                | Yes      | No          | Due date for continuing review submission | 2026-12-01T00:00:00Z              | Set for approved projects; annual renewal deadline                                                          |
| finalReportDueDate      | DateTime                | Yes      | No          | Due date for final report                 | 2026-12-31T23:59:59Z              | Set when project nearing closure                                                                            |
| finalDecision           | ReviewDecision enum     | Yes      | No          | Final committee decision                  | APPROVED                          | One of: APPROVED, MINOR_REVISIONS, MAJOR_REVISIONS, DISAPPROVED, INFO_ONLY; set after all reviews collected |
| finalDecisionDate       | DateTime                | Yes      | No          | Date final decision made                  | 2025-12-15T10:00:00Z              | Set when finalDecision is recorded                                                                          |
| createdAt               | DateTime                | No       | No          | Timestamp of creation                     | 2025-12-11T14:30:00Z              | Audit trail                                                                                                 |
| updatedAt               | DateTime                | No       | No          | Timestamp of last update                  | 2025-12-14T15:30:00Z              | Audit trail                                                                                                 |
| createdById             | Integer                 | Yes      | No (FK)     | User who created the submission           | 42                                | Tracks who encoded the submission (usually RA)                                                              |

**Index:**

- `(projectId, submissionType)` – fast lookup of specific submission types for a project

**SOP Notes:**

- `status` is the primary workflow state (RECEIVED → UNDER_CLASSIFICATION → UNDER_REVIEW → APPROVED/AWAITING_REVISIONS → CLOSED)
- `completenessStatus` gates the classification workflow (must be COMPLETE to proceed)
- `revisionDueDate` is auto-calculated from ConfigSLA when decision = MINOR/MAJOR_REVISIONS
- `finalDecision` and `finalDecisionDate` populated after all reviews are in and committee makes final call
- One submission per submissionType/sequenceNumber per project

---

### 2.8 Classification

**Purpose:** Assigns review type (EXEMPT/EXPEDITED/FULL_BOARD) to a submission

| Field              | Type            | Nullable | Unique   | Description                          | Example                                        | SOP Note                                                       |
| ------------------ | --------------- | -------- | -------- | ------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------- |
| id                 | Integer         | No       | Yes (PK) | Auto-increment primary key           | 1                                              | Unique identifier                                              |
| submissionId       | Integer         | No       | Yes (FK) | Foreign key to Submission            | 1                                              | Exactly one classification per submission                      |
| reviewType         | ReviewType enum | No       | No       | Classification type                  | EXPEDITED                                      | One of: EXEMPT, EXPEDITED, FULL_BOARD                          |
| classificationDate | DateTime        | No       | No       | Date of classification               | 2025-12-12T09:00:00Z                           | Used to compute review SLA deadline                            |
| panelId            | Integer         | Yes      | No (FK)  | Panel assigned (for FULL_BOARD only) | 1                                              | Required if reviewType = FULL_BOARD; null for EXEMPT/EXPEDITED |
| rationale          | String          | Yes      | No       | Chair notes on classification reason | "Minimal risk study; meets expedited criteria" | Optional documentation                                         |
| classifiedById     | Integer         | Yes      | No (FK)  | User who performed classification    | 42                                             | Tracks which chair classified                                  |
| createdAt          | DateTime        | No       | No       | Timestamp of creation                | 2025-12-12T09:00:00Z                           | Audit trail                                                    |
| updatedAt          | DateTime        | No       | No       | Timestamp of last update             | 2025-12-14T15:30:00Z                           | Audit trail                                                    |

**Constraints:**

- Unique on `submissionId` – prevents duplicate classifications

**SOP Notes:**

- Classification is CHAIR responsibility
- EXEMPT reviews may be final decision (auto-APPROVED in some policies)
- EXPEDITED requires 1–2 expert reviewers + chair sign-off
- FULL_BOARD requires full panel review
- panelId is FK to panel in same committee as submission

---

### 2.9 Review

**Purpose:** Assignment of reviewer to a submission for review decision

| Field        | Type                | Nullable | Unique      | Description                      | Example                                     | SOP Note                                                                                         |
| ------------ | ------------------- | -------- | ----------- | -------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| id           | Integer             | No       | Yes (PK)    | Auto-increment primary key       | 1                                           | Unique identifier                                                                                |
| submissionId | Integer             | No       | Part of (U) | Foreign key to Submission        | 1                                           | Which submission is being reviewed?                                                              |
| reviewerId   | Integer             | No       | Part of (U) | Foreign key to User (reviewer)   | 42                                          | Who is reviewing?                                                                                |
| isPrimary    | Boolean             | No       | No          | Primary reviewer flag            | true                                        | Designates lead reviewer (for tie-breaking, etc.)                                                |
| assignedAt   | DateTime            | No       | No          | Date reviewer was assigned       | 2025-12-12T10:00:00Z                        | Triggers reviewer deadline clock                                                                 |
| respondedAt  | DateTime            | Yes      | No          | Date reviewer submitted decision | 2025-12-14T14:00:00Z                        | Null until reviewer responds                                                                     |
| decision     | ReviewDecision enum | Yes      | No          | Reviewer decision                | APPROVED                                    | One of: APPROVED, MINOR_REVISIONS, MAJOR_REVISIONS, DISAPPROVED, INFO_ONLY; null until responded |
| remarks      | String              | Yes      | No          | Reviewer comments                | "Study design is sound; minor edits needed" | Optional feedback                                                                                |
| createdAt    | DateTime            | No       | No          | Timestamp of creation            | 2025-12-12T10:00:00Z                        | Audit trail                                                                                      |
| updatedAt    | DateTime            | No       | No          | Timestamp of last update         | 2025-12-14T15:30:00Z                        | Audit trail                                                                                      |

**Constraints:**

- Unique on `(submissionId, reviewerId)` – no duplicate reviewer assignments
- Index on `submissionId` – fast lookup of all reviewers for a submission

**SOP Notes:**

- Each submission has 1–N reviewers depending on classification
- EXPEDITED: typically 1–2 reviewers
- FULL_BOARD: all panel members
- respondedAt null = reviewer hasn't submitted decision yet
- Once all reviewers respond, RA/Chair aggregates decisions into finalDecision
- Reviewer is primarily-scoped: can only see submissions they are assigned to (IDOR protection)

---

### 2.10 SubmissionStatusHistory

**Purpose:** Audit log of all submission status transitions

| Field         | Type                  | Nullable | Unique   | Description                       | Example                           | SOP Note                         |
| ------------- | --------------------- | -------- | -------- | --------------------------------- | --------------------------------- | -------------------------------- |
| id            | Integer               | No       | Yes (PK) | Auto-increment primary key        | 1                                 | Unique identifier                |
| submissionId  | Integer               | No       | No (FK)  | Foreign key to Submission         | 1                                 | Which submission changed status? |
| oldStatus     | SubmissionStatus enum | Yes      | No       | Previous status                   | RECEIVED                          | Null for first entry (creation)  |
| newStatus     | SubmissionStatus enum | No       | No       | New status after transition       | UNDER_COMPLETENESS_CHECK          | Current status value             |
| effectiveDate | DateTime              | No       | No       | When did this transition occur?   | 2025-12-11T14:30:00Z              | Timestamps for SLA math          |
| reason        | String                | Yes      | No       | Why did status change?            | "RA initiated completeness check" | Optional but recommended         |
| changedById   | Integer               | Yes      | No (FK)  | User who triggered the change     | 42                                | Tracks who made the change       |
| createdAt     | DateTime              | No       | No       | Timestamp when record was created | 2025-12-11T14:30:00Z              | Always = effectiveDate           |

**SOP Notes:**

- Complete audit trail of submission lifecycle
- oldStatus may be null for first entry (creation auto-RECEIVED)
- effectiveDate is key for SLA duration calculations
- Ordered by effectiveDate to visualize workflow timeline
- Every status change must write a StatusHistory record

---

### 2.11 Classification

**Purpose:** Configuration of SLA (Service Level Agreement) thresholds per committee, stage, and review type

| Field       | Type            | Nullable | Unique   | Description                      | Example                                                     | SOP Note                                                                                                        |
| ----------- | --------------- | -------- | -------- | -------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| id          | Integer         | No       | Yes (PK) | Auto-increment primary key       | 1                                                           | Unique identifier                                                                                               |
| committeeId | Integer         | No       | No (FK)  | Foreign key to Committee         | 1                                                           | SLA applies to this committee                                                                                   |
| reviewType  | ReviewType enum | Yes      | No       | Review type filter (optional)    | EXPEDITED                                                   | If null, acts as default for stage                                                                              |
| stage       | SLAStage enum   | No       | No       | Workflow stage                   | REVIEW                                                      | One of: CLASSIFICATION, REVIEW, REVISION_RESPONSE, CONTINUING_REVIEW_DUE, FINAL_REPORT_DUE, MEMBERSHIP, MEETING |
| workingDays | Integer         | No       | No       | Number of working days (Mon–Fri) | 10                                                          | SLA threshold; e.g., reviewers must respond within 10 working days                                              |
| description | String          | Yes      | No       | Human-readable description       | "Expedited review must be completed within 10 working days" | Optional notes                                                                                                  |
| isActive    | Boolean         | No       | No       | SLA rule active status           | true                                                        | Soft-delete for archive                                                                                         |
| createdAt   | DateTime        | No       | No       | Timestamp of creation            | 2025-01-01T08:00:00Z                                        | Audit trail                                                                                                     |
| updatedAt   | DateTime        | No       | No       | Timestamp of last update         | 2025-12-14T15:30:00Z                                        | Audit trail                                                                                                     |

**SOP Notes:**

- SLA is committee-specific + stage-specific + optional reviewType-specific
- Example: Committee A, stage=REVIEW, reviewType=EXPEDITED, workingDays=10
- If no reviewType-specific rule, use default (reviewType=null) for stage
- workingDays = Mon–Fri count; weekends excluded
- Used to compute `revisionDueDate`, `continuingReviewDueDate`, and overdue flags for dashboards

---

## 3) Google Sheets → Database Mapping

### Main Tracking Sheet Columns

| Google Sheets Column   | Database Table.Field                  | Type       | Notes                                                        |
| ---------------------- | ------------------------------------- | ---------- | ------------------------------------------------------------ |
| Project Code           | Project.projectCode                   | String     | Unique identifier; printed on letters                        |
| Project Title          | Project.title                         | String     | Protocol name                                                |
| PI Name                | Project.piName                        | String     | Principal investigator                                       |
| PI Affiliation         | Project.piAffiliation                 | String     | Department/institution (optional)                            |
| Date Received          | Submission.receivedDate               | DateTime   | Initial submission date; triggers SLA clocks                 |
| Document Link          | Submission.documentLink               | String     | External link (e.g., Google Drive folder)                    |
| Completeness Status    | Submission.completenessStatus         | Enum       | COMPLETE, MINOR_MISSING, MAJOR_MISSING, etc.                 |
| Completeness Remarks   | Submission.completenessRemarks        | String     | RA notes if incomplete                                       |
| Status                 | Submission.status                     | Enum       | RECEIVED, UNDER_CLASSIFICATION, UNDER_REVIEW, APPROVED, etc. |
| Review Type            | Classification.reviewType             | Enum       | EXEMPT, EXPEDITED, FULL_BOARD                                |
| Panel Assigned         | Classification.panelId (→ Panel.name) | Integer FK | Panel name (for FULL_BOARD only)                             |
| Classification Date    | Classification.classificationDate     | DateTime   | When was classification decision made?                       |
| Reviewer 1 (Name)      | Review.reviewerId (→ User.fullName)   | Integer FK | Primary reviewer name                                        |
| Reviewer 2 (Name)      | Review.reviewerId (→ User.fullName)   | Integer FK | Secondary reviewer (if applicable)                           |
| Decision               | Submission.finalDecision              | Enum       | APPROVED, MINOR_REVISIONS, MAJOR_REVISIONS, DISAPPROVED      |
| Decision Date          | Submission.finalDecisionDate          | DateTime   | When final decision was made                                 |
| Approval Period Start  | Project.approvalStartDate             | DateTime   | Start of approval validity                                   |
| Approval Period End    | Project.approvalEndDate               | DateTime   | End of approval validity                                     |
| Revision Due Date      | Submission.revisionDueDate            | DateTime   | Auto-computed from ConfigSLA (~70 working days)              |
| Continuing Review Due  | Submission.continuingReviewDueDate    | DateTime   | Annual renewal deadline                                      |
| Final Report Due       | Submission.finalReportDueDate         | DateTime   | Project closure deadline                                     |
| Committee              | Committee.code                        | String     | RERC-HUMAN, etc.                                             |
| Overall Project Status | Project.overallStatus                 | Enum       | DRAFT, ACTIVE, INACTIVE, WITHDRAWN, CLOSED                   |
| Created By (RA)        | User.fullName (createdById)           | String FK  | Who encoded the project?                                     |

### Fields Not Yet in Database (Mark as TBD)

| Google Sheets Column          | Reason                                       | Recommendation                           |
| ----------------------------- | -------------------------------------------- | ---------------------------------------- |
| "Payment Status"              | Not in SOP                                   | Confirm if needed; defer if not critical |
| "Ethics Concerns" (free text) | Could be encoded as Classification.rationale | Already covered                          |
| "Reviewer Availability"       | Reviewer scheduling not yet implemented      | Defer to v2                              |
| "Funding Amount"              | FundingType enum sufficient for v1           | Defer if needed later                    |

---

## 4) Enum Definitions

### RoleType

- `CHAIR` – Committee chair; authorizes approvals
- `MEMBER` – Committee member; may review
- `RESEARCH_ASSOCIATE` (RA) – Primary administrative contact; encodes projects, manages workflow
- `RESEARCH_ASSISTANT` – Assists RA
- `REVIEWER` – External/ad-hoc reviewer (not committee member)
- `ADMIN` – System administrator

### FundingType

- `INTERNAL` – University/institutional funding
- `EXTERNAL` – Grant/external funding
- `SELF_FUNDED` – PI self-funded
- `NO_FUNDING` – No funding / no funding required

### SubmissionType

- `INITIAL` – First protocol submission
- `AMENDMENT` – Amendment to approved protocol
- `CONTINUING_REVIEW` – Annual/periodic continuing review
- `FINAL_REPORT` – Final report on project closure
- `WITHDRAWAL` – Formal withdrawal
- `SAFETY_REPORT` – Report of adverse event
- `PROTOCOL_DEVIATION` – Report of deviation from approved protocol

### ProjectStatus

- `DRAFT` – Being encoded; not yet submitted for review
- `ACTIVE` – Approved and within approval period
- `INACTIVE` – Lapsed or no ongoing activity
- `WITHDRAWN` – Formally withdrawn by PI
- `CLOSED` – Final report accepted; project archived

### CompletenessStatus

- `COMPLETE` – All required documents present and correct
- `MINOR_MISSING` – Minor items missing (e.g., signatures) but won't delay review
- `MAJOR_MISSING` – Major sections missing; blocks review
- `MISSING_SIGNATURES` – Documentation present but lacking required signatures
- `OTHER` – Other completeness issues (describe in remarks)

### ReviewType

- `EXEMPT` – Exempt review (may be auto-approved per policy)
- `EXPEDITED` – Expedited review (minimal risk; 1–2 expert reviewers)
- `FULL_BOARD` – Full board review (entire panel or committee)

### ReviewDecision

- `APPROVED` – Approved as-is
- `MINOR_REVISIONS` – Approved pending minor revisions (PI must resubmit)
- `MAJOR_REVISIONS` – Approved pending major revisions (full re-review required)
- `DISAPPROVED` – Not approved; protocol has issues
- `INFO_ONLY` – Informational (e.g., audit, notification-only)

### SubmissionStatus (Workflow States)

1. `RECEIVED` – Submission received; awaiting completeness check
2. `UNDER_COMPLETENESS_CHECK` – RA checking completeness
3. `AWAITING_CLASSIFICATION` – Completeness check done; ready for chair
4. `UNDER_CLASSIFICATION` – Chair is classifying
5. `CLASSIFIED` – Chair has classified; ready for reviewers
6. `UNDER_REVIEW` – Reviewers assigned and reviewing
7. `AWAITING_REVISIONS` – Decision = MINOR/MAJOR_REVISIONS; awaiting PI response
8. `REVISION_SUBMITTED` – PI resubmitted revisions; ready for re-review
9. `CLOSED` – Final status; approval period ended or project archived
10. `WITHDRAWN` – Submission or project withdrawn

### SLAStage

- `CLASSIFICATION` – Time to classify (Chair)
- `REVIEW` – Time to review (Reviewers)
- `REVISION_RESPONSE` – Time for PI to respond to revisions (~70 working days per SOP)
- `CONTINUING_REVIEW_DUE` – Annual continuing review deadline
- `FINAL_REPORT_DUE` – Final report deadline
- `MEMBERSHIP` – Committee membership update deadline (optional)
- `MEETING` – Meeting preparation deadline (optional)

### PanelMemberRole

- `CHAIR` – Panel chair
- `MEMBER` – Voting member
- `SECRETARIAT` – Administrative support

---

## 5) Implementation Notes

### Indexes

For performance, the following indexes are recommended:

```sql
CREATE INDEX idx_submission_project_type
  ON Submission(projectId, submissionType);

CREATE INDEX idx_submission_status_history_submission
  ON SubmissionStatusHistory(submissionId, effectiveDate);

CREATE INDEX idx_review_submission
  ON Review(submissionId);

CREATE INDEX idx_committee_member_committee
  ON CommitteeMember(committeeId);

CREATE INDEX idx_config_sla_committee_stage
  ON ConfigSLA(committeeId, stage, reviewType);
```

### Constraints (Already in Prisma Schema)

- `Project.projectCode` is UNIQUE
- `Committee.code` is UNIQUE
- `User.email` is UNIQUE
- `Classification.submissionId` is UNIQUE
- `Review(submissionId, reviewerId)` is UNIQUE
- `CommitteeMember(committeeId, userId, role)` is UNIQUE
- `PanelMember(panelId, userId)` is UNIQUE

### Cascade Behaviors

- Deleting a `Project` cascades to `Submission`
- Deleting a `Submission` cascades to `Classification`, `Review`, `SubmissionStatusHistory`
- Deleting a `Committee` cascades to `Panel`, `CommitteeMember`, `ConfigSLA`, `Project` (careful!)
- Deleting a `User` restricts (blocks deletion if referenced)

---

## 6) Version History

| Version | Date         | Author  | Changes                                                           |
| ------- | ------------ | ------- | ----------------------------------------------------------------- |
| 1.0     | Dec 14, 2025 | Copilot | Initial data dictionary aligned to Prisma schema and SOP workflow |

---

## Appendix: Contact & Questions

For questions on the data model:

- **Data Owner:** [Your Name/Committee]
- **Last Reviewed:** December 14, 2025
- **Next Review:** December 31, 2025
