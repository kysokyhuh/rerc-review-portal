# Fixes and integration notes

- Backend: APIs now mount under `/api`, static frontend serving removed, CORS configured via `CORS_ORIGINS`/`FRONTEND_URL`, and `/health` plus `/api/health` return service status.
- Frontend: API client reads `VITE_API_URL` with a `/api` default, routing cleaned up, and Vite env typings added to avoid runtime errors.
- Integration: local defaults are backend `http://localhost:3000/api` and frontend `http://localhost:5173`; configure `VITE_API_URL` and backend CORS to match deployed origins.
