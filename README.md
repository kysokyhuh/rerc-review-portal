# RERC Review Portal

RERC Review Portal is a full-stack research ethics review management system designed for Research Ethics Review Committees that need a structured, auditable way to manage protocols from intake through review, reporting, archiving, and recovery.

**Live Application:** [https://rerc-review-portal.onrender.com](https://rerc-review-portal.onrender.com)

The portal centralizes protocol submissions, review classification, reviewer assignments, SLA tracking, document workflows, CSV imports, reports, user approvals, and soft-delete recovery. It is built as a React/Vite single-page application served by an Express API, with PostgreSQL managed through Prisma migrations.

## Project Status

| Item | Details |
| --- | --- |
| Application | Research ethics review and protocol management portal |
| Deployment | Render Web Service, single-origin frontend and API |
| Database | PostgreSQL, tested with Neon |
| Production URL | [rerc-review-portal.onrender.com](https://rerc-review-portal.onrender.com) |
| Primary Users | Chair, Admin, Research Associate, Research Assistant, Reviewer |
| Repository Branch | `main` |

## Contents

- [Project Status](#project-status)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Setup](#local-setup)
- [Development](#development)
- [Database Operations](#database-operations)
- [Testing and Build Checks](#testing-and-build-checks)
- [Deployment](#deployment)
- [Operational Notes](#operational-notes)
- [Project Structure](#project-structure)

## Features

- End-to-end protocol and submission tracking with status-driven workflows
- Role-based access for Chair, Admin, Research Associate, Research Assistant, and Reviewer users
- Account signup, approval, rejection, activation, disablement, and password reset workflows
- Secure cookie-based authentication with forced password-change support
- Classification controls, reviewer assignments, SLA tracking, reminders, and audit history
- CSV import tooling for legacy or bulk project data
- Mail merge and letter generation support
- Reports, archives, Recently Deleted, restore, and soft-delete recovery workflows
- Render free-tier cold-start handling through dedicated liveness and readiness endpoints

## Architecture

| Layer | Technology | Notes |
| --- | --- | --- |
| Frontend | React 18, Vite, TypeScript | SPA built into `frontend/dist` |
| Backend | Express 5, TypeScript | Serves API routes and the production frontend bundle |
| Database | PostgreSQL | Prisma ORM and forward-only migrations |
| Auth | JWT cookies | Access/refresh secrets configured by environment |
| Testing | Jest, Supertest | Backend API/unit/integration tests |
| Deployment | Render Web Service | Single-origin deployment for frontend and API |

In production, the backend serves the compiled frontend from `frontend/dist`. This keeps the app same-origin, which is important for cookie-based auth on free hosting.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 15 or newer, or a hosted PostgreSQL database such as Neon

Check your local versions:

```bash
node -v
npm -v
psql --version
```

## Environment Variables

Create the backend environment file from the example:

```bash
cp .env.example backend/.env
```

Required production variables:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. Use a direct Neon URL for migrations. |
| `JWT_ACCESS_SECRET` | Yes | Secret for access-token signing. |
| `JWT_REFRESH_SECRET` | Yes | Secret for refresh-token signing. |
| `APP_BASE_URL` | Recommended | Public app URL, for example `https://rerc-review-portal.onrender.com`. |
| `CORS_ORIGINS` | Recommended | Comma-separated allowed browser origins. For same-origin Render deploys, use the public app URL. |

Common optional variables:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Backend HTTP port. |
| `NODE_ENV` | `development` | Use `production` in deployed environments. |
| `JWT_ISSUER` | `urerb-review-portal` | JWT issuer claim. |
| `JWT_AUDIENCE` | `urerb-review-portal-users` | JWT audience claim. |
| `VITE_API_URL` | local API or current origin | Frontend API base URL. In same-origin production this can be omitted. |
| `DEV_HEADER_AUTH` | `false` | Enables local/test-only debug auth headers. Do not enable in production. |
| `IMPORT_MAX_ROWS` | `5000` | Maximum rows per CSV import. |
| `IMPORT_BATCH_SIZE` | `250` | CSV import batch size. |
| `SEED_CHAIR_PASSWORD` | `changeme123` | Seed password for the Chair account. |
| `SEED_ASSOC_PASSWORD` | `changeme123` | Seed password for the Research Associate account. |
| `SEED_ASSIST_PASSWORD` | `changeme123` | Seed password for the Research Assistant account. |

Generate strong JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Local Setup

Install dependencies from the repository root:

```bash
npm install
npm run install:all
```

Generate the Prisma client, apply migrations, and seed base users:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Start the full local stack:

```bash
npm run dev
```

Default local URLs:

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend API | `http://localhost:3000` |
| Health | `http://localhost:3000/health` |
| Liveness | `http://localhost:3000/live` |
| Readiness | `http://localhost:3000/ready` |

Seeded accounts:

| Email | Role | Password source |
| --- | --- | --- |
| `chair@urerb.com` | Chair | `SEED_CHAIR_PASSWORD` |
| `assoc@urerb.com` | Research Associate | `SEED_ASSOC_PASSWORD` |
| `assist@urerb.com` | Research Assistant | `SEED_ASSIST_PASSWORD` |

If seed password variables are not set, each account defaults to `changeme123`.

## Development

Run frontend and backend together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:backend
npm run dev:frontend
```

Useful package-level commands:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
npm --prefix backend run seed
npm --prefix frontend run lint
```

## Database Operations

Generate Prisma client:

```bash
npm run db:generate
```

Apply committed migrations:

```bash
npm run db:migrate
```

Seed base data:

```bash
npm run db:seed
```

Seed or repair academic terms only:

```bash
npm --prefix backend run seed:academic-terms
```

Run the admin soft-delete fallback from a machine with `DATABASE_URL` configured:

```bash
npm --prefix backend run admin:delete-project -- --submission-id 512 --reason "Administrative cleanup" --apply
```

The admin delete script supports `--submission-id` or `--project-id`. Without `--apply`, it performs a dry run.

## Testing and Build Checks

Frontend build:

```bash
npm --prefix frontend run build
```

Backend TypeScript build:

```bash
npm --prefix backend run build:server
```

Backend tests:

```bash
npm --prefix backend test
```

Targeted API test example:

```bash
npm --prefix backend test -- --runInBand backend/tests/api/healthRoutes.test.ts
```

Full production-style backend build:

```bash
npm --prefix backend run build
```

This command also installs and builds the frontend because production Express serves the compiled SPA.

## Deployment

The current Render blueprint deploys a single Web Service named `rerc-review-portal`.

Render reads [`render.yaml`](./render.yaml), which configures:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Region | Singapore |
| Plan | Free |
| Build command | `cd backend && npm ci --include=dev && npx prisma generate && npm run build` |
| Pre-deploy command | `cd backend && npx prisma migrate deploy` |
| Start command | `cd backend && node dist/server.js` |
| Health check path | `/live` |

### Recommended Free-Tier Setup

1. Create a Neon PostgreSQL database.
2. Copy the direct PostgreSQL connection string.
3. Create a Render Blueprint from this repository.
4. Set the Render Web Service environment variables:
   - `DATABASE_URL`
   - `APP_BASE_URL`
   - `CORS_ORIGINS`
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
5. Let Render run the build and pre-deploy migration.
6. Seed initial users once from your local machine:

```bash
cd backend
DATABASE_URL="<direct Neon connection string>" npx prisma generate
DATABASE_URL="<direct Neon connection string>" npm run seed
```

### Render Free-Tier Behavior

Render free instances spin down after inactivity. The app includes:

- `/live` for lightweight liveness checks
- `/ready` for database readiness checks
- frontend cold-start messaging
- guarded retries for safe requests
- delete/archive actions that wait for backend readiness before mutating data

Mutating requests are not blindly replayed. This prevents duplicate or stale writes during a cold start.

## Operational Notes

### Auth and Account Approval

1. New users sign up with basic profile and password fields.
2. Accounts are created as pending and inactive.
3. Chair/Admin users approve, reject, enable, disable, or assign roles.
4. Only approved and active accounts can sign in.
5. Admin password resets can force the user through `/change-password`.

### Recently Deleted

Deleting a protocol soft-deletes the project and moves it to Recently Deleted for 30 days. During that window:

- the protocol is read-only
- users can restore it from Recently Deleted
- expired deleted records can be purged by the backend logic
- the admin delete script can be used as a database-level fallback when the free-tier web service is unavailable

### CSV Imports

CSV imports are handled by the backend in validated batches. Import limits are controlled by the `IMPORT_*` environment variables. Imported records become normal database records and are still managed through the same project, submission, delete, restore, and reporting workflows.

### Rollback

- Application rollback: redeploy a previous successful Render deploy.
- Database rollback: Prisma migrations are forward-only. Write a new corrective migration or perform a controlled manual database repair.
- Data repair: prefer targeted scripts in `backend/src/scripts` over ad hoc database edits.

## Project Structure

```text
.
|-- backend/
|   |-- prisma/                 Prisma schema and migrations
|   |-- src/
|   |   |-- config/             Database, logger, auth, seed configuration
|   |   |-- middleware/         Auth, CSRF, validation, rate limits, errors
|   |   |-- routes/             Express route modules
|   |   |-- schemas/            Zod request schemas
|   |   |-- scripts/            Operational and repair scripts
|   |   `-- services/           Business logic
|   `-- tests/                  Jest tests
|-- frontend/
|   `-- src/
|       |-- components/         Reusable UI components
|       |-- contexts/           React context providers
|       |-- hooks/              Data and UI hooks
|       |-- pages/              Route-level pages
|       |-- services/           Axios API client
|       |-- styles/             CSS modules and global styles
|       `-- types/              Frontend TypeScript interfaces
|-- packages/shared/            Shared package placeholder
|-- render.yaml                 Render deployment blueprint
|-- .env.example                Environment reference
`-- package.json                Root development scripts
```
