# RERC Review Portal User Manual

Version: 1.0  
Last updated: May 28, 2026  
Application: RERC Review Portal  
Live URL: https://rerc-review-portal.onrender.com

## 1. Purpose of This Manual

This manual is for the people who will operate the RERC Review Portal after handoff. It explains what each role can do, where each feature is located, how the protocol workflow works, and how the newer Panel Management, protocol assistant assignment, and reviewer assignment features are supposed to behave.

The most important rule is this:

- `Assign assistant` is for protocol assistant or staff-in-charge access.
- `Assign reviewer` is for review-task access and review decisions.

These are separate features. Do not use one as a replacement for the other.

## 2. Accessing the System

Open the application in a browser:

https://rerc-review-portal.onrender.com

Use the sign-in page to enter the email and password for an approved account.

If the app has not been used recently, the hosted server may need a short time to wake up. Wait for the page to load, then refresh or try the action again.

## 3. Account Lifecycle

New users do not immediately receive full access.

1. A user signs up.
2. The account enters pending status.
3. A Chair reviews the signup in Account Management.
4. The Chair approves or rejects the account.
5. If approved, the Chair assigns the final role.
6. The user signs in and sees only the pages allowed for that role.

Account status affects access:

| Status | Meaning |
| --- | --- |
| Pending | Account is waiting for Chair review. The user cannot operate the portal yet. |
| Approved | Account can sign in and use features allowed by its role. |
| Rejected | Signup was rejected. |
| Disabled | Account is blocked from normal use until restored or re-enabled. |

## 4. Roles and Permissions

The portal uses role-based access control. A user may see different sidebar items and actions depending on role.

| Role | What the Role Is For |
| --- | --- |
| Chair | Governance lead. Can approve accounts, manage panels, classify protocols, assign assistants, assign reviewers, oversee protocols, manage reports, and handle delete/restore workflows. |
| Admin | Access administration and recovery support. Admin access is not the same as Chair access. Admin does not manage panels unless the user also has Chair role. |
| Research Associate | Operational staff. Can manage protocol workflow, assign protocol assistants, assign reviewers, import records, use reports, and follow protocols through review. |
| Research Assistant | Assigned-only worker. Can see protocols assigned to them and can operate only those assigned protocols when assigned as protocol assistant. Can submit review decisions only when assigned as reviewer. |
| Reviewer | Assigned-only reviewer access where reviewer workflows apply. |
| Member | Limited access role when used by the committee. |

### Permission Summary

| Feature or Action | Chair | Research Associate | Research Assistant | Admin |
| --- | --- | --- | --- | --- |
| Dashboard | Yes | Yes | Assigned-only view | Depends on role setup |
| Classification queue | Yes | Yes | No, except assigned protocols in My Assignments | No |
| Under Review queue | Yes | Yes | Assigned-only via My Assignments | No |
| Panel Management | Yes | No | No | No |
| Account approval | Yes | No | No | Limited admin account tools |
| Assign protocol assistant | Yes | Yes | No | No |
| Assign reviewer | Yes | Yes | No | No |
| Classification controls | Yes | No | No | No |
| Edit assigned protocol details | Yes | Yes | Yes, only if protocol assistant | No |
| Submit review decision | Only through reviewer assignment if applicable | Only through reviewer assignment if applicable | Yes, only if assigned reviewer | No |
| Import CSV | Yes | Yes | No | No |
| Reports | Yes | Yes | No | No |
| Archives | Yes | Yes where allowed | No | Yes where allowed |
| Recently Deleted | Yes | No | No | Yes |
| Direct URL access to unassigned protocol | Yes | Yes | No | No |

## 5. Sidebar Navigation

The sidebar is the main way to move through the portal.

### Main

| Sidebar Item | Purpose | Who Normally Sees It |
| --- | --- | --- |
| Dashboard | Main operational workspace for protocol queues and actions. | Chair, Research Associate, assigned-only users in limited mode |
| Account Management | Review users, approve signups, assign roles, disable accounts, reset passwords where allowed. | Chair, Admin |
| Panel Management | Manage panel members. | Chair only |

### Queues

| Sidebar Item | Purpose |
| --- | --- |
| Classification | Protocols waiting for classification work. |
| Under Review | Protocols that are classified and under review. |
| Exempted | Exempt protocols and exemption follow-through. |
| Revisions | Protocols awaiting revision-related action. |

