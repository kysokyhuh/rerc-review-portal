# RERC Review Portal — Project Context Pack

**Generated:** March 2, 2026  
**Repository:** `rerc-review-portal`  
**Version:** 0.3.0

---

## 0. Executive Summary

### System Purpose

The **RERC Review Portal** is a web-based Research Ethics Review Committee (RERC) management system built for De La Salle University Manila. It streamlines the workflow for managing research ethics protocol submissions—from initial receipt through classification, review, and final decision—while providing mail-merge letter generation, SLA tracking, holiday management, reporting, and protocol profile capabilities.

### Tech Stack

| Layer         | Technology                                            |
| ------------- | ----------------------------------------------------- |
| **Backend**   | Node.js 18+, Express 5.x, TypeScript 5.x              |
| **Frontend**  | React 18, Vite 5.x, TypeScript, React Router 6         |
| **Database**  | PostgreSQL (via Prisma ORM 7.x)                       |
| **Libraries** | Axios, docx, json2csv, csv-parse, zod, jsonwebtoken, express-rate-limit, pino |
| **Infra**     | Local + GitHub Actions CI (`.github/workflows/ci.yml`) + Render/Cloudflare deploy config |

### Highest-Risk Areas / Bottlenecks

- **Dual auth mode complexity**: JWT auth is implemented, but development header/env fallback (`X-User-*`, `DEV_USER_*`) still exists and can hide auth bugs if overused.
- **Client-side login lockout mismatch risk**: Frontend lockout UI tracks attempts locally while backend enforces independent server-side rate limits.
- **Hardcoded user IDs still present in selected write paths**: Some routes still write with fixed user IDs, reducing audit quality.
- **CSV/file import security**: Seed script parses external CSV without comprehensive sanitization.
- **Large legacy modules remain**: Several older modules are still dense despite recent refactors.

### Where to Start Reading the Code (Top 5 Files)

1. `backend/src/server.ts` — Express app entry point, middleware setup, route mounting
2. `backend/prisma/schema.prisma` — Complete data model (781 lines) with all enums and relationships
3. `backend/src/routes/authRoutes.ts` — JWT login/refresh/logout/me flow, cookie handling, and auth lifecycle
4. `frontend/src/pages/QueuePage.tsx` — Route-driven dedicated queue views (`/queues/:queueKey`) with focused KPI/filter/table UX
5. `docs/SECURITY.md` — RBAC design and audit logging approach

---

## 1. Repository Map

```
rerc-review-portal/
├── README.md                          # Project overview & setup
├── FILE_EXPLANATIONS.txt              # Detailed file documentation
├── package.json                       # Root workspace scripts
│
├── .env.example                       # Environment variable template
│
├── backend/                           # Express.js API Server
│   ├── package.json                   # Backend dependencies
│   ├── tsconfig.json                  # TypeScript config
│   ├── prisma.config.ts               # Prisma configuration
│   ├── prisma/
│   │   ├── schema.prisma              # Database schema (781 lines)
│   │   └── migrations/                # 16 migration folders
│   └── src/
│       ├── server.ts                  # Express entry point
│       ├── app.ts                     # Express app factory
│       ├── config/
│       │   ├── branding.ts            # Committee branding config
│       │   ├── prismaClient.ts        # Prisma client singleton
│       │   ├── seed.ts                # Database seeder (1,423 lines)
│       │   ├── seedReportsDemo.ts     # Reports demo data seeder (469 lines)
│       │   └── importCSV.ts           # CSV import utilities
│       ├── routes/
│       │   ├── index.ts               # Route barrel exports (core route modules)
│       │   ├── authRoutes.ts          # JWT login/refresh/logout/me endpoints
│       │   ├── healthRoutes.ts        # Health check endpoints (33 lines)
│       │   ├── committeeRoutes.ts     # Committee/panel endpoints (164 lines)
│       │   ├── dashboardRoutes.ts     # Dashboard queues & filters (595 lines)
│       │   ├── projectRoutes.ts       # Project CRUD, profile, and archives
│       │   ├── submissionRoutes.ts    # Submission/review operations
│       │   ├── mailMergeRoutes.ts     # Letter generation (605 lines)
│       │   ├── importRoutes.ts        # CSV import endpoints (435 lines)
│       │   ├── reportRoutes.ts        # Academic year reports (266 lines)
│       │   └── holidayRoutes.ts       # Holiday CRUD (205 lines)
│       ├── services/
│       │   ├── letterGenerator.ts     # DOCX letter builder (183 lines)
│       │   ├── imports/
│       │   │   └── projectCsvImport.ts # CSV parsing & validation (580 lines)
│       │   ├── projects/
│       │   │   └── createProjectWithInitialSubmission.ts # Project creation service (274 lines)
│       │   └── reports/
│       │       ├── academicTerms.ts   # Academic term helpers
│       │       └── reportMetrics.ts   # Report aggregation logic (406 lines)
│       ├── utils/
│       │   ├── index.ts
│       │   ├── csvUtils.ts            # CSV escape utilities
│       │   ├── dashboardFilters.ts    # Prisma where-clause builder (121 lines)
│       │   ├── holidayDate.ts         # Holiday date helpers (37 lines)
│       │   ├── overdueClassifier.ts   # Overdue severity classifier (140 lines)
│       │   ├── slaUtils.ts            # Working days calculator
│       │   └── workingDays.ts         # Business day calculations (58 lines)
│       ├── middleware/
│       │   └── auth.ts                # JWT auth + dev header/env fallback
│       └── generated/prisma/          # Generated Prisma client
│
├── frontend/                          # React SPA
│   ├── package.json                   # Frontend dependencies
│   ├── index.html                     # Vite entry HTML (font preconnect)
│   ├── vite.config.ts                 # Vite bundler config
│   ├── tsconfig.json                  # TypeScript config
│   └── src/
│       ├── App.tsx                    # React app root & routing
│       ├── main.tsx                   # React entry point
│       ├── constants.ts               # App-wide constants (SLA targets, thresholds, refresh intervals) (34 lines)
│       ├── components/                # Reusable UI components
│       │   ├── AttentionStrip.tsx
│       │   ├── Breadcrumbs.tsx         # Navigation breadcrumbs
│       │   ├── CommandBar.tsx          # Top-bar search & actions
│       │   ├── CsvDropzone.tsx         # CSV file drag-and-drop
│       │   ├── DashboardFilters.tsx    # 5-filter bar (college, reviewType, etc.) (277 lines)
│       │   ├── DashboardShell.tsx      # Layout wrapper with sidebar (26 lines)
│       │   ├── DashboardSidebar.tsx    # Frosted-glass sidebar nav (127 lines)
│       │   ├── EmptyState.tsx
│       │   ├── ImportStepper.tsx       # Multi-step import wizard
│       │   ├── ImportSummary.tsx       # Import results summary
│       │   ├── LetterReadinessPanel.tsx
│       │   ├── ProtocolProfileSection.tsx # Editable protocol profile (391 lines)
│       │   ├── QueueTable.tsx          # Queue data table (466 lines)
│       │   ├── RowErrorsTable.tsx      # Import error rows display
│       │   ├── SLAStatusChip.tsx
│       │   ├── SummaryCards.tsx
│       │   ├── Timeline.tsx            # Status history timeline
│       │   └── queue/                  # Queue sub-components
│       │       ├── QueueDataTable.tsx
│       │       ├── QueueFilters.tsx
│       │       └── QueueKpiCards.tsx
│       ├── hooks/                     # Custom React hooks
│       │   ├── useDashboardQueues.ts
│       │   ├── useDashboardActivity.ts
│       │   ├── useDashboardOverdue.ts
│       │   ├── useProjectDetail.ts
│       │   └── useSubmissionDetail.ts
│       ├── pages/
│       │   ├── DashboardPageNew.tsx   # Dashboard overview page (modularized)
│       │   ├── DashboardPage.tsx      # Legacy dashboard (359 lines, unused)
│       │   ├── QueuePage.tsx          # Route-driven queue page (137 lines)
│       │   ├── HolidaysPage.tsx       # Calendar-based holiday mgmt (629 lines)
│       │   ├── ReportsPage.tsx        # Academic year reports (535 lines)
│       │   ├── ImportProjectsPage.tsx # CSV import with preview (373 lines)
│       │   ├── NewProtocolPage.tsx    # Create protocol form, 24 fields (580 lines)
│       │   ├── ArchivesPage.tsx       # Archived projects with filters (321 lines)
│       │   ├── ProjectDetailPage.tsx  # Project detail & letters (528 lines)
│       │   ├── SubmissionDetailPage.tsx # Submission detail/editing workflow page
│       │   ├── LoginPage.tsx          # Login page wired to backend /auth/login
│       │   └── ForgotPasswordPage.tsx # Password reset placeholder UI
│       ├── services/
│       │   └── api.ts                 # API client (437 lines, 28+ functions)
│       ├── styles/
│       │   ├── globals.css            # Design tokens & base styles (1,640 lines)
│       │   ├── dashboard.css          # Dashboard styles (3,487 lines)
│       │   ├── imports.css            # Import page styles (589 lines)
│       │   ├── new-protocol.css       # New protocol form (365 lines)
│       │   ├── archives.css           # Archives page + filters (383 lines)
│       │   ├── protocol-profile.css   # Protocol profile section (208 lines)
│       │   ├── reports.css            # Reports page (272 lines)
│       │   └── login.css              # Login page styles (1,306 lines)
│       ├── config/
│       │   └── branding.ts            # Frontend branding config (30 lines)
│       ├── types/
│       │   └── index.ts               # TypeScript interfaces (616 lines)
│       └── utils/
│           ├── dateUtils.ts           # Working-day math & date formatting (54 lines)
│           ├── overdueClassifier.ts   # Frontend overdue logic (128 lines)
│           └── slaUtils.ts            # Frontend SLA helpers (147 lines)
│
├── packages/shared/                   # Shared constants, types & DTOs
│   ├── package.json
│   └── src/
│       ├── index.ts               # Barrel export
│       ├── constants.ts           # Shared enums (roles, statuses, review types) (115 lines)
│       └── types.ts               # Shared DTOs & interfaces (260 lines)
│
├── samples/                           # Sample CSV exports
│   ├── initial_ack.csv
│   └── initial_approval.csv
│
└── docs/
    ├── SECURITY.md                    # Security & RBAC documentation
    ├── fixes.md                       # Integration notes
    ├── reports-date-mapping.md        # Reports date field mapping
    ├── reports-discovery-notes.md     # Reports discovery notes
    └── context-pack/                  # This document
```

