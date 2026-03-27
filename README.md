# rerc-review-portal

Web-based Research Ethics Review Committee (RERC) system for managing projects, submissions, reviews, and mail-merge letters.

## Prerequisites

- **Node.js 20+** — `node -v`
- **npm 10+** — `npm -v`
- **PostgreSQL 15+** (local or Neon free tier) — `psql --version`

## Environment Variables

Copy the example file and fill in real values:

```bash
cp .env.example backend/.env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string. For the first Render + Neon deploy, use the direct Neon URL. |
| `JWT_ACCESS_SECRET` | **Yes** | — | 48-byte hex string for access tokens |
| `JWT_REFRESH_SECRET` | **Yes** | — | 48-byte hex string for refresh tokens |
| `JWT_ISSUER` | No | `urerb-review-portal` | JWT issuer claim |
| `JWT_AUDIENCE` | No | `urerb-review-portal-users` | JWT audience claim |
| `PORT` | No | `3000` | Backend HTTP port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `DEV_HEADER_AUTH` | No | `false` | Enables `x-user-*` debug headers only in local development/test |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated allowed origins |
| `VITE_API_URL` | No | `http://localhost:3000` | Frontend → API base URL (build-time) |
| `SEED_CHAIR_PASSWORD` | No | `changeme123` | Seed password for `chair@urerb.com` |
| `SEED_ASSOC_PASSWORD` | No | `changeme123` | Seed password for `assoc@urerb.com` |
| `SEED_ASSIST_PASSWORD` | No | `changeme123` | Seed password for `assist@urerb.com` |

Generate JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## MVP Auth Flow

The current MVP uses simple password auth plus chair review:

1. A user signs up with first name, last name, email, password, and confirm password.
2. The backend creates the account as `PENDING` and inactive.
3. A `CHAIR` reviews the request and can approve, reject, disable, enable, or assign the final role.
4. Only `APPROVED` + active users can sign in.
5. Password recovery is internal-only in this MVP: `CHAIR` and `ADMIN` can set a temporary password, and the user is forced to change it on next login.

## Setup

### Quick start (repo root)

```bash
npm install
npm run install:all
npm run db:generate
npm run db:migrate
npm run dev
```

This starts:

- Backend: http://localhost:3000
- Frontend: http://localhost:5173

### Step-by-step

```bash
# 1. Backend
cd backend && npm install
npm run setup          # pushes DB schema + seeds demo users

# 2. Frontend
cd ../frontend && npm install

# 3. Shared package (optional)
cd ../packages/shared && npm install
```

### Default login credentials

After running `npm run setup`, the following accounts are seeded:

| Email | Password Env | Role |
| --- | --- | --- |
| chair@urerb.com | `SEED_CHAIR_PASSWORD` | Chair |
| assoc@urerb.com | `SEED_ASSOC_PASSWORD` | Research Associate |
| assist@urerb.com | `SEED_ASSIST_PASSWORD` | Research Assistant |

## Development

### Option A: Two terminals (recommended)

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

### Option B: Single command

```bash
npm run dev    # uses concurrently
```

### Quick checks

- Backend health: http://localhost:3000/health
- Frontend: http://localhost:5173

### Lint & typecheck

```bash
# Frontend
cd frontend && npm run lint && npx tsc --noEmit

# Backend
cd backend && npx tsc --noEmit && npm test
```

## CI/CD

GitHub Actions runs on every push/PR to `main` (see `.github/workflows/ci.yml`):

| Job | Steps |
|-----|-------|
| **backend** | Install → Prisma generate → TypeScript check → Build → Test |
| **frontend** | Install → TypeScript check → Lint → Vite build |

## Deploy a Free Test Environment

The safest first live test for this repo is:

- **Neon Free** for PostgreSQL
- **Render Static Site** for the frontend
- **Render Web Service** for the backend

Do not use Cloudflare Pages for the first test run. The app currently uses secure cookie auth with `SameSite=Lax`, so a frontend on `*.pages.dev` talking to an API on `*.onrender.com` is a cross-site setup that is likely to break auth cookies.