Research Assistants do not see the same queue list. Their assigned area is labeled `My Assignments`.

### Tools

| Sidebar Item | Purpose |
| --- | --- |
| New Protocol | Create a new protocol manually. |
| Import CSV | Import protocol data from a CSV file. |
| Reports | Generate reporting views and summaries. |
| Archives | View archived protocols. |
| Recently Deleted | Restore or inspect recently deleted protocols. |
| Calendar | Manage calendar-related items such as holidays or schedule context. |

### Account

| Sidebar Item | Purpose |
| --- | --- |
| My Profile | View or update your own profile information. |
| Sign out | End the current session. |

## 6. Dashboard

The Dashboard is the main operational page.

Access path:

`Dashboard`

Direct route:

`/dashboard`

### What the Dashboard Shows

The dashboard summarizes active protocol work. It includes:

- High-level counts such as overdue submissions, due-soon submissions, awaiting classification, and under review.
- A queue workspace table.
- Search and filters.
- Protocol row actions.
- Bulk actions for selected rows.

### Dashboard Table Columns

Typical table information includes:

- Submission or protocol code.
- Protocol title.
- Principal investigator.
- Current stage.
- SLA or due status.
- Owner/staff-in-charge status where available.
- Row actions.

### Dashboard Filters

Common filters include:

- All
- Due soon
- Overdue
- Blocked
- Awaiting classification
- Under review
- Revisions
- Unassigned

The `Unassigned` filter means the protocol does not currently have a protocol assistant or staff in charge.

### Dashboard Row Actions

| Action | Meaning |
| --- | --- |
| Quick view | Opens a compact preview of the protocol. |
| Assign protocol assistant | Assigns a Research Assistant as protocol assistant/staff in charge. |
| Assign reviewer | Assigns a reviewer for review-decision work. |
| Open details | Opens the full submission detail page. |

### Dashboard Bulk Actions

Bulk actions appear after selecting one or more rows.

Available bulk actions depend on role and selected records.

| Bulk Action | Purpose |
| --- | --- |
| Assign assistant | Assign one Research Assistant as protocol assistant for all selected protocols. |
| Assign reviewers | Assign one reviewer setup to eligible selected protocols. |
| Send reminders | Log reminder actions for selected protocols. |
| Change status | Apply an allowed workflow status action to selected protocols. |
| Delete selected | Move selected records to Recently Deleted, where allowed. |
| Export selected | Download selected row data. |

## 7. Queue Pages

Queue pages show focused protocol lists.

Direct routes:

- `/queues/classification`
- `/queues/under-review`
- `/queues/exempted`
- `/queues/revisions`

### Classification Queue

Use this queue for protocols waiting for classification-related work.

Chair users handle classification-stage decisions. Research Associates can perform operational workflow routing after classification, but classification itself remains Chair-only.

### Under Review Queue

Use this queue for protocols already classified as Expedited or Full Review and moving through reviewer work.

Chair and Research Associate users can assign protocol assistants and reviewers from this queue.

### Exempted Queue

Use this queue for protocols classified as Exempt. It supports exemption follow-through and notification-related tasks.

### Revisions Queue

Use this queue for protocols awaiting revisions or revision follow-up.

### My Assignments for Research Assistants

Research Assistants see assigned protocols through `My Assignments`.

Assigned protocols can appear there for either of these reasons:

- The user is assigned as protocol assistant/staff in charge.
- The user is assigned as reviewer for that protocol.

The Research Assistant does not see unassigned protocols.

## 8. Panel Management

Panel Management is Chair-only.

Access path:

`Panel Management`

Direct route:

`/admin/panel-management`

### Access Rule

Only Chair users can see and open Panel Management.

Non-Chair users:

- Do not see the sidebar tab.
- Cannot access `/admin/panel-management` directly.

### What Panel Management Is For

Use Panel Management to maintain panel membership records. It is not for assigning reviewers or protocol assistants.

### Panel Member Details

Panel records can include:

- Member name.
- Email.
- Panel role or position.
- Status.
- Date added where available.
- Panel membership context.

### Add a Panel Member

1. Sign in as Chair.
2. Open `Panel Management`.
3. Select the panel.
4. Use the add member action.
5. Enter or select the member details.
6. Save.

The system prevents duplicate member entries for the same email/user on the same panel.

