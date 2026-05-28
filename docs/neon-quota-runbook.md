# Neon Free Plan Quota Runbook

Version: 1.0
Last updated: May 28, 2026
Applies to: RERC Review Portal production database on Neon
Primary project shown in console: `urerb-review-portal`

## 1. Purpose

This runbook explains what to do if the Neon database quota shown in the Neon Console gets close to the limit or runs out.

The RERC Review Portal uses PostgreSQL. In the current deployment, PostgreSQL is hosted on Neon. If Neon suspends the database because a Free plan limit is exhausted, the web app may still load, but pages that need database access will fail or keep loading.

Use this manual when the Neon dashboard shows high usage for:

- Compute
- Storage
- Network transfer

## 2. Current Free Plan Limits to Watch

As of May 28, 2026, Neon documents the Free plan as including:

| Usage Type | Free Plan Limit | What It Means for This Portal |
| --- | --- | --- |
| Compute | 100 CU-hours per project per month | Database work time. Heavy traffic, repeated queries, imports, and large reports consume this faster. |
| Storage | 0.5 GB per project | Total database size. Protocol records, account records, logs, imports, and history all count. |
| Public network transfer | 5 GB per month | Data sent from Neon to the app, admin tools, exports, backups, or other clients. |
| Branches | 10 branches per project | Extra database branches for previews/testing. Unused branches should be deleted. |

Official Neon references:

- Neon plans: https://neon.com/docs/introduction/plans
- Neon pricing: https://neon.com/pricing
- Network transfer guide: https://neon.com/docs/introduction/network-transfer

## 3. What the Screenshot Means

In the Neon dashboard screenshot:

| Metric | Screenshot Value | Status |
| --- | --- | --- |
| Compute | `0.96 / 100 CU-hrs` | Very low usage. No immediate risk. |
| Storage | `0.04 / 0.5 GB` | Low usage. No immediate risk. |
| Network transfer | `0.05 / 5 GB` | Low usage. No immediate risk. |

At that moment, the project is safe. The concern is future growth: more users, more protocols, more CSV imports, or repeated reports can increase usage.

## 4. What Happens If a Limit Runs Out

### If compute runs out

Neon can suspend the compute for the Free plan project when usage limits are reached. The portal will not be able to query the database until the limit resets or the Neon project is upgraded.

User-facing symptoms:

- Login may fail.
- Dashboard cards may not load.
- Protocol lists may stay empty or loading.
- Actions such as approve, assign, classify, save, archive, or restore may fail.
- Render logs may show database connection errors.

### If network transfer runs out

Neon documents that exceeding the Free plan network transfer allowance can suspend compute until the next billing cycle or until the project is upgraded.

User-facing symptoms are similar to compute exhaustion because the app cannot reliably read from the database.

### If storage runs out

Writes can fail or the project may require cleanup or upgrade before more data can be stored.

User-facing symptoms:

- New protocols may fail to save.
- CSV import may fail.
- Account approval or assignment changes may fail.
- Audit/history/reminder entries may fail to write.

## 5. Emergency Decision Tree

Use this when the portal is failing and Neon usage is high.

1. Open Neon Console.
2. Select the RERC project.
3. Check the dashboard usage panel:
   - Compute
   - Storage
   - Network transfer
4. If compute or network transfer is at or above the limit:
   - Upgrade Neon if the portal must be restored immediately.
   - Otherwise wait until the monthly billing cycle resets.
5. If storage is near or above the limit:
   - Do not run large imports.
   - Export a backup before deleting anything.
   - Remove unused branches.
   - Clean unnecessary test/demo data only if approved.
   - Upgrade if production data must be retained.
6. After recovery, open the Render app and test:
   - Login
   - Dashboard
   - A protocol detail page
   - A harmless read-only report

## 6. Immediate Recovery Options

### Option A: Upgrade Neon

Use this when the portal must stay available.

Steps:

1. Go to Neon Console.
2. Open the project.
3. Click Upgrade or open the billing/plan page.
4. Choose the paid plan approved by the organization.
5. Confirm billing details.
6. Wait for compute access to resume.
7. Restart the Render service if the app is still failing.
8. Test the portal.

When to choose this:

- The portal is being used for live operations.
- Chairs or staff need to approve, classify, or update protocols immediately.
- The quota will likely run out again before the month resets.

### Option B: Wait for monthly reset

Use this only when temporary downtime is acceptable.

Steps:

1. Confirm the issue is quota exhaustion, not an app bug.
2. Notify users that database quota is exhausted.
3. Pause portal operations.
4. Wait until the Neon billing cycle resets.
5. Test the app after reset.

When to choose this:

- The portal is only in testing or demo use.
- No urgent protocol work is needed.
- There is no approval to upgrade.

### Option C: Reduce usage and retry

Use this when the limit is not fully exhausted yet or when storage cleanup can create room.

Steps:

1. Stop nonessential activity:
   - CSV imports
   - repeated report refreshes
   - database exports
   - test scripts
2. Delete unused Neon branches.
3. Avoid opening many report/export pages repeatedly.
4. Check if storage or transfer drops enough to continue.

This option may not help if compute or transfer has already hard-stopped the Free plan until reset.

## 7. How to Monitor Neon Usage

### Console monitoring

1. Open https://console.neon.tech.
2. Select the organization.
3. Select the project.
4. Stay on Project dashboard.
5. Review:
   - Compute
   - Storage
   - Network transfer
6. Click View all metrics for more detail.

Recommended cadence:

