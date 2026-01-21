# AI Workflow (Gemini + Codex)

This folder is the “handoff layer” between planning/review (Gemini) and execution (Codex).
Goal: reduce context drift, keep decisions consistent, and make changes auditable.

## Roles

* **Gemini (Planner/Reviewer)**

  * Writes/updates: `context.md`, `plan.md`, `tasks.md`
  * Focus: UX critique, architecture decisions, acceptance criteria
  * Does **not** directly edit code (treat any code it outputs as a proposal only)

* **Codex (Implementer/Integrator)**

  * Reads: `context.md`, `plan.md`, `tasks.md`
  * Edits: project code in `backend/`, `frontend/`, etc.
  * Updates: `decisions.md` after completing tasks
  * Does **not** invent new scope unless written into `tasks.md`

## Files

* `context.md`
  Project snapshot: repo structure, stack, commands, constraints, conventions.

* `plan.md`
  What we are changing and why (high-level). No code. No step-by-step.

* `tasks.md`
  Ordered task list for implementation. Each task must be atomic and testable.

* `decisions.md`
  Append-only log of changes made, rationale, and any follow-ups.

## Task Format (required)

Each task in `tasks.md` must include:

* **Title**
* **Scope / Files touched**
* **Steps (short)**
* **Acceptance checks** (how to verify)
* **Risk / rollback note** (if relevant)

Example:

* TASK 1: Normalize dashboard spacing

  * Files: `frontend/...`
  * Steps: apply spacing tokens; remove ad-hoc margins
  * Checks: layout matches design; no overflow at 1440px and 768px

## Workflow

1. Update `context.md` if repo commands/constraints changed.
2. Gemini writes/updates `plan.md`.
3. Gemini converts `plan.md` → `tasks.md`.
4. Codex implements tasks in order.
5. After each task, Codex:

   * runs lint/typecheck/tests if available
   * updates `decisions.md`
   * commits changes (small commits)
6. Gemini reviews results and outputs a small delta list (as new tasks).

## Guardrails

* No secrets in `ai/` (no tokens/keys).
* No large dumps/screenshots in `ai/` (keep it lightweight).
* No new dependencies unless explicitly approved in `tasks.md`.
* Prefer small, reversible changes.
