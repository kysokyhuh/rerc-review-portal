# RERC System - Complete File Summary (Version e16d33f)

## December 15, 2025 - CSV Export Endpoints Version

---

## PROJECT OVERVIEW

**Repository:** rerc-review-portal (kysokyhuh)
**Current Version:** e16d33f - "Add CSV export endpoints for initial acknowledgement and approval mail-merge"
**Tech Stack:**

- Backend: Express.js + TypeScript
- Database: PostgreSQL 18
- ORM: Prisma 7.1.0
- Frontend: React + Vite (port 5173)
- Server: port 3000

**Database:** PostgreSQL 18 running on localhost:5432

- Database name: `rerc`
- User: `rerc` / password: `password`

---

## DATABASE SCHEMA (11 Core Models)

### 1. USER MODEL

```
- id (PK)
- email (unique)
- fullName
- isActive (default: true)
- createdAt / updatedAt
Relations: CommitteeMemberships, ProjectsCreated, SubmissionsCreated,
           ClassificationsMade, ReviewsAssigned, StatusChanges, PanelMemberships
```

### 2. COMMITTEE MODEL

```
- id (PK)
- name
- code (unique) - e.g., "RERC-HUMAN"
- description
- isActive
- createdAt
Relations: Panels, Projects, Members, ConfigSLAs
```

### 3. PANEL MODEL

```
- id (PK)
- committeeId (FK)
- name - e.g., "Panel 1"
- code (optional)
- isActive
Relations: Committee, Classifications, Members
```

### 4. COMMITTTEEMEMBER MODEL

```
- id (PK)
- committeeId (FK)
- userId (FK)
- role (RoleType: CHAIR, MEMBER, RESEARCH_ASSOCIATE, RESEARCH_ASSISTANT, REVIEWER, ADMIN)
- isPrimary (default: false)
- isActive
- createdAt
Unique: [committeeId, userId, role]
```

### 5. PROJECT MODEL

```
- id (PK)
- projectCode (unique) - e.g., "2025-350"
- title
- piName (Principal Investigator)
- piAffiliation
- fundingType (INTERNAL, EXTERNAL, SELF_FUNDED, NO_FUNDING)
- initialSubmissionDate
- committeeId (FK)
- overallStatus (ProjectStatus: DRAFT, ACTIVE, INACTIVE, WITHDRAWN, CLOSED)
- approvalStartDate / approvalEndDate
- isArchived
- createdAt / updatedAt
- createdById (FK)
Relations: Submissions, CreatedBy(User)
```

### 6. SUBMISSION MODEL

```
- id (PK)
- projectId (FK)
- submissionType (SubmissionType: INITIAL, AMENDMENT, CONTINUING_REVIEW, FINAL_REPORT, WITHDRAWAL, SAFETY_REPORT, PROTOCOL_DEVIATION)
- sequenceNumber (1 = initial, higher for follow-ups)
- receivedDate
- documentLink (Google Drive URL)
- completenessStatus (COMPLETE, MINOR_MISSING, MAJOR_MISSING, MISSING_SIGNATURES, OTHER)
- completenessRemarks
- status (SubmissionStatus: RECEIVED, UNDER_COMPLETENESS_CHECK, AWAITING_CLASSIFICATION, UNDER_CLASSIFICATION, CLASSIFIED, UNDER_REVIEW, AWAITING_REVISIONS, REVISION_SUBMITTED, CLOSED, WITHDRAWN)
- revisionDueDate / continuingReviewDueDate / finalReportDueDate
- finalDecision (ReviewDecision)
- finalDecisionDate
- createdAt / updatedAt
- createdById (FK)
Relations: Project, Classification, Reviews, StatusHistory
Index: (projectId, submissionType)
```

### 7. CLASSIFICATION MODEL

```
- id (PK)
- submissionId (FK, unique)
- reviewType (ReviewType: EXEMPT, EXPEDITED, FULL_BOARD)
- classificationDate
- panelId (FK, optional)
- rationale (notes)
- createdAt / updatedAt
- classifiedById (FK)
Relations: Submission, Panel, ClassifiedBy(User)
```