| Situation | Check Frequency |
| --- | --- |
| Normal operations | Weekly |
| Before and after CSV import | Before import, after import |
| During demos/training | Daily |
| If compute exceeds 70 percent | Daily until stable |
| If storage exceeds 70 percent | Plan cleanup or upgrade |
| If network transfer exceeds 70 percent | Investigate reports, exports, and repeated queries |

### Thresholds

| Usage Level | Meaning | Action |
| --- | --- | --- |
| 0-50 percent | Healthy | Continue monitoring. |
| 50-70 percent | Watch zone | Avoid unnecessary imports/exports. |
| 70-90 percent | Risk zone | Notify maintainer and plan cleanup or upgrade. |
| 90-100 percent | Critical | Stop nonessential work and prepare upgrade. |
| 100 percent | Outage likely | Upgrade or wait for reset. |

## 8. Preventing Compute Exhaustion

Compute is consumed when the database is actively serving work. Neon uses the formula:

`CU-hours = compute size x hours running`

Practical actions:

- Keep the Free plan scale-to-zero behavior enabled.
- Avoid unnecessary scripts that constantly ping the database.
- Avoid refresh loops in admin pages.
- Do not run load tests against the production database.
- Avoid long-running SQL queries during office hours.
- Do CSV imports in small, planned batches.
- Investigate repeated dashboard/report requests if compute usage rises quickly.

Important note:

If a compute autoscales to a larger CU size, it consumes CU-hours faster than a small compute.

## 9. Preventing Storage Exhaustion

Storage grows when the database stores more records, history, branches, snapshots, or imports.

Practical actions:

- Delete unused Neon child branches.
- Do not keep test branches longer than needed.
- Avoid importing duplicate CSV data.
- Export a backup before any cleanup.
- Do not manually delete production data without Chair/owner approval.
- Review whether old test/demo records can be archived or removed.
- Monitor large tables such as imports, audit logs, status histories, documents, and protocol records.

Suggested SQL for checking largest tables:

```sql
SELECT
  schemaname,
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;
```

Use this only from a trusted SQL client connected to the correct database.

## 10. Preventing Network Transfer Exhaustion

Network transfer is data sent out of Neon to clients.

Common causes:

- Large report responses
- Exporting or dumping the database
- Repeated dashboard refreshes
- API endpoints returning too many rows
- Queries using `SELECT *`
- Missing pagination
- Logical replication or external sync jobs

Practical actions:

- Use pagination for large lists.
- Do not repeatedly export the full database.
- Avoid full-table queries from SQL Editor.
- Select only needed columns when debugging.
- Avoid opening heavy reports repeatedly during demos.
- If debugging with SQL, add `LIMIT`.

Example safer query:

```sql
SELECT id, projectCode, title, overallStatus
FROM "Project"
ORDER BY "createdAt" DESC
LIMIT 50;
```

Avoid:

```sql
SELECT *
FROM "Project";
```

## 11. Backup Before Cleanup

Before deleting branches, records, or large data:

1. Confirm you are connected to the production Neon project.
2. Confirm the current Render app is pointed at that same database.
3. Create a backup or snapshot if the plan supports it.
4. If using `pg_dump`, remember that database export can add network transfer usage.
5. Store backups securely.

Do not delete production records just to reduce quota unless the owner approves.

## 12. Render vs Neon: How to Tell Which One Is Failing

The app uses Render for hosting and Neon for PostgreSQL.

| Symptom | Likely Cause |
| --- | --- |
| App page takes time to wake up but eventually works | Render free-tier cold start |
| App loads but dashboard/protocol data fails | Neon/database issue or API issue |
| Login fails with database errors | Neon unavailable or connection problem |
| Static page loads but actions fail | Backend can serve frontend but database writes fail |
| Render deploy failed | Render/build issue, not Neon quota |
| Neon dashboard shows quota at 100 percent | Neon quota exhaustion |

## 13. User Communication Template

Use this if the database quota is exhausted:

```text
The RERC Review Portal database has reached its hosting usage limit. Some pages or actions may be unavailable until the database quota resets or the database plan is upgraded. Please pause non-urgent portal work while we restore database access.
```

Use this after recovery:

```text
Database access has been restored. Please refresh the RERC Review Portal and retry your action. If you still see an error, report the page, protocol number, and action you were attempting.
```

## 14. Recommended Long-Term Decision

For live committee operations, do not depend on the Free plan indefinitely.

Recommended policy:

- Free plan is acceptable for testing, demos, and low-volume trial use.
- Upgrade before production usage grows beyond a small pilot.
- Upgrade before planned bulk imports or live committee-wide rollout.
- Upgrade if usage reaches 70 percent of any limit more than once.
- Upgrade if the portal must be available during fixed review deadlines.

## 15. Quick Checklist

When quota is close to the limit:

- Check Neon dashboard usage.
- Stop CSV imports and heavy reports.
- Delete unused branches.
- Avoid full database exports unless needed.
- Notify the project owner.
- Plan upgrade if usage is above 70 percent.

When quota is exhausted:

- Confirm which metric is exhausted.
- Notify users.
- Upgrade Neon or wait for reset.
- Restart Render only if the app does not recover after Neon access returns.
- Test login, dashboard, protocol detail, and reports.

## 16. Source Notes

This runbook was written for the RERC Review Portal and verified against Neon documentation on May 28, 2026.

Because Neon pricing and plan limits can change, future maintainers should re-check the official Neon links before making billing or production availability decisions.