### Edit a Panel Member

1. Open `Panel Management`.
2. Find the panel member.
3. Select the edit action.
4. Change the role, position, status, or available details.
5. Save.

### Delete a Panel Member

1. Open `Panel Management`.
2. Find the panel member.
3. Select the delete action.
4. Confirm the deletion in the dialog.

The deletion does not proceed until the confirmation dialog is accepted.

## 9. Account Management

Account Management is used for user governance.

Access path:

`Account Management`

Direct route:

`/admin/account-management`

### Chair Capabilities

Chair users can:

- View pending accounts.
- Approve signups.
- Reject signups.
- Assign final roles.
- Edit approved account roles.
- Disable accounts.
- Restore or reactivate accounts where available.
- Reset passwords where available.

### Admin Capabilities

Admin users can access allowed account-administration tools. Admin is not the same as Chair. Admin does not automatically receive Panel Management or protocol classification authority.

### Account Approval Workflow

1. Open `Account Management`.
2. Go to `Pending`.
3. Review the name and email.
4. Choose a role before approving.
5. Select `Approve`.

If the signup should not be allowed, select `Reject`.

## 10. New Protocol

Use New Protocol to manually create a protocol record.

Access path:

`New Protocol`

Direct route:

`/projects/new`

Who can use it:

- Chair
- Research Associate

Typical required information includes:

- Project code.
- Protocol title.
- Project leader or principal investigator.
- Submission information.
- Committee or intake context.

After creation, the protocol becomes available in the dashboard and workflow queues according to its status.

## 11. Import CSV

Use Import CSV to bring protocol data into the system from a spreadsheet export.

Access path:

`Import CSV`

Direct route:

`/imports/projects`

Who can use it:

- Chair
- Research Associate

### Import Workflow

1. Open `Import CSV`.
2. Upload the CSV file.
3. Review detected columns and validation feedback.
4. Correct required fields if needed.
5. Import the records.

Imported records are mapped into live workflow data where possible. Legacy spreadsheet fields are kept as imported reference fields in the protocol profile.

## 12. Submission Detail Page

The submission detail page is the full workspace for one protocol submission.

Direct route pattern:

`/submissions/:submissionId`

Example:

`/submissions/10`

### Main Sections

| Section | Purpose |
| --- | --- |
| Header | Shows protocol code, title, submission number, current status, and delete/recovery actions where allowed. |
| Submission overview | Shows and edits core submission details such as PI, submission type, received date, and final decision fields. |
| Classification controls | Chair-only classification-stage controls. |
| Protocol Profile | Structured protocol metadata and imported reference fields. |
| Milestones | Timeline or workflow milestone tracking. |
| My review decision | Visible to Research Assistants when they have an assigned review. |
| Protocol assistant | Shows and manages the assigned protocol assistant/staff in charge. |
| Reviewer assignments | Shows and manages reviewer assignments. |
| Documents | Shows protocol document records. |
| SLA tracking | Shows current service-level status and deadline context. |
| Reminder log | Shows reminder entries. |
| Status history | Shows workflow status changes over time. |
| Edit history | Shows tracked edits and who made them. |

### Submission Overview

This section can show:

- Principal investigator.
- Submission type.
- Received date.
- Current status.
- Final decision.
- Final decision date.
- Change reason.

Chair and Research Associate users can edit overview fields. A Research Assistant can edit allowed overview fields only when they are assigned as protocol assistant for that protocol.

### Classification Controls

Classification controls are Chair-only.

The Chair can:

- Set classification status.
- Set type of review.
- Assign a panel for Full Board review where applicable.
- Save classification changes.

Research Associates and Research Assistants cannot perform Chair-only classification actions.

### Protocol Profile

The Protocol Profile stores structured protocol details.

It includes:

- Core information.
- Clearance and date fields.
- Imported reference fields.
- Historical spreadsheet fields retained for reference.

Live workflow truth is not taken from old imported status fields. Live workflow is tracked through submission status, classification records, reviewer assignments, protocol assistant assignment, SLA records, and status history.

### Milestones

Milestones track workflow or protocol timeline items.

Allowed users can:

- Add a milestone.
- Load the standard timeline.
- Edit milestone label.
- Edit number of days.
- Set date occurred.
- Edit owner.
- Edit notes.
- Save milestone changes.
- Delete a milestone.

