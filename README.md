# rerc-review-portal
Web-based Research Ethics Review Committee (RERC) system for managing projects, submissions, reviews, and mail-merge letters.

## Prerequisites

- **Node.js + npm**
	- Recommended: Node 18+ (works with newer versions too).
	- Verify: `node -v` and `npm -v`
- **PostgreSQL** (local or remote)
	- Verify: `psql --version`

## Environment variables

The backend requires `DATABASE_URL`.

- Example file: `.env.example`
- Recommended: create `backend/.env` with something like:

```dotenv
DATABASE_URL=postgresql://USER@localhost:5432/rerc
PORT=3000
FRONTEND_URL=http://localhost:5173
```

The frontend optionally supports:

- `VITE_API_URL` (defaults to `http://localhost:3000`)

## Setup

### Quick start (repo root)

If you want a single entrypoint from the repo root:

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

### 1) Install dependencies

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd ../frontend
npm install
```

### 2) Set up the database (Prisma)

Make sure Postgres is running and `DATABASE_URL` points to a reachable database.

Apply migrations and generate the Prisma client:

```bash
cd ../backend
npx prisma generate
npx prisma migrate deploy
```

Optional seed (if the project has seed data configured):

```bash
npm run seed
```

## Run (development)

### Option A: Two terminals (recommended)

Backend (API):

```bash
cd backend
npm run dev
```

Frontend (UI):

```bash
cd frontend
npm run dev
```

- Backend: http://localhost:3000
- Frontend: http://localhost:5173

### Option B: Single command (from repo root)

Requires `npx` (included with npm):

```bash
npx concurrently "npm --prefix backend run dev" "npm --prefix frontend run dev"
```

## Quick checks

- Backend health: http://localhost:3000/health
- Frontend should load: http://localhost:5173