### 8. REVIEW MODEL

```
- id (PK)
- submissionId (FK)
- reviewerId (FK)
- isPrimary (default: false)
- assignedAt
- respondedAt
- decision (ReviewDecision: APPROVED, MINOR_REVISIONS, MAJOR_REVISIONS, DISAPPROVED, INFO_ONLY)
- remarks
- createdAt / updatedAt
Unique: [submissionId, reviewerId]
Index: (submissionId)
Relations: Submission, Reviewer(User)
```

### 9. SUBMISSIONSTATUSHISTORY MODEL

```
- id (PK)
- submissionId (FK)
- oldStatus (SubmissionStatus, nullable)
- newStatus (SubmissionStatus)
- effectiveDate (default: now)
- reason
- changedById (FK)
- createdAt
Audit trail for all status changes
Relations: Submission, ChangedBy(User)
```

### 10. PANELMEMBER MODEL

```
- id (PK)
- panelId (FK)
- userId (FK)
- role (PanelMemberRole: CHAIR, MEMBER, SECRETARIAT)
- isActive
- createdAt
Unique: [panelId, userId]
Relations: Panel, User
```

### 11. CONFIGSLA MODEL

```
- id (PK)
- committeeId (FK)
- reviewType (ReviewType, nullable)
- stage (SLAStage: CLASSIFICATION, REVIEW, REVISION_RESPONSE, CONTINUING_REVIEW_DUE, FINAL_REPORT_DUE, MEMBERSHIP, MEETING)
- workingDays (integer)
- description
- isActive
- createdAt / updatedAt
SLA configuration for timeline management
Relations: Committee
```

---

## KEY ENUMS

```typescript
// User Roles
RoleType: CHAIR, MEMBER, RESEARCH_ASSOCIATE, RESEARCH_ASSISTANT, REVIEWER, ADMIN

// Project Status
ProjectStatus: DRAFT, ACTIVE, INACTIVE, WITHDRAWN, CLOSED

// Submission Type
SubmissionType: INITIAL, AMENDMENT, CONTINUING_REVIEW, FINAL_REPORT, WITHDRAWAL, SAFETY_REPORT, PROTOCOL_DEVIATION

// Submission Status (Workflow)
SubmissionStatus: RECEIVED → UNDER_COMPLETENESS_CHECK → AWAITING_CLASSIFICATION → UNDER_CLASSIFICATION → CLASSIFIED → UNDER_REVIEW → AWAITING_REVISIONS → REVISION_SUBMITTED → CLOSED / WITHDRAWN

// Review Type
ReviewType: EXEMPT, EXPEDITED, FULL_BOARD

// Review Decision
ReviewDecision: APPROVED, MINOR_REVISIONS, MAJOR_REVISIONS, DISAPPROVED, INFO_ONLY

// Completeness Status
CompletenessStatus: COMPLETE, MINOR_MISSING, MAJOR_MISSING, MISSING_SIGNATURES, OTHER

// Panel Member Role
PanelMemberRole: CHAIR, MEMBER, SECRETARIAT

// SLA Stage
SLAStage: CLASSIFICATION, REVIEW, REVISION_RESPONSE, CONTINUING_REVIEW_DUE, FINAL_REPORT_DUE, MEMBERSHIP, MEETING

// Funding Type
FundingType: INTERNAL, EXTERNAL, SELF_FUNDED, NO_FUNDING
```

---

## API ENDPOINTS (Key Routes in server.ts)

### HEALTH & STATUS