Assigned protocol assistants can update milestones only for protocols assigned to them.

## 13. Protocol Assistant Assignment

Protocol assistant assignment is the workflow for assigning a Research Assistant to help operate a protocol.

This assignment is stored as the protocol's staff-in-charge relationship.

Backend relationship:

`Submission.staffInChargeId`

### What This Feature Does

When a Research Assistant is assigned as protocol assistant:

- The protocol appears in the assistant's `My Assignments`.
- The assistant can open the assigned protocol.
- The assistant can operate allowed protocol fields for that protocol.
- The assistant still cannot see unrelated protocols.
- The assistant still cannot perform Chair-only classification.
- The assistant still cannot assign reviewers or assign other assistants.

### Who Can Assign a Protocol Assistant

- Chair
- Research Associate

### Who Can Be Assigned

Only active approved users with the Research Assistant role can be assigned as protocol assistant.

### Where the Button Appears

| Location | Button or Action |
| --- | --- |
| Dashboard row | `Assign protocol assistant` |
| Dashboard bulk action bar | `Assign assistant` |
| Queue row | `Assign protocol assistant` |
| Submission detail page | `Protocol assistant` card, then `Assign assistant` |

### Assign One Protocol Assistant from a Row

1. Sign in as Chair or Research Associate.
2. Open the Dashboard or a queue.
3. Find the protocol.
4. Select `Assign protocol assistant`.
5. Choose the Research Assistant.
6. Select `Assign assistant`.

### Assign One Assistant from the Submission Detail Page

1. Open the protocol detail page.
2. Scroll to the `Protocol assistant` card.
3. Select `Assign assistant`.
4. Choose the Research Assistant.
5. Confirm the assignment.

### Assign One Assistant to Multiple Protocols

1. Open the Dashboard.
2. Select the protocol checkboxes.
3. Select `Assign assistant`.
4. Choose the Research Assistant.
5. Confirm.

### Duplicate Protection

The system blocks duplicate assignment when the same Research Assistant is already assigned as protocol assistant for the same protocol.

### Important Difference from Reviewer Assignment

Protocol assistant assignment does not create a review decision task.

If the assistant must submit a review decision, they must also be assigned as reviewer.

## 14. Reviewer Assignment

Reviewer assignment is for assigning review work.

Backend relationship:

`Review` row with a `reviewerId`

### What This Feature Does

Reviewer assignment:

- Adds the person as a reviewer for the submission.
- Stores reviewer role.
- Can store due date.
- Can mark one reviewer as primary.
- Allows the assigned Research Assistant reviewer to submit a review decision.

Reviewer assignment does not make the person protocol assistant or staff in charge.

### Who Can Assign Reviewers

- Chair
- Research Associate

### Where the Button Appears

| Location | Button or Action |
| --- | --- |
| Dashboard row | `Assign reviewer` |
| Dashboard bulk action bar | `Assign reviewers` |
| Queue row | `Assign reviewer` |
| Submission detail page | `Reviewer assignments` card, then `Assign reviewer` |

### Reviewer Roles

Available reviewer roles include:

- Scientist
- Lay reviewer
- Independent consultant

### Assign a Reviewer

1. Sign in as Chair or Research Associate.
2. Open a protocol or use a row action from the Dashboard/Queue.
3. Select `Assign reviewer`.
4. Choose the reviewer.
5. Choose the reviewer role.
6. Optionally set a review due date.
7. Optionally mark as primary reviewer.
8. Save.

### Reviewer Assignment Rules

- Exempt protocols normally do not need reviewer assignment.
- Review assignment is separate from protocol assistant assignment.
- Reviewers can be listed in the `Reviewer assignments` card.
- Assigned Research Assistant reviewers can use the `My review decision` section.

## 15. Research Assistant Workflow

Research Assistants have assigned-only access.

Access path:

`My Assignments`

Direct route:

`/queues/under-review`

The route is reused, but the Research Assistant view is scoped to assigned protocols only.

### Why a Protocol Appears in My Assignments

A protocol appears for a Research Assistant if at least one of these is true:

- The Research Assistant is assigned as protocol assistant/staff in charge.
- The Research Assistant has a reviewer assignment on the protocol.

### What the Assistant Can Do by Assignment Type

