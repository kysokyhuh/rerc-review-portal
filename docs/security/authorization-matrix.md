# Authorization Matrix

This matrix captures the current backend-enforced route families that should be reviewed during go-live security testing.

## Route Families

| Area | Primary Routes | Backend Guard | Notes |
|------|----------------|---------------|-------|
| Auth session | `/auth/signup`, `/auth/login`, `/auth/me`, `/auth/logout`, `/auth/refresh`, `/auth/change-password` | cookie session + CSRF/origin on mutations | Signup/login are public but CSRF/origin protected; forced password change is authenticated-only |
| Dashboard | `/dashboard/*` | `requireUser` plus queue-specific filtering | Reviewer/staff visibility should be regression-tested per endpoint |
| Projects | `/projects/*` | `requireUser`, `requireProjectAccess`, or chair/associate write guards | Object-level reviewer access enforced on project detail routes |
| Submissions / reviews | `/submissions/*`, `/reviews/*` | route guards + reviewer-scope middleware | Test direct ID access with reviewer and non-reviewer roles |
| Reports | `/reports/*` | `requireAnyRole([CHAIR, RESEARCH_ASSOCIATE])` | Sensitive reporting routes are role-gated and audit logged |
| Mail merge / letters | `/mail-merge/*`, `/letters/*` | `requireAnyRole([CHAIR, RESEARCH_ASSOCIATE])` | Export/download routes are role-gated and audit logged |
| Imports | `/imports/projects/*` | `requireAnyRole([CHAIR, RESEARCH_ASSOCIATE])` | CSV preview/commit also enforce upload validation and content checks |
| Holidays | `/holidays/*` | holiday role set in route module | Validate non-chair/non-staff write attempts directly |
| Admin user management | `/admin/users*` | chair-only approval lifecycle, chair/admin manual reset | Approval, rejection, disable, enable, and role changes are chair-only; manual reset is chair/admin |

## Admin Account Controls

- Chair-only:
  - `POST /admin/users/:id/approve`
  - `POST /admin/users/:id/reject`
  - `POST /admin/users/:id/disable`
  - `POST /admin/users/:id/enable`
  - `PATCH /admin/users/:id`
- Chair or admin:
  - `POST /admin/users/:id/reset-password`

## Forced Password Change

Users with `forcePasswordChange=true` can authenticate, but backend middleware blocks application routes until they complete `POST /auth/change-password` or sign out.

## Go-Live Test Expectations

- Lower-privilege users cannot call chair-only admin routes directly.
- Reviewers cannot read unassigned project/submission records by changing IDs.
- Report and mail-merge endpoints reject users outside `CHAIR` and `RESEARCH_ASSOCIATE`.
- Public auth routes require a trusted origin plus a matching CSRF token.
- Protected write routes require both a valid session and CSRF token, even if the UI hides the action.
- Admin users can manually reset approved accounts but cannot approve, reject, disable, enable, or change roles.