- **GET /** - Server status check
- **GET /health** - Database connection check (returns userCount)

### COMMITTEE MANAGEMENT

- **GET /committees** - List all committees with panels and members
- **GET /committees/{code}/panels** - Get panels for a specific committee
- **GET /panels/{id}/members** - Get members of a specific panel

### DASHBOARD

- **GET /dashboard/queues** - Get classification, review, and revision queues
  - Query params: ?committeeCode=RERC-HUMAN
  - Returns: counts + queue details for each status

### MAIL-MERGE CSV EXPORTS (Form Exports)

- **GET /mail-merge/initial-ack.csv** - Initial acknowledgment letters
  - Query params: ?committeeCode=RERC-HUMAN&from=2025-01-01&to=2025-12-31&letterDate=2025-12-15
  - Returns: CSV with merged letter content
- **GET /mail-merge/initial-approval.csv** - Initial approval letters
  - Same query params
  - Returns: CSV with merged letter content

---

## LETTER GENERATION (src/letters.ts)

Two main letter templates implemented:

### 1. Initial Acknowledgment Letter (Form 6B)

```
Recipient: PI (Principal Investigator)
Content:
- Project code & title
- Submission received date
- Completeness assessment
- Next steps
- Contact information

Export: CSV with all PI data + merged letter
```

### 2. Initial Approval Letter (Form 20B)

```
Recipient: PI & Committee
Content:
- Approval decision
- Approval validity period (start/end dates)
- Review type (EXEMPT, EXPEDITED, FULL_BOARD)
- Conditions & requirements
- Contact information

Export: CSV with all project data + merged letter
```

---

## SLA UTILITIES (src/slaUtils.ts)

Working day calculations for deadline tracking:

- **workingDaysBetween(from, to)** - Calculate working days between dates
  - Excludes weekends (Saturday, Sunday)
  - Excludes configured holidays
  - Returns integer count of working days

Usage:

- Classification deadline: ConfigSLA[CLASSIFICATION] working days
- Review deadline: ConfigSLA[REVIEW] working days
- Revision response deadline: ConfigSLA[REVISION_RESPONSE] working days

---

## PROJECT FILES STRUCTURE

```
rerc-system/
├── src/
│   ├── server.ts (1882 lines) - Main Express app with all endpoints
│   ├── prisma.ts - Prisma client initialization
│   ├── slaUtils.ts - Working day calculations
│   ├── letters.ts - Letter template builders
│   ├── config/
│   │   └── prismaClient.ts - Prisma configuration
│   └── generated/
│       └── prisma/ - Auto-generated Prisma client
│
├── prisma/
│   ├── schema.prisma (291 lines) - Complete database schema
│   ├── migrations/ - Database migrations (9 migrations)
│   │   ├── 20251211100203_init_user
│   │   ├── 20251211103050_rerc_core
│   │   ├── 20251211130711_add_classification
│   │   ├── 20251211132529_add_reviews
│   │   ├── 20251211134028_add_submission_status
│   │   ├── 20251211135517_add_config_sla
│   │   ├── 20251211142937_extend_sla_stages
│   │   ├── 20251211150930_add_panel_member_and_deadlines
│   │   └── 20251211155533_add_submission_final_decision
│   └── migration_lock.toml
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── QueueTable.tsx
│   │   │   ├── SummaryCards.tsx
│   │   │   └── Timeline.tsx
│   │   ├── hooks/
│   │   │   ├── useDashboardQueues.ts
│   │   │   └── useProjectDetail.ts
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   └── ProjectDetailPage.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   └── styles/
│   │       └── globals.css
│   ├── index.html
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── public/
│   ├── index.html
│   └── styles.css
│
├── dist/ - Compiled JavaScript
├── .env - Database connection & config
├── package.json - Dependencies
├── tsconfig.json - TypeScript config
├── prisma.config.ts - Prisma configuration
├── README.md
└── DATA_DICTIONARY.md

Initial Data Files:
├── initial_ack.csv - Sample acknowledgment letters
└── initial_approval.csv - Sample approval letters
```

---

## DEPENDENCIES

### Core

- **express** ^5.2.1 - Web framework
- **prisma** ^7.1.0 - ORM
- **@prisma/client** ^7.1.0 - Prisma client
- **typescript** ^5.9.3 - Type checking
- **pg** ^8.16.3 - PostgreSQL driver
- **@prisma/adapter-pg** ^7.1.0 - PostgreSQL adapter

### Utilities

- **docx** ^9.5.1 - Word document generation
- **json2csv** ^6.0.0-alpha.2 - CSV export

### Dev Dependencies

- **ts-node-dev** ^2.0.0 - Development server
- **jest** ^30.2.0 - Testing framework
- **supertest** ^7.1.4 - API testing

---

## MISSING FEATURES (NOT YET IMPLEMENTED)

✅ IMPLEMENTED (in e16d33f):

- Core database schema with 11 models
- User & committee management
- Project & submission workflows
- Letter generation (6B, 20B forms)
- CSV export for mail-merge
- SLA tracking with working day calculations
- Dashboard queues (classification, review, revision)

❌ NOT YET IMPLEMENTED (would be in later versions):

- **RBAC** (Role-Based Access Control) - Authorization middleware
- **Audit Logging** - Track who changed what and when
- **Additional Letter Forms** - 6D, 6E, 6F, 6G, 20A, 8B, 9B (7 more forms)
- **Reporting Endpoints** - Meeting appendices, efficiency metrics
- **Bottleneck Analysis** - Identify processing delays
- **Frontend Dashboard** - React components incomplete
- **Authentication** - No JWT or session management yet

---

## VERSION HISTORY

```
57ea78a (Dec 14 11:18) - Initial README commit
cbb9d80 (Dec 14 11:22) - Initial commit: RERC backend with Prisma & Express
e16d33f (Dec 14 ??) - Add CSV export endpoints (CURRENT - e16d33f)
3804ca9 (Dec 14) - Add comprehensive QA test strategy & Jest setup
b3f1ff9 (Dec 14) - Fix frontend CSS imports, test configuration
386371b (Dec 14) - Fix frontend API data transformation & debugging
f52de0e (Dec 14) - Refactor: reorganize backend structure + ADD RBAC & AUDIT LOGGING
```

**Latest Version on main branch (f52de0e):**

- Includes RBAC middleware (authentication & authorization)
- Includes comprehensive audit logging
- Includes field-level access control
- Includes 3 audit log retrieval endpoints
- Includes 400+ lines of security documentation
- Includes testing infrastructure (Postman + cURL guides)

---

## HOW TO USE

### Setup (One-time)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Ensure PostgreSQL is running
brew services start postgresql@15

# 4. Create user & database
psql -U postgres -c "CREATE USER rerc WITH PASSWORD 'password';"
psql -U postgres -c "CREATE DATABASE rerc OWNER rerc;"
psql -U postgres -c "ALTER USER rerc CREATEDB;"

# 5. Run migrations
npx prisma migrate dev --name init

# 6. View database (optional)
# In PostgreSQL.app: Click "Connect..." button
```

### Development

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start frontend
cd frontend && npm run dev

# Terminal 3: Use psql for direct queries
psql -U rerc -h localhost -d rerc
```

### Queries

```sql
-- Connect to database
psql -U rerc -h localhost -d rerc

-- List tables
\dt

-- Query examples
SELECT * FROM "User";
SELECT * FROM "Project" LIMIT 5;
SELECT * FROM "Submission" WHERE status = 'UNDER_REVIEW';
SELECT * FROM "Review" WHERE decision IS NULL;
SELECT COUNT(*) FROM "Submission" GROUP BY status;
```

---

## SUMMARY

This is a **Research Ethics Review Committee (RERC) management system** that:

1. **Tracks projects** through the ethics review process
2. **Manages submissions** (initial, amendments, continuing reviews)
3. **Assigns reviewers** and tracks review outcomes
4. **Generates letters** (acknowledgments, approvals, etc.) via mail-merge
5. **Monitors SLAs** (Service Level Agreements) with working day calculations
6. **Provides dashboards** for queue management

**Database:** 11 interconnected models managing the complete review workflow
**API:** RESTful endpoints for UI + mail-merge exports
**Frontend:** React dashboard (in development)
**Version e16d33f:** Stable with working mail-merge & CSV exports
**Version f52de0e (main):** Enhanced with RBAC & audit logging

---

Generated: December 15, 2025
Current Git Commit: e16d33f (detached HEAD)