| Assignment Type | What the Research Assistant Can Do |
| --- | --- |
| Protocol assistant | View and operate allowed protocol details for that assigned protocol. |
| Reviewer | View the assigned protocol and submit the review decision/remarks for that review assignment. |
| Both | Operate allowed protocol details and submit the assigned review decision. |

### Direct URL Protection

Research Assistants cannot bypass the dashboard by typing a direct URL for an unassigned protocol. The backend checks whether the user is assigned before returning protocol data.

If access is denied, the expected cause is that the Research Assistant is not assigned to that protocol.

## 16. My Review Decision

The `My review decision` section appears for a Research Assistant when a review assignment exists for that user.

The assistant can:

- Choose a decision.
- Add remarks.
- Submit the review decision.

Decision options can include:

- Approved
- Minor revisions
- Major revisions
- Disapproved
- Information only

After submission, the decision is recorded and the submitted state is shown.

## 17. Documents

The Documents section lists document records connected to the protocol.

Document records can represent required or supporting files such as consent forms, instruments, permission letters, or other attachments depending on the protocol configuration.

Users can view document status where available. Document actions depend on role and workflow state.

## 18. SLA Tracking

SLA tracking shows deadline status and timing context.

Possible SLA signals include:

- On track.
- Due soon.
- Overdue.
- Blocked or missing details.
- Deadline not started because the workflow stage does not yet have a deadline.

The dashboard and queues use SLA signals to surface priority work.

## 19. Reminder Log

Reminder logs record follow-up actions.

Chair and Research Associate users can create reminder entries in bulk where allowed.

Reminder log entries help show that staff followed up with proponents, reviewers, or internal staff.

## 20. Status History and Edit History

### Status History

Status history records workflow status changes.

It can show:

- Old status.
- New status.
- Effective date.
- Reason.
- User who made the change.

### Edit History

Edit history records changes to submission or project fields.

It can show:

- Field changed.
- Old value.
- New value.
- User who changed it.
- Change reason where available.

## 21. Reports

Reports are used for operational and academic-period summaries.

Access path:

`Reports`

Direct route:

`/reports`

Who can use it:

- Chair
- Research Associate

Reports may include filters such as academic year, term, committee, review type, status, college, or comparison ranges depending on the report screen.

## 22. Archives

Archives are used for closed or withdrawn protocols.

Access path:

`Archives`

Direct route:

`/archives`

Users with archive access can review archived protocols and related lifecycle records.

## 23. Recently Deleted

Recently Deleted contains protocols that were deleted but may still be recoverable.

Access path:

`Recently Deleted`

Direct route:

`/recently-deleted`

Who can use it:

- Chair
- Admin

Deleted protocols are read-only until restored. The system may permanently purge records after the configured retention period.

## 24. Calendar

Calendar supports calendar-related operational setup, such as holiday or schedule context used by date and SLA logic.

Access path:

`Calendar`

Direct route:

`/calendar`

Who can use it:

- Chair
- Research Associate
- Admin where allowed

## 25. My Profile

Use My Profile to view or update your own account details.

Access path:

`My Profile`

Direct route:

`/account/profile`

Profile updates may require password confirmation depending on the field being changed.

## 26. Common Workflows

### Workflow: Approve a New User

1. Sign in as Chair.
2. Open `Account Management`.
3. Open the `Pending` tab.
4. Review the user.
5. Select the final role.
6. Select `Approve`.

### Workflow: Add a Panel Member

1. Sign in as Chair.
2. Open `Panel Management`.
3. Choose the panel.
4. Add the member.
5. Save.

### Workflow: Create a New Protocol

1. Sign in as Chair or Research Associate.
2. Open `New Protocol`.
3. Fill in required protocol details.
4. Save the protocol.
5. Open the created protocol from the Dashboard.

### Workflow: Classify a Protocol

1. Sign in as Chair.
2. Open a protocol awaiting classification.
3. Use `Classification controls`.
4. Set the classification status.
5. Set the type of review.
6. Assign a panel if Full Board review requires one.
7. Save.

### Workflow: Assign a Protocol Assistant

1. Sign in as Chair or Research Associate.
2. Open the Dashboard, a queue, or the submission detail page.
3. Select `Assign assistant` or `Assign protocol assistant`.
4. Choose an active approved Research Assistant.
5. Confirm.

### Workflow: Assign a Reviewer