---

## 2. How to Run (Local Development)

### Prerequisites

| Requirement    | Version       | How to Check         |
| -------------- | ------------- | -------------------- |
| Node.js        | 20+           | `node -v`            |
| npm            | 10+           | `npm -v`             |
| PostgreSQL     | 15+           | `psql --version`     |

### Environment Variables

**Backend** (`backend/.env`):

| Variable       | Required | Description                                |
| -------------- | -------- | ------------------------------------------ |
| `DATABASE_URL` | Yes      | PostgreSQL connection string               |
| `JWT_ACCESS_SECRET` | Yes | Access-token signing secret (hex)          |
| `JWT_REFRESH_SECRET` | Yes | Refresh-token signing secret (hex)         |
| `PORT`         | No       | Server port (default: 3000)                |
| `CORS_ORIGINS` | No       | Allowed origins (default: localhost:5173)  |
| `FRONTEND_URL` | No       | Frontend URL for CORS                      |

**Frontend** (`.env` or Vite build):

| Variable       | Required | Description                                |
| -------------- | -------- | ------------------------------------------ |
| `VITE_API_URL` | No       | API base URL (default: http://localhost:3000) |

### Installation & Setup

```bash
# 1. Clone and enter repo
cd rerc-review-portal

# 2. Install all dependencies (root, backend, frontend)
npm install
npm run install:all

# 3. Create backend/.env with DATABASE_URL
echo 'DATABASE_URL=postgresql://USER@localhost:5432/rerc' > backend/.env

# 4. Ensure PostgreSQL is running and database exists
createdb rerc  # or use pgAdmin/psql

# 5. Generate Prisma client and run migrations
npm run db:generate
npm run db:migrate

# 6. (Optional) Seed with sample data
npm run db:seed

# 7. Start development servers
npm run dev
```

### Access Points

- **Backend API:** http://localhost:3000
- **Frontend UI:** http://localhost:5173 (default route redirects to `/login`)
- **Health check:** http://localhost:3000/health

### Common Failures & Fixes

| Issue                              | Solution                                             |
| ---------------------------------- | ---------------------------------------------------- |
| `P1001: Can't reach database`     | Check PostgreSQL is running, `DATABASE_URL` is valid |
| `Cannot find module prisma`       | Run `npm run db:generate`                            |
| CORS errors in browser            | Ensure `CORS_ORIGINS` includes frontend URL          |
| Port 3000/5173 already in use     | Kill existing process or change port in config       |
| Missing CSV file during seed      | Ensure `[Intern Copy] RERC Protocol Database 2024 - 2024 Submission.csv` exists at repo root |

---

## 3. Architecture Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │     React SPA (Vite @ port 5173)                               │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐  │ │
│  │  │ LoginPage   │  │ Dashboard   │  │ Project/SubmissionPage │  │ │
│  │  └─────────────┘  └─────────────┘  └────────────────────────┘  │ │
│  │         │               │                     │                │ │
│  │         └───────────────┴─────────────────────┘                │ │
│  │                         │ Axios API Client                     │ │
│  └─────────────────────────┼──────────────────────────────────────┘ │
└────────────────────────────┼────────────────────────────────────────┘
                             │ HTTP/JSON
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXPRESS.JS SERVER (port 3000)                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                        Middleware                              │ │
│  │   CORS → JSON/COOKIE parser → rate-limit → auth → error handler│ │
│  └────────────────────────────────────────────────────────────────┘ │
│                             │                                       │
│  ┌──────────────────────────┼──────────────────────────────────┐   │
│  │                      Route Modules                           │   │
│  │  ┌────────┐ ┌───────────┐ ┌──────────┐ ┌─────────────────┐  │   │
│  │  │ Health │ │ Committee │ │Dashboard │ │    Project      │  │   │
│  │  └────────┘ └───────────┘ └──────────┘ └─────────────────┘  │   │
│  │  ┌─────────────┐ ┌───────────────────────────────────────┐  │   │
│  │  │ Submission  │ │ MailMerge (CSV + DOCX generation)     │  │   │
│  │  └─────────────┘ └───────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────┼──────────────────────────────────┐   │
│  │                    Prisma ORM Client                         │   │
│  └──────────────────────────┼──────────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ PostgreSQL Wire Protocol
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        POSTGRESQL DATABASE                          │
│   Tables: User, Committee, Panel, Project, Submission, Review, etc. │
└─────────────────────────────────────────────────────────────────────┘
```

### Request Lifecycle (Client → API → DB)

```
1. User clicks "View Submission #5" in Dashboard
   │
2. React Router renders SubmissionDetailPage
   │
3. useSubmissionDetail hook fires
   │
4. api.ts → GET /submissions/5
   │
5. Express router matches submissionRoutes.ts
   │
6. Handler calls prisma.submission.findUnique({ where: { id: 5 }, include: {...} })
   │
7. Prisma generates SQL, executes against PostgreSQL
   │
8. JSON response travels back through layers
   │
9. React state updates, component re-renders
```

### Auth Lifecycle (Current)

```
┌─────────────┐     POST /auth/login(email,password)     ┌───────────────────┐
│   Client    │──────────────────────────────────────────▶│ authService.login │
└─────────────┘                                           └───────────────────┘
        │                                                           │
        │                                                           ├─ verifies bcrypt passwordHash
        │                                                           ├─ builds roles + committeeRoles
        │                                                           └─ returns access + refresh tokens
        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ Server response                                                               │
│ - JSON: accessToken                                                           │
│ - httpOnly cookie: refreshToken (path=/auth/refresh, sameSite=strict)        │
└───────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ Subsequent API calls                                                          │
│ - Authorization: Bearer <accessToken>                                         │
│ - authenticateUser middleware validates JWT and attaches req.user             │
│ - requireUser / requireRoles protect endpoints                                │
│ - /auth/refresh rotates refresh token when access token expires               │
└───────────────────────────────────────────────────────────────────────────────┘
```

Dev convenience fallback still exists in non-production: `X-User-*` headers and `DEV_USER_*` env vars.

---

## 4. Data Model (Database)

### ERD Overview (Key Entities)

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│     User     │◀───────▶│ Committee    │◀───────▶│    Panel     │
│──────────────│ N:M via │──────────────│ 1:N     │──────────────│
│ id           │Committee│ id           │         │ id           │
│ email        │Member   │ code         │         │ name         │
│ fullName     │         │ name         │         │ committeeId  │
│ roles[]      │         │ isActive     │         └──────────────┘
└──────────────┘         └──────────────┘                │
       │                        │                        │
       │                        │ 1:N                    │
       │                        ▼                        │
       │                 ┌──────────────┐                │
       │                 │   Project    │                │
       │                 │──────────────│                │
       │                 │ id           │                │
       │                 │ projectCode  │                │
       │                 │ title        │                │
       │                 │ piName       │                │
       │                 │ fundingType  │                │
       │                 │ overallStatus│                │
       │                 │ committeeId  │                │
       │                 └──────────────┘                │
       │                        │                        │
       │                        │ 1:N                    │
       │                        ▼                        │
       │                 ┌──────────────┐         ┌──────────────┐
       │                 │  Submission  │────────▶│Classification│
       │                 │──────────────│ 1:1     │──────────────│
       │                 │ id           │         │ reviewType   │
       │                 │ projectId    │         │ panelId      │
       │                 │ submissionType│        │ classifiedById│
       │                 │ receivedDate │         └──────────────┘
       │                 │ status       │                │
       └────────────────▶│ finalDecision│                │
          assignedTo     │ createdById  │                │
          reviews        └──────────────┘                │
                                │                        │
                         ┌──────┴──────┐                 │
                         │             │                 │
                         ▼             ▼                 │
                  ┌──────────┐  ┌─────────────────┐      │
                  │  Review  │  │StatusHistory    │      │
                  │──────────│  │─────────────────│      │
                  │ reviewerId│ │ oldStatus       │      │
                  │ decision │  │ newStatus       │      │
                  │ remarks  │  │ effectiveDate   │      │
                  └──────────┘  │ changedById     │      │
                                └─────────────────┘      │
```

### Key Enumerations

**RoleType** (User permissions):
- `CHAIR` — Committee chair, full committee access
- `MEMBER` — Committee/panel member, view-only for assigned
- `RESEARCH_ASSOCIATE` — RA/Secretariat, manages protocols
- `RESEARCH_ASSISTANT` — RA support, limited data entry
- `REVIEWER` — External reviewer, assigned submissions only
- `ADMIN` — System administrator, full access

**SubmissionStatus** (Workflow states):
1. `RECEIVED` — Initial receipt
2. `UNDER_COMPLETENESS_CHECK` — Documents being verified
3. `AWAITING_CLASSIFICATION` — Ready for review type decision
4. `UNDER_CLASSIFICATION` — Classification in progress
5. `CLASSIFIED` — Review type assigned
6. `UNDER_REVIEW` — Active reviewer assessment
7. `AWAITING_REVISIONS` — Revisions requested from PI
8. `REVISION_SUBMITTED` — PI resubmitted revisions
9. `CLOSED` — Final decision issued
10. `WITHDRAWN` — Applicant withdrew

**ReviewType** (Classification outcomes):
- `EXEMPT` — No further review needed
- `EXPEDITED` — Minimal-risk, expedited review
- `FULL_BOARD` — Full committee review required

**ReviewDecision** (Reviewer/final outcomes):
- `APPROVED`
- `MINOR_REVISIONS`
- `MAJOR_REVISIONS`
- `DISAPPROVED`
- `INFO_ONLY`

**Newly added enum groups in latest schema migration**:
- `EndorsementStatus` — Tracks endorsement workflow per review assignment
- `ProjectMemberRole` — Standardized roles for listed project members
- `SubmissionDocumentType` / `SubmissionDocumentStatus` — Required document tracking
- `LetterDraftStatus` — Draft lifecycle for generated letters
- `ClassificationType` / `ReviewerRoundRole` / `DecisionStatus` — Expanded governance and reviewer-round semantics

### Critical Invariants (Code-Implied)

1. **Unique project codes**: `projectCode` has unique constraint, enforced by Prisma
2. **One classification per submission**: `submissionId` is unique on `Classification`
3. **Sequential submissions per project**: `@@unique([projectId, sequenceNumber])`
4. **Reviewer assignment uniqueness**: `@@unique([submissionId, reviewerId])` on Review

### Migration History

| Migration                                   | Purpose                                |
| ------------------------------------------- | -------------------------------------- |
| `20251211100203_init_user`                  | User model initialization              |
| `20251211103050_rerc_core`                  | Core RERC models (Committee, Project)  |
| `20251211130711_add_classification`         | Classification model                   |
| `20251211132529_add_reviews`                | Review and reviewer models             |
| `20251211134028_add_submission_status`      | Status history tracking                |
| `20251211135517_add_config_sla`             | SLA configuration tables               |
| `20251211142937_extend_sla_stages`          | Extended SLA stage enum                |
| `20251211150930_add_panel_member_and_deadlines` | Panel membership model             |
| `20251211155533_add_submission_final_decision` | Final decision fields               |
| `20251215021511_init`                       | Re-initialization                      |
| `20251215025323_init`                       | Additional init                        |
| `20260114130242_add_csv_fields`             | Fields for CSV import compatibility    |
| `20260210082226_update_schema`              | Major schema expansion (audit logs, review rounds, documents, decisions, status history, proponents) |
| `20260211120000_reports_terms`              | AcademicTerm model for reports         |
| `20260212203000_allow_missing_protocol_fields` | Make protocol fields nullable for partial data |
| `20260212212000_protocol_profile_and_milestones` | ProtocolProfile & ProtocolMilestone models |

### New Models (Since Feb 12)

**ProtocolProfile** — Denormalized protocol-level data (50+ fields) covering core info, reviewer assignments, honorarium status, progress/final/amendment/continuing report tracking. One-to-one with Project (`projectId` unique).

**ProtocolMilestone** — Ordered milestone entries for a project (label, days, dateOccurred, ownerRole, notes). Indexed by `(projectId, orderIndex)`.

**AcademicTerm** — Academic year/term definitions (`academicYear`, `term`, `startDate`, `endDate`). Unique on `(academicYear, term)`. Used by report endpoints for period-based aggregation.

### Seed Script Notes

The seed script (`backend/src/config/seed.ts`, 1423 lines) reads CSV data from `[Intern Copy] RERC Protocol Database 2024 - 2024 Submission.csv` at the repo root and creates:
- Default committee (RERC-HUMAN)
- Users (RA, Chair, reviewers)
- Projects with submissions from CSV
- Classifications (107 records) with review type, panel, and reviewer assignments
- Populates `piAffiliation` and `researchTypePHREB` for all matched projects (132/133)

**Known fix (Feb 15, 2026):** Removed `submissionType: "INITIAL"` filter from `findFirst` query — existing submissions had `null` for that field, causing the upsert to silently skip all records.

---

## 5. API Surface

### Route Inventory by Module

#### Health & Status
| Method | Endpoint    | Behavior                      | Auth     |
| ------ | ----------- | ----------------------------- | -------- |
| GET    | `/`         | Server status JSON            | None     |
| GET    | `/health`   | Database connection check     | None     |

#### Committee Management
| Method | Endpoint                   | Behavior                          | Auth          |
| ------ | -------------------------- | --------------------------------- | ------------- |
| GET    | `/committees`              | List all committees with panels   | None          |
| GET    | `/committees/:code/panels` | Get panels for a committee        | None          |
| GET    | `/panels/:id/members`      | Get panel members                 | None          |

#### Dashboard
| Method | Endpoint                 | Behavior                           | Auth |
| ------ | ------------------------ | ---------------------------------- | ---- |
| GET    | `/dashboard/queues`      | Submission queues by status        | None |
| GET    | `/dashboard/activity`    | Recent status change activity      | None |
| GET    | `/dashboard/overdue`     | Overdue reviews and endorsements   | None |
| GET    | `/dashboard/upcoming-due`| Submissions with upcoming deadlines| None |
| GET    | `/dashboard/colleges`    | Distinct piAffiliation values for filter dropdown | None |
| GET    | `/ra/dashboard`          | RA-specific dashboard data         | None |
| GET    | `/ra/submissions/:id`    | RA submission detail view          | None |

#### Project Management
| Method | Endpoint                           | Behavior                        | Auth Required         |
| ------ | ---------------------------------- | ------------------------------- | --------------------- |
| POST   | `/projects`                        | Create new project              | CHAIR, RA, ADMIN      |
| GET    | `/projects`                        | List all projects               | None                  |
| GET    | `/projects/search`                 | Search projects                 | None                  |
| GET    | `/projects/:id`                    | Get project by ID               | None                  |
| GET    | `/projects/:id/full`               | Get project with all relations  | None                  |
| GET    | `/projects/:id/profile`            | Get protocol profile            | None                  |
| PUT    | `/projects/:id/profile`            | Update protocol profile         | CHAIR, RA, ADMIN      |
| POST   | `/projects/:id/profile/milestones` | Create protocol milestone       | CHAIR, RA, ADMIN      |
| PATCH  | `/projects/:id/profile/milestones/:mid` | Update milestone           | CHAIR, RA, ADMIN      |
| DELETE | `/projects/:id/profile/milestones/:mid` | Delete milestone           | CHAIR, RA, ADMIN      |
| POST   | `/projects/:projectId/submissions` | Create submission for project   | CHAIR, RA, RA_ASST    |

#### Archives & Archived Projects
| Method | Endpoint                           | Behavior                                    | Auth Required         |
| ------ | ---------------------------------- | ------------------------------------------- | --------------------- |
| GET    | `/projects/archived`               | Fetch archived projects (CLOSED/WITHDRAWN). Filters: `status`, `reviewType`, `college`, `search`, `page`, `pageSize` | None |
| POST   | `/projects/with-submission`        | Create project with initial submission      | CHAIR, RA, ADMIN      |

#### Submission & Review
| Method | Endpoint                                   | Behavior                        | Auth Required     |
| ------ | ------------------------------------------ | ------------------------------- | ----------------- |
| GET    | `/submissions/:id`                         | Get submission with relations   | None              |
| PATCH  | `/submissions/:id/status`                  | Update submission status        | CHAIR, RA, ADMIN  |
| PATCH  | `/submissions/:id/overview`                | Update submission overview      | CHAIR, RA, ADMIN  |
| POST   | `/submissions/:submissionId/classifications` | Add/update classification     | CHAIR, ADMIN      |
| POST   | `/submissions/:submissionId/reviews`       | Add reviewer assignment         | CHAIR, RA, ADMIN  |
| GET    | `/submissions/:id/sla-summary`             | Get SLA deadline summary        | None              |
| POST   | `/reviews/:reviewId/decision`              | Submit review decision          | REVIEWER, CHAIR   |
| POST   | `/submissions/:id/final-decision`          | Record final committee decision | CHAIR, RA, ADMIN  |

#### Mail Merge & Letter Generation
| Method | Endpoint                                      | Behavior                      | Auth |
| ------ | --------------------------------------------- | ----------------------------- | ---- |
| GET    | `/mail-merge/initial-ack.csv`                 | Bulk acknowledgment CSV       | None |
| GET    | `/mail-merge/initial-approval.csv`            | Bulk approval CSV             | None |
| GET    | `/mail-merge/initial-ack/:submissionId`       | Single ack letter data        | None |
| GET    | `/mail-merge/initial-ack/:submissionId/csv`   | Single ack CSV                | None |
| GET    | `/mail-merge/initial-approval/:submissionId`  | Single approval letter data   | None |
| GET    | `/mail-merge/initial-approval/:submissionId/csv` | Single approval CSV        | None |
| GET    | `/letters/initial-ack/:submissionId.docx`     | Generate DOCX ack letter      | None |
| GET    | `/letters/initial-approval/:submissionId.docx`| Generate DOCX approval letter | None |

#### Project Import
| Method | Endpoint                           | Behavior                                    | Auth Required         |
| ------ | ---------------------------------- | ------------------------------------------- | --------------------- |
| POST   | `/api/imports/projects/preview`    | Preview CSV import mapping & validation     | ADMIN, CHAIR, RA      |
| POST   | `/api/imports/projects`            | Import projects from CSV file               | ADMIN, CHAIR, RA      |
| GET    | `/api/imports/projects/template`   | Download CSV template for import            | ADMIN, CHAIR, RA      |

#### Holiday Management
| Method | Endpoint              | Behavior                                   | Auth Required              |
| ------ | --------------------- | ------------------------------------------ | -------------------------- |
| GET    | `/holidays`           | List holidays. Filters: `year`, `from`, `to` | ADMIN, CHAIR, RA         |
| POST   | `/holidays`           | Create holiday (409 if date exists)         | ADMIN, CHAIR, RA          |
| PATCH  | `/holidays/:id`       | Update holiday (409 if duplicate date)      | ADMIN, CHAIR, RA          |
| DELETE | `/holidays/:id`       | Delete holiday                              | ADMIN, CHAIR, RA          |

#### Reports
| Method | Endpoint                          | Behavior                                    | Auth Required |
| ------ | --------------------------------- | ------------------------------------------- | ------------- |
| GET    | `/reports/academic-years`         | List available academic year/term options   | None          |
| GET    | `/reports/academic-year-summary`  | Aggregated metrics for selected term(s)     | None          |

#### Archives & Archived Projects
| Method | Endpoint                           | Behavior                                    | Auth Required         |
| ------ | ---------------------------------- | ------------------------------------------- | --------------------- |
| GET    | `/projects/archived`               | Fetch archived projects (CLOSED/WITHDRAWN). Filters: `status`, `reviewType`, `college`, `search`, `page`, `pageSize` | None                  |
| POST   | `/projects/with-submission`        | Create project with initial submission      | CHAIR, RA, ADMIN      |

### Background Jobs / Cron / Queues

**None implemented.** All operations are synchronous request-response. Potential future needs:
- SLA violation notification jobs
- Automated reminder emails
- Audit log archival

---

## 6. Frontend

### Routing Structure

```typescript
// frontend/src/App.tsx
<Routes>
  <Route path="/" element={<Navigate to="/login" replace />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
  <Route element={<ProtectedRoute><DashboardShell /></ProtectedRoute>}>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/queues/:queueKey" element={<QueuePage />} /> // classification / under-review / revisions
    <Route path="/holidays" element={<HolidaysPage />} />
  </Route>
  <Route path="/projects/new" element={<ProtectedRoute><NewProtocolPage /></ProtectedRoute>} />
  <Route path="/imports/projects" element={<ProtectedRoute><ImportProjectsPage /></ProtectedRoute>} />
  <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
  <Route path="/archives" element={<ProtectedRoute><ArchivesPage /></ProtectedRoute>} />
  <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
  <Route path="/submissions/:submissionId" element={<ProtectedRoute><SubmissionDetailPage /></ProtectedRoute>} />
</Routes>
```

### Key Pages & Their API Calls

| Page                    | Purpose                              | API Endpoints Used                              |
| ----------------------- | ------------------------------------ | ----------------------------------------------- |
| `LoginPage`             | User authentication                  | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, `POST /auth/logout` |
| `ForgotPasswordPage`    | Password reset placeholder           | None yet                                         |
| `NewProtocolPage`       | Create new project with submission (24 fields, 2-step flow) | `POST /projects/with-submission`, `GET /committees` |
| `ImportProjectsPage`    | Bulk CSV project/submission import   | `POST /api/imports/projects/preview`, `POST /api/imports/projects`, `GET /api/imports/projects/template` |
| `ArchivesPage`          | View archived/completed projects (3 filters: Status, Review Type, College) | `GET /projects/archived`, `GET /dashboard/colleges` |
| `DashboardPageNew`      | Dashboard overview page              | `/dashboard/queues`, `/dashboard/activity`, `/dashboard/overdue`, `/dashboard/colleges`, `/projects/search` |
| `QueuePage`             | Individual queue view                | `/dashboard/queues` (filtered by queue key) |
| `HolidaysPage`          | Calendar-based holiday management    | `GET/POST/PATCH/DELETE /holidays` |
| `ReportsPage`           | Academic year summary reports (`All Academic Years` supported) | `/reports/academic-years`, `/reports/academic-year-summary` |
| `ProjectDetailPage`     | Project details, protocol profile & letter export | `/projects/:id/full`, `/projects/:id/profile`, `/mail-merge/*`, `/letters/*` |
| `SubmissionDetailPage`  | Submission details, editing, timeline| `/submissions/:id`, `/submissions/:id/sla-summary`, `/committees`, `PATCH /submissions/:id/overview` |

### State Management Approach

- **No global state library** (no Redux, Zustand, etc.)
- **React hooks pattern**: Custom hooks (`useDashboardQueues`, `useSubmissionDetail`, etc.) encapsulate data fetching with `useState`/`useEffect`
- **URL-based state**: Filter selections stored in URL query params
- **Local storage**: Dashboard preferences (collapsed panels, density)

### Forms & Validation Strategy

- **Controlled inputs**: Form state managed via `useState`
- **Client-side validation**: Basic required field checks before submission
- **Server-side validation**: Express handlers validate enum values, required fields
- **No form library**: No Formik, React Hook Form, or Zod integration

---

## 7. Security & Privacy Checklist

### Authentication Method

| Aspect               | Current State                                            | Risk Level |
| -------------------- | -------------------------------------------------------- | ---------- |
| Auth mechanism       | JWT access token (`Authorization: Bearer`) + refresh token cookie | MEDIUM     |
| Session management   | Stateless access token + rotating refresh token endpoint | MEDIUM     |
| Password storage     | `passwordHash` actively validated via bcryptjs           | LOW        |
| Token refresh        | Implemented at `POST /auth/refresh`                      | LOW        |

### RBAC/Authorization Approach

- **Middleware implemented**: `authenticateUser`, `requireUser`, `requireRoles`
- **Role definitions**: 6 roles defined in enum (CHAIR, MEMBER, RA, RA_ASST, REVIEWER, ADMIN)
- **Endpoint protection**: Applied on sensitive/report endpoints; verify route-by-route during hardening
- **Field-level access**: Utility functions exist but not fully wired

### Input Validation & Sanitization

| Location                    | Validation Type                          |
| --------------------------- | ---------------------------------------- |
| Route handlers              | Basic required field checks, enum validation |
| CSV import (seed.ts)        | `safeTrim`, date parsing, enum mapping   |
| CSV export (mailMergeRoutes)| `csvEscape` for special characters       |
| Frontend forms              | Controlled inputs, basic validation      |

**Gap:** No comprehensive XSS/injection sanitization library (e.g., DOMPurify, validator.js)

### File Upload / CSV Import Threat Notes

- **CSV seed parsing**: Reads external file directly, minimal sanitization
- **Document links**: Stored as URLs (e.g., Google Drive), not file uploads
- **DOCX generation**: Built server-side with `docx` library, controlled content
- **No file upload endpoint exists** (future risk if added)

### Logging/Auditing Approach

- **Structured request logging** with `pino-http` + request IDs
- **Central error middleware** (`errorHandler`) normalizes API errors
- **Audit log model designed** in SECURITY.md but business-level audit trails are still partial

### Obvious Secret Exposure Risks

- No hardcoded secrets found in source code
- `DATABASE_URL` must be in `.env` (not checked into repo)
- `.env.example` exists at repo root with placeholder values for `DATABASE_URL`, `PORT`, `CORS_ORIGINS`, `FRONTEND_URL`

---

## 8. Testing & Quality

### Existing Tests

| Path                                              | Type        | Description                                |
| ------------------------------------------------- | ----------- | ------------------------------------------ |
| `backend/tests/unit/projectCsvImport.test.ts`     | Unit        | CSV parsing and validation tests           |
| `backend/tests/unit/overdueClassifier.test.ts`    | Unit        | Overdue severity classification tests      |
| `backend/tests/unit/dashboardFilters.test.ts`     | Unit        | Prisma where-clause builder tests          |
| `backend/tests/unit/workingDays.test.ts`          | Unit        | Business day calculation tests             |
| `backend/tests/unit/academicTerms.test.ts`        | Unit        | Academic term helper tests                 |
| `backend/tests/unit/reportMetrics.test.ts`        | Unit        | Report aggregation logic tests             |
| `backend/tests/unit/holidayDate.test.ts`          | Unit        | Holiday date helper tests                  |
| `backend/tests/integration/importProjects.test.ts`| Integration | Project CSV import flow tests              |
| `backend/tests/integration/projectCreate.test.ts` | Integration | Project creation service tests             |
| `backend/tests/api/holidayRoutes.test.ts`         | API         | Holiday CRUD endpoint tests                |
| `backend/tests/api/reportRoutes.test.ts`          | API         | Report endpoint tests                      |

### How to Run Tests

```bash
cd backend
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests
npm run test:api      # API tests
```

### Lint/Format Hooks

- **ESLint**: Configured for frontend (`frontend/package.json` has `lint` script)
- **Prettier**: Not found in config
- **Husky/lint-staged**: Not configured (no pre-commit hooks)

### Coverage Gaps (Inferred)

1. **No frontend tests**: No test files in `frontend/src`
2. **No E2E tests**: No Playwright, Cypress, or similar
3. **Limited API test coverage**: Only security tests found
4. **CI exists, but scope is still limited**: GitHub Actions runs backend/frontend checks, but no E2E suite yet

---

## 9. Current Known Issues / TODO Extraction

### TODO/FIXME Comments

| File                              | Line | Comment                                              |
| --------------------------------- | ---- | ---------------------------------------------------- |
| `ForgotPasswordPage.tsx`          | 20   | `TODO: Replace with actual API call`                 |

### Likely Fragile Modules

| Module                    | Reason                                          | File Reference                    |
| ------------------------- | ----------------------------------------------- | --------------------------------- |
| `DashboardPageNew.tsx`    | Still carries overview orchestration; further extraction possible | `frontend/src/pages/DashboardPageNew.tsx` |
| `SubmissionDetailPage.tsx`| High-density editing UI + workflow transitions  | `frontend/src/pages/SubmissionDetailPage.tsx` |
| `dashboardRoutes.ts`      | Route contains queue/activity/overdue/college concerns | `backend/src/routes/dashboardRoutes.ts` |
| `mailMergeRoutes.ts`      | Multiple endpoints + formatting/export logic    | `backend/src/routes/mailMergeRoutes.ts` |
| `seed.ts`                 | 1,423 lines, complex CSV parsing                | `backend/src/config/seed.ts`     |
| Dev auth fallback         | Header/env bypass can diverge from production auth behavior | `backend/src/middleware/auth.ts` |
| SLA/report date mapping   | Date source inference is nuanced and easy to regress | `backend/src/services/reports/reportMetrics.ts` |

### Technical Debt Observations

1. **Large files**: Multiple files exceed 500 lines, violating single-responsibility
2. **Dual auth paths**: JWT path and dev fallback path both exist and must be tested separately
3. **Hardcoded IDs**: `createdById: 1` style writes still exist in selected handlers
4. **No API versioning**: Routes at root, no `/api/v1` prefix
5. **Mixed concerns**: Route files contain business logic, should extract to services
6. **Partial testing depth**: CI runs now exist, but frontend + E2E coverage is still missing

---

## 10. Consultant-Ready "Next Questions"

### High Priority (Security/Architecture)

1. **Should dev auth fallback be disabled in staging/prod-like environments?** (`X-User-*`, `DEV_USER_*`)
2. **What is the user provisioning process?** (Manual creation, SSO sync?)
3. **Are there compliance requirements?** (Data retention, audit trail mandates?)
4. **What is the expected concurrent user load?** (Sizing for database/server)
5. **What is the rollout/rotation policy for JWT secrets?**

### Medium Priority (Functionality)

6. **How should SLA deadlines handle holidays?** (The `Holiday` table exists but isn't used)
7. **What email service will send notifications?** (SMTP, SendGrid, etc.)
8. **Are there other committees beyond RERC-HUMAN?** (Multi-committee support is modeled)
9. **What reports do chairs/admins need beyond the dashboard?**
10. **How should the letter templates be managed?** (Hardcoded vs. admin-configurable)

### Data & Integration

11. **Is there existing data to migrate beyond the sample CSV?**
12. **Does this system need to integrate with other university systems?** (HRMS, LMS, etc.)
13. **What is the document storage strategy?** (Currently just URLs, need upload?)
14. **How should continuing reviews be scheduled and reminded?**
15. **What happens when a project approval period expires?**

### Process Clarification

16. **What is the exact workflow for full-board reviews?** (Meeting scheduling, voting)
17. **How are reviewer honoraria processed?** (Model exists, process unclear)
18. **What defines "completeness" for a submission?** (Checklist, documents?)
19. **Who can reassign submissions to different staff?**
20. **What audit records must be retained and for how long?**

---

## Appendix A: Quick Reference Commands

```bash
# Start development (both servers)
npm run dev

# Backend only
npm run dev:backend

# Frontend only  
npm run dev:frontend

# Database commands
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run migrations
npm run db:seed        # Seed database

# Open Prisma Studio (DB GUI)
cd backend && npx prisma studio

# Run tests
cd backend && npm test
```

---

## Appendix C: Recent Changes

### February 15, 2026

#### Premium UI Overhaul
- **Design Token System** — 4-level shadow elevation (`--shadow-xs/sm/md/lg`), semantic badge tokens (20+ hardcoded colors extracted to `--badge-*-bg/fg/border` and `--role-*-bg/fg` variables), `--spacing-*` scale
- **Font Preconnect** — Added Google Fonts preconnect links in `index.html`; removed font-family override from dashboard CSS
- **Frosted-Glass Sidebar** — `backdrop-filter: blur()` on `DashboardSidebar`
- **Hover Elevation** — Cards gain shadow depth on hover
- **Skeleton Shimmer** — Re-enabled loading shimmer animations
- **Staggered Entrance Animations** — Dashboard cards fade in with cascading delays
- **3-Tier Click Feedback** — `:active` press states on 30+ interactive elements (buttons, cards, pagination, etc.) with scale values: small 0.90–0.96, medium 0.97, large 0.985, full-width: background darken
- **Button Normalize** — `:active` scale + consistent transition tokens across all button variants

#### Dashboard Filters Fix
- **Root Cause**: Database had NULL values for `piAffiliation`, `researchTypePHREB`, and zero `Classification` records. Seed script's `findFirst` searched for `submissionType: "INITIAL"` but existing submissions had `null` submissionType.
- **Fix**: Removed `submissionType` condition from seed's `findFirst` query. Re-seeded: 132/133 projects populated, 107 classifications created.
- **College Filter Upgrade**: Converted college text input to `<select>` dropdown populated by new `GET /dashboard/colleges` endpoint. Added case-insensitive matching in `dashboardFilters.ts`.

#### Archive Page Filters
- Added 3 server-side filter dropdowns to Archives page: **Status** (Closed/Withdrawn), **Review Type** (Exempt/Expedited/Full Board), **College** (dynamic from DB)
- "Clear filters" button appears when any filter is active
- Backend `GET /projects/archived` now accepts `status`, `reviewType`, `college` query params
- College uses case-insensitive match; ReviewType filters through classification relation

#### Files Changed (14 files, 469 insertions, 120 deletions)
| File | Change |
|------|--------|
| `frontend/index.html` | Added font preconnect links |
| `frontend/src/App.tsx` | Copyright year 2025→2026 |
| `frontend/src/styles/globals.css` | Shadow system, badge tokens, spacing scale, :active states |
| `frontend/src/styles/dashboard.css` | Frosted sidebar, shimmer, staggered animations, hover elevation, press states |
| `frontend/src/styles/archives.css` | Filter row, dropdown, clear button, responsive styles |
| `frontend/src/styles/protocol-profile.css` | Transition normalization |
| `frontend/src/styles/new-protocol.css` | Transition normalization |
| `frontend/src/components/DashboardFilters.tsx` | College text→dropdown, `fetchColleges()` import |
| `frontend/src/pages/ArchivesPage.tsx` | 3 filter dropdowns, clear button |
| `frontend/src/services/api.ts` | `fetchColleges()`, updated `fetchArchivedProjects` params |
| `backend/src/config/seed.ts` | Removed `submissionType: INITIAL` filter |
| `backend/src/routes/dashboardRoutes.ts` | Added `GET /dashboard/colleges` endpoint |
| `backend/src/routes/projectRoutes.ts` | Archive filters: status, reviewType, college |
| `backend/src/utils/dashboardFilters.ts` | Case-insensitive college filter |

---

### March 2, 2026

#### Authentication + Security Hardening
- JWT auth flow is now active end-to-end:
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- `AuthContext` stores/refreshes access token and uses refresh cookie fallback on expiry
- `authenticateUser` now validates bearer tokens first; dev header/env fallback remains non-production only
- Added rate limiting:
- Global limiter on all requests
- Strict auth limiter (`/auth/*`: 5 attempts per 60 seconds)
- Added structured request logging via `pino-http` and request IDs
- Added centralized error middleware (`errorHandler`)

#### Queue Navigation UX (Route-Driven)
- Sidebar queue tabs now route to dedicated queue pages:
- `/queues/classification`
- `/queues/under-review`
- `/queues/revisions`
- Each queue page has focused header, KPIs, queue-scoped filters, URL-persisted filter state, and dedicated table context (`You are viewing: ...`)
- Browser document title updates per queue page for clearer context

#### Reports Enhancements
- Added **All Academic Years** filter option to Reports page
- For `academicYear=ALL`, overview table/chart now aggregates **by academic year** (not by term)
- `reportRoutes.ts` now returns `academicYearVolume` for cross-year mode
- Seeded academic terms now cover a rolling 10-year span with explicit term windows:
- Term 1: September–December
- Term 2: January–April
- Term 3: May–August

#### Developer Experience / CI
- Added GitHub Actions CI pipeline (`.github/workflows/ci.yml`)
- Backend job: generate Prisma client, typecheck, build, unit tests
- Frontend job: typecheck, lint, production build
- README updated with default seeded credentials (`ra@example.com / changeme123` and demo users)

---

### March 3, 2026

#### Reports and Submission Detail Updates
- Reports backend aggregation moved to `backend/src/services/reports/reportService.ts` and routes now consume the service for summary/records payload generation.
- Comparative tables by proponent category were expanded and standardized:
- For `All Academic Years`, the table shows the configured cross-year matrix layout.
- For specific academic year filters, row coverage is now aligned with the all-years baseline college/service-unit rows so tables do not collapse to sparse subsets.
- Reports filter and summary card cleanup:
- Removed `UNCLASSIFIED` option from Type of Review filter.
- Removed `UNCLASSIFIED: n` subline under Total Proposals Received card.
- Submission records table updates:
- Added/retained `Department` column.
- Removed duplicate proponent category display to avoid redundant columns.

#### Protocol Profile Editing Enhancements
- In Protocol Profile edit mode, the following fields are now dropdowns:
- `Type of Review`
- `Proponent`
- `College`
- `Department`
- College dropdown is constrained to: `BAGCED`, `CCS`, `CLA`, `COS`, `GCOE`, `RVRCOB`, `OTHERS`.

#### UI Text Rendering Cleanup
- Fixed multiple UI locations where escaped unicode strings were being shown literally (e.g., `\u2013`, `\u2190`, `\u270e`, `\ud83d...`).
- Cleaned affected dashboard/submission screens:
- Pagination labels (`Showing 1–15`, `← Previous`, `Next →`)
- Empty-state icons for reviewer assignments/documents/edit history
- Submission Overview action label (`✎ Edit overview`)
- Various separators and fallback glyphs (`—`, `•`, `→`, `⚠`)

---

### February 13, 2026

#### Dashboard Queue Redesign
- **Route-driven queues** — Dashboard refactored from single mega-page to `DashboardShell` layout with `DashboardSidebar` + routed sub-pages (`/queues/:queueKey`)
- **DashboardShell.tsx** — New layout wrapper component (26 lines) using `<Outlet>`
- **DashboardSidebar.tsx** — Frosted-glass sidebar with queue navigation links (127 lines)
- **QueuePage.tsx** — Individual queue view page (137 lines)
- **DashboardPageNew.tsx** reduced from 2335→1515 lines through component extraction
- **Pagination** — `PAGE_SIZE=15` constant, stable table height with `min-height: 780px`

#### Protocol Profile Shared Component
- **ProtocolProfileSection.tsx** — New shared component (375 lines) for in-place editing of protocol profile fields
- Groups fields into "Core Information" and "Panel & Reviewers" with collapsible sections
- Supports inline editing with save/cancel, milestone CRUD
- Used in both `ProjectDetailPage` and `SubmissionDetailPage`

#### Create Protocol Form Expansion
- **NewProtocolPage.tsx** expanded from 331→580 lines
- Now covers 24 fields in a 2-step flow (basic info → detailed fields)
- Added fields: department, piAffiliation, researchTypePHREB, funding type, and more

#### Holidays Page
- **HolidaysPage.tsx** — New calendar-based holiday management page (629 lines)
- Full calendar grid with month navigation
- Inline CRUD: create, edit, delete holidays directly on the calendar
- Route: `/holidays` (inside DashboardShell)

#### Reports Page
- **ReportsPage.tsx** — Academic year summary reports page (535 lines)
- Backend: `reportRoutes.ts` (266 lines), `academicTerms.ts`, `reportMetrics.ts`
- New data model: `AcademicTerm` (migration `20260211120000_reports_terms`)

#### Protocol Profile & Milestones Data Model
- **ProtocolProfile** model — 50+ fields for denormalized protocol data (migration `20260212212000`)
- **ProtocolMilestone** model — Ordered milestone tracking per project
- `GET /projects/:id/profile`, `PUT /projects/:id/profile`
- `POST/PATCH/DELETE /projects/:id/profile/milestones/:mid`

#### New API Functions
- `fetchProtocolProfile()`, `updateProtocolProfile()`
- `createProtocolMilestone()`, `updateProtocolMilestone()`, `deleteProtocolMilestone()`
- `fetchHolidays()`, `createHoliday()`, `updateHoliday()`, `deleteHoliday()`
- `fetchReportAcademicYears()`, `fetchAcademicYearSummary()`

#### New TypeScript Types
- `ProtocolProfile`, `UpdateProtocolProfilePayload`
- `ProtocolMilestone`, `CreateProtocolMilestonePayload`, `UpdateProtocolMilestonePayload`
- `HolidayItem`, `CreateHolidayPayload`, `UpdateHolidayPayload`
- `ReportsAcademicYearOption`, `ReportsSummaryResponse`

#### New Tests
- `backend/tests/api/holidayRoutes.test.ts` — Holiday CRUD endpoint tests
- `backend/tests/api/reportRoutes.test.ts` — Report endpoint tests
- `backend/tests/unit/holidayDate.test.ts` — Holiday date helper tests
- `backend/tests/unit/academicTerms.test.ts` — Academic term tests
- `backend/tests/unit/reportMetrics.test.ts` — Report metrics tests

---

### February 10, 2026

#### New Features
- **New Protocol Page** (`/projects/new`) — Form to create new projects with initial submission
- **Archives Page** (`/archives`) — View archived/completed projects (CLOSED/WITHDRAWN status)
- **Project CSV Import Preview** — Two-step import flow with preview and column mapping validation
- **Archive API Endpoint** — `GET /projects/archived` for fetching completed protocols

#### New Components
- `RowErrorsTable.tsx` — Display import validation errors by row/field

#### New Backend Services
- `backend/src/services/imports/projectCsvImport.ts` — CSV parsing, validation, and column mapping (534 lines)
- `backend/src/services/projects/createProjectWithInitialSubmission.ts` — Service for creating projects with initial submission (180 lines)

#### New API Functions (Frontend)
- `createProjectWithInitialSubmission()` — Create project with first submission
- `fetchArchivedProjects()` — Fetch archived/completed projects with pagination and search

#### New TypeScript Types
- `ImportRowError`, `ImportResult`, `ProjectImportPreview` — Import-related types
- `CreateProjectPayload`, `CreateProjectResponse` — Project creation types
- `ArchivedProject`, `ArchivedProjectsResponse` — Archive page types

#### New Tests
- `backend/tests/unit/projectCsvImport.test.ts` — CSV parsing unit tests
- `backend/tests/integration/importProjects.test.ts` — Import flow integration tests
- `backend/tests/integration/projectCreate.test.ts` — Project creation integration tests

#### Files Changed/Added
| File | Change |
|------|--------|
| `frontend/src/pages/NewProtocolPage.tsx` | New page for creating protocols (331 lines) |
| `frontend/src/pages/ArchivesPage.tsx` | New page for viewing archives (261 lines) |
| `frontend/src/components/RowErrorsTable.tsx` | New component for import errors |
| `frontend/src/styles/new-protocol.css` | Styles for new protocol form |
| `frontend/src/styles/archives.css` | Styles for archives page |
| `frontend/src/services/api.ts` | Added `createProjectWithInitialSubmission`, `fetchArchivedProjects` |
| `frontend/src/types/index.ts` | Added archive and import types |
| `frontend/src/App.tsx` | Added routes for `/projects/new` and `/archives` |
| `backend/src/routes/importRoutes.ts` | Added `/preview` endpoint for CSV import |
| `backend/src/routes/projectRoutes.ts` | Added `/projects/archived` and `/projects/with-submission` |
| `backend/src/services/imports/projectCsvImport.ts` | New CSV import service |
| `backend/src/services/projects/createProjectWithInitialSubmission.ts` | New project creation service |

---

### February 11, 2026

#### Data Model Expansion (Documented Late)
- Added migration: `backend/prisma/migrations/20260210082226_update_schema`
- Expanded workflow support with new models for:
- `ClassificationVote`
- `ProjectStatusHistory`
- `ReviewAssignment`
- `SubmissionDecision`
- `SubmissionDocument`
- Added project governance/history models:
- `ProjectMember`
- `ProjectChangeLog`
- `ProjectSnapshot`
- `SubmissionChangeLog`
- Added proponent linkage models:
- `Proponent`
- `ProjectProponent`

#### Prisma Client Regeneration
- Generated Prisma client files under `backend/src/generated/prisma/` were updated to reflect the new schema.
- New generated model files include:
- `backend/src/generated/prisma/models/ClassificationVote.ts`
- `backend/src/generated/prisma/models/ProjectStatusHistory.ts`

#### Dependency/Lockfile Updates
- `backend/package-lock.json` updated with backend schema/client-related dependency state.
- `frontend/package-lock.json` updated as part of local dependency synchronization.

---

### February 12, 2026

#### Legacy CSV Compliance Direction (Approved; Implementation In Progress)
- **Compliance target selected:** normalized schema + computed/derived metrics (not literal 1:1 denormalized storage).
- **Legacy ambiguity policy:** preserve raw legacy values when mapping is uncertain.
- **Unknown status handling:** `Unknown` maps to safe normalized status and is flagged so it does not contaminate operational dashboards by default.
- **Deterministic clearance anchor:** clearance/issuance date is persisted as a workflow event (`CLEARANCE_ISSUED`).

#### Planned Schema Deltas (PR Spec Locked)
- Add `Submission.isLegacyAmbiguous` (`Boolean`, default `false`).
- Add `Submission.legacyStatusRaw` and `Submission.legacyReviewTypeRaw` (nullable strings).
- Add `FollowUpRequest` entity for post-approval tracking (Progress/Final/Amendment/Continuing) with cycle support.
- Add/extend enums for legacy mapping compatibility:
  - `FundingType.OTHER`
  - `ProponentCategory.STAFF`
  - `WorkflowEventType.CLEARANCE_ISSUED`
  - `ReviewerRoundRole.INDEPENDENT_CONSULTANT`
- Make `Holiday.date` date-only storage (`@db.Date`) and keep unique by date.

#### Idempotent Import Keys (Must-Have)
- `WorkflowEvent`: unique `(submissionId, eventType, cycleNumber)`.
- `FollowUpRequest`: unique `(projectId, type, cycleNumber)`.
- `ReviewAssignment`: unique `(submissionId, roundSequence, reviewerRole)` used for deterministic role-slot upserts.

#### Importer Behavior (Planned)
- Canonical header normalization for messy CSV headers (newline cleanup, dedupe, context-aware `# days` disambiguation).
- Table-driven value mapping for `Status`, `Funding`, `ProponentCategory`, and `ResearchTypePHREB`.
- Per-row transactional upsert with continue-on-error batch processing.
- Import report emits inserted/updated/failed counts and row-level reasons.

#### Reporting/Dashboard Guardrail (Planned)
- Dashboard and report queries will exclude `isLegacyAmbiguous=true` by default.
- Audit flows can opt in to include ambiguous legacy records explicitly.

---

### February 9, 2026

#### New Features
- **CSV Import Page** (`/imports/projects`) — Bulk import projects and submissions from CSV
- **Breadcrumbs Component** — Added navigation breadcrumbs for better wayfinding
- **Back Button Navigation** — Import page now has "Back to Dashboard" link

#### Bug Fixes
- **FormData Content-Type Fix** — Fixed CSV file upload by explicitly setting `multipart/form-data` header in axios request (was overriding with `application/json`)

#### Files Changed
| File | Change |
|------|--------|
| `frontend/src/components/Breadcrumbs.tsx` | New component for navigation breadcrumbs |
| `frontend/src/components/index.ts` | Export Breadcrumbs component |
| `frontend/src/pages/ImportProjectsPage.tsx` | Added breadcrumbs and back link |
| `frontend/src/services/api.ts` | Fixed `importProjectsCsv` Content-Type header |
| `frontend/src/styles/imports.css` | Added breadcrumb and back-link styles |

---

## Appendix D: Security Checklist Confirmation

- [x] **No real secrets/tokens in this document**
- [x] **DATABASE_URL shown as placeholder only**
- [x] **No real user emails or passwords exposed**
- [x] **Noted security gaps are design concerns, not exploits**

---

*Document updated March 2, 2026 by analyzing repository structure, source files, git history, and documentation. Some details are inferred where explicit documentation was incomplete.*