### 1. Database — Neon

1. Create a free project at [neon.tech](https://neon.tech)
2. Copy the **direct** PostgreSQL connection string
3. Use that direct URL as `DATABASE_URL` for this first Render test deploy

### 2. Frontend + Backend — Render

1. In Render, create a **Blueprint** from this repo so Render reads [`render.yaml`](./render.yaml)
2. The blueprint creates:
   - `rerc-web` — static frontend
   - `rerc-api` — Node/Express backend
3. Initial environment setup:
   - `rerc-web`
     - `VITE_API_URL` — set a temporary value such as `https://placeholder.invalid` for the first deploy
   - `rerc-api`
     - `DATABASE_URL` — Neon direct connection string
     - `CORS_ORIGINS` — set this after the frontend URL exists
     - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — auto-generated by `render.yaml`
     - `JWT_ISSUER` / `JWT_AUDIENCE` — set by `render.yaml`
4. Render settings already included in the blueprint:
   - frontend build: `cd frontend && npm ci && npm run build`
   - frontend publish dir: `frontend/dist`
   - frontend SPA rewrite: `/* -> /index.html`
   - backend build: `cd backend && npm ci && npx prisma generate && npm run build`
   - backend pre-deploy migration: `cd backend && npx prisma migrate deploy`
   - backend health check: `/health`
   - backend region: Singapore
5. After the first deploy completes:
   - copy the frontend URL from `rerc-web`
   - set `CORS_ORIGINS=<frontend URL>` on `rerc-api`
   - copy the backend URL from `rerc-api`
   - set `VITE_API_URL=<backend URL>` on `rerc-web`
   - redeploy both services

### 3. Seed demo data

Render does not seed this app automatically. After the backend is live, run the seed once from your local machine against the deployed Neon database:

```bash
cd backend
npm ci
DATABASE_URL='<your direct Neon connection string>' npx prisma generate
DATABASE_URL='<your direct Neon connection string>' npm run seed
```

This seeds:

- `chair@urerb.com`
- `assoc@urerb.com`
- `assist@urerb.com`

If you did not override the seed env vars, all three default to `changeme123`.

### MVP Auth Checklist

Before go-live:

1. Sign up a new user and confirm the account is created as pending.
2. Approve that user from the chair account and assign the final role.
3. Confirm pending, rejected, disabled, and inactive accounts all fail login with the same public message.
4. Reset an approved user's password from the admin account-management screen and confirm the next login is forced through `/change-password`.

### Cold-start behavior

Render free tier sleeps after 15 minutes of inactivity. On the first request after sleeping:

- The API client automatically retries up to 3 times with backoff (1.5s, 3s, 6s)
- A toast notification ("Server waking up...") appears in the UI
- The toast auto-dismisses once the server responds

### Rollback

- **Render Static Site / Web Service**: redeploy a previous successful deployment from the dashboard
- **Database**: Prisma migrations are forward-only; keep migration SQL in repo for manual revert

## Project Structure

```
├── backend/           Express + Prisma API
│   ├── prisma/        Schema & migrations
│   ├── src/
│   │   ├── config/    Database, logger, seeding
│   │   ├── middleware/ Auth, validation, error handling
│   │   ├── routes/    Thin controllers
│   │   ├── services/  Business logic
│   │   └── schemas/   Zod validation schemas
│   └── tests/         Jest tests (unit, integration, API)
├── frontend/          React + Vite SPA
│   └── src/
│       ├── components/ Reusable UI (dashboard/, submission/, etc.)
│       ├── hooks/      TanStack Query hooks
│       ├── pages/      Route-level components
│       ├── services/   API client (Axios + interceptors)
│       └── types/      TypeScript interfaces
├── packages/shared/   Shared types & utilities
├── .github/workflows/ CI pipeline
├── render.yaml        Render deployment blueprint
└── .env.example       Environment variable reference
```