1. Sign in as Chair or Research Associate.
2. Open the protocol detail page or use a row action.
3. Select `Assign reviewer`.
4. Choose the reviewer.
5. Choose reviewer role.
6. Add due date if needed.
7. Save.

### Workflow: Research Assistant Works on Assigned Protocol

1. Sign in as Research Assistant.
2. Open `My Assignments`.
3. Open an assigned protocol.
4. If assigned as protocol assistant, update allowed protocol details.
5. If assigned as reviewer, use `My review decision` to submit a decision.

### Workflow: Restore a Recently Deleted Protocol

1. Sign in as Chair or Admin.
2. Open `Recently Deleted`.
3. Find the deleted protocol.
4. Use the restore action where available.
5. Provide a reason if requested.
6. Confirm.

## 27. Troubleshooting

### I cannot see Panel Management.

Panel Management is Chair-only. Confirm that you are signed in as a Chair.

### The Panel Management direct URL does not work.

Use `/admin/panel-management`. If you are not a Chair, access is blocked by design.

### I cannot see Assign assistant.

Only Chair and Research Associate users can assign protocol assistants. Look for it on dashboard rows, queue rows, dashboard bulk selection, or the Protocol assistant card on the submission detail page.

### I cannot see Assign reviewer.

Only Chair and Research Associate users can assign reviewers. The action appears only where reviewer assignment is eligible.

### I assigned a reviewer, but the assistant cannot edit protocol details.

That is expected. Assigning a reviewer gives review-task access, not protocol assistant access. Use `Assign assistant` to give protocol-operator access.

### I assigned an assistant, but they cannot submit a review decision.

That is expected unless they are also assigned as reviewer. Use `Assign reviewer` if a review decision is required.

### A Research Assistant cannot see a protocol.

Check whether the Research Assistant is assigned as protocol assistant or reviewer. If not assigned, the protocol will not appear and direct URL access will be blocked.

### A duplicate assistant assignment fails.

The same Research Assistant cannot be assigned again as protocol assistant if already assigned to that protocol.

### Classification controls are disabled.

Classification controls are Chair-only. Research Associates and Research Assistants cannot perform Chair-only classification-stage changes.

### The app says the server is waking up.

Wait briefly, refresh, and repeat the action.

## 28. Security and Data Integrity Rules

The portal enforces permissions in both the frontend and backend.

Frontend behavior:

- Hides sidebar items a user should not see.
- Hides or disables buttons a role cannot use.
- Shows assigned-only navigation for Research Assistants.

Backend behavior:

- Blocks direct URL access when a user is not authorized.
- Confirms assigned-only access before returning protocol details.
- Restricts Panel Management to Chair users.
- Restricts protocol assistant assignment to Chair and Research Associate users.
- Restricts reviewer assignment to Chair and Research Associate users.
- Keeps classification-stage controls Chair-only.

## 29. Backend Truth for Assignment Logic

This section is included so future maintainers understand how the system really works.

### Protocol Assistant Assignment

Protocol assistant assignment uses:

`Submission.staffInChargeId`

That value points to the Research Assistant who is allowed to operate that assigned protocol.

### Reviewer Assignment

Reviewer assignment uses:

`Review.reviewerId`

That value points to the user assigned to review the protocol and submit a review decision.

### Research Assistant Visibility

A Research Assistant can see a protocol when either condition is true:

- `Submission.staffInChargeId` matches the Research Assistant user ID.
- A `Review` row exists where `reviewerId` matches the Research Assistant user ID.

### Research Assistant Operation Permission

A Research Assistant can operate protocol details only when:

- `Submission.staffInChargeId` matches their user ID.

A review assignment alone does not grant protocol-operator access.

## 30. Quick Reference

| Need | Use This Feature |
| --- | --- |
| Give a Research Assistant operational access to a protocol | Assign assistant |
| Make a protocol appear in a Research Assistant's My Assignments as staff work | Assign assistant |
| Assign someone to review and submit a decision | Assign reviewer |
| Set reviewer role and due date | Assign reviewer |
| Manage panel membership | Panel Management |
| Approve new portal users | Account Management |
| Classify a protocol | Classification controls, Chair only |
| Import spreadsheet records | Import CSV |
| Recover deleted protocols | Recently Deleted |

Do not mix up `Assign assistant` and `Assign reviewer`. They intentionally control different access paths.
