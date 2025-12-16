# RERC System - Security & Access Control Implementation

## Overview

This document describes the Role-Based Access Control (RBAC) and comprehensive audit logging system implemented in the RERC database system. These features fulfill the security requirements specified in the Meeting Minutes.

---

## 1. Role-Based Access Control (RBAC)

### 1.1 Roles and Permissions

The system supports the following roles:

| Role                   | Description                   | Access Level                                          |
| ---------------------- | ----------------------------- | ----------------------------------------------------- |
| **ADMIN**              | System administrator          | Full access to all endpoints and data                 |
| **CHAIR**              | Committee chair               | Full access (equivalent to admin for their committee) |
| **RESEARCH_ASSOCIATE** | RA/Secretariat                | Full access; manages protocols and submissions        |
| **MEMBER**             | Committee member/panel member | View-only access to assigned protocols                |
| **RESEARCH_ASSISTANT** | RA support staff              | Can assist with data entry for assigned records       |
| **REVIEWER**           | Assigned reviewer             | Access only to their assigned reviews and submissions |

### 1.2 Authentication

The current implementation uses header-based authentication for development/testing:

**Headers required for all requests:**

```
X-User-ID: <user_id>
X-User-Email: <email@example.com>
X-User-Name: <full_name>
X-User-Roles: <role1>,<role2>                    # Comma-separated roles
X-User-Committee-Roles: {"1":"CHAIR","2":"MEMBER"}  # JSON mapping of committeeId -> role
```

**Example:**

```bash
curl -X GET http://localhost:3000/projects \
  -H "X-User-ID: 1" \
  -H "X-User-Email: aimie@university.edu" \
  -H "X-User-Name: Aimie" \
  -H "X-User-Roles: RESEARCH_ASSOCIATE" \
  -H "X-User-Committee-Roles: {\"1\":\"RESEARCH_ASSOCIATE\"}"
```

**Production Note:** Replace header-based auth with JWT tokens or session-based authentication.

### 1.3 Authorization Middleware

#### Global Authorization

All endpoints are protected by the `authenticateUser` middleware which runs on every request. Critical write operations require additional role authorization:

**Protected by Role:**

- `POST /projects` → Requires: `CHAIR`, `RESEARCH_ASSOCIATE`, `ADMIN`
- `POST /projects/:projectId/submissions` → Requires: `CHAIR`, `RESEARCH_ASSOCIATE`, `RESEARCH_ASSISTANT`, `ADMIN`
- `POST /submissions/:submissionId/classifications` → Requires: `CHAIR`, `ADMIN`
- `PATCH /submissions/:id/status` → Requires: `CHAIR`, `RESEARCH_ASSOCIATE`, `ADMIN`
- `POST /submissions/:submissionId/reviews` → Requires: `CHAIR`, `RESEARCH_ASSOCIATE`, `ADMIN`
- `POST /reviews/:reviewId/decision` → Requires: `REVIEWER`, `CHAIR`, `MEMBER`, `ADMIN`
- `POST /submissions/:id/final-decision` → Requires: `CHAIR`, `RESEARCH_ASSOCIATE`, `ADMIN`
- `GET /audit-logs` → Requires: `CHAIR`, `RESEARCH_ASSOCIATE`, `ADMIN`

### 1.4 Field-Level Access Control

Beyond endpoint-level access, the system implements field-level access restrictions to ensure users only see appropriate data:

**Full Access (CHAIR, RESEARCH_ASSOCIATE, ADMIN):**

- All fields on all resources

**Limited Access (REVIEWER, MEMBER, RESEARCH_ASSISTANT):**

- Can view project code, title, PI info, status, approval periods
- Cannot view internal remarks, approval dates, or other sensitive fields
- Reviewers can only see their assigned reviews

**Implementation:**

```typescript
// Usage in endpoints
const accessibleFields = getAccessibleSubmissionFields(req.user?.roles || []);
const filtered = submissions.map((s) =>
  filterFieldsByAccess(s, accessibleFields)
);
res.json(filtered);
```

---

## 2. Comprehensive Audit Logging

### 2.1 Audit Log Data Model

The system captures all significant operations in the `AuditLog` table:

```prisma
model AuditLog {
  id                Int               @id @default(autoincrement())
  action            AuditAction       // CREATE, UPDATE, DELETE, STATUS_CHANGE, DECISION, etc.
  resourceType      AuditResourceType // PROJECT, SUBMISSION, CLASSIFICATION, REVIEW, etc.
  resourceId        Int               // ID of the affected resource
  resourceName      String?           // Human-readable name (e.g., project code)
  user              User?             // User who performed the action
  userId            Int?              // User ID (nullable for system actions)
  userEmail         String?           // User email snapshot
  timestamp         DateTime          // When the action occurred
  oldValue          String?           // JSON of previous state
  newValue          String?           // JSON of new state
  changedFields     String?           // JSON array of field names that changed
  reason            String?           // Optional reason provided by user
  ipAddress         String?           // IP address (for future use)
}
```

### 2.2 Supported Actions

| Action                | When Logged               | Example                              |
| --------------------- | ------------------------- | ------------------------------------ |
| `CREATE`              | Resource created          | Project created, submission filed    |
| `UPDATE`              | Resource modified         | Project details updated              |
| `DELETE`              | Resource deleted          | (Currently restricted)               |
| `STATUS_CHANGE`       | Submission status changed | RECEIVED → UNDER_CLASSIFICATION      |
| `DECISION`            | Review decision recorded  | Reviewer submits decision            |
| `ASSIGNMENT`          | Reviewer assigned         | RA assigns reviewer to submission    |
| `CLASSIFICATION`      | Classification determined | Chair classifies as FULL_BOARD       |
| `REVIEW_ASSIGNMENT`   | Formal review assignment  | Submission moved to review queue     |
| `FINAL_DECISION`      | Final approval/rejection  | Committee makes final determination  |
| `APPROVAL_PERIOD_SET` | Approval validity set     | Project approval start/end dates set |
| `EXPORT`              | Data exported             | CSV/DOCX generated for mail merge    |

### 2.3 Audit Log Endpoints

#### 2.3.1 Get All Audit Logs

```
GET /audit-logs
Authorization: CHAIR, RESEARCH_ASSOCIATE, ADMIN
Query Parameters:
  - resourceType (optional): PROJECT, SUBMISSION, CLASSIFICATION, REVIEW
  - resourceId (optional): Filter by specific resource
  - userId (optional): Filter by user who performed action
  - limit (optional, default=100): Number of logs to return (max 500)
  - offset (optional, default=0): Pagination offset

Response:
{
  "data": [
    {
      "id": 1,
      "action": "CREATE",
      "resourceType": "PROJECT",
      "resourceId": 5,
      "resourceName": "2025-350",
      "user": {
        "id": 1,
        "email": "aimie@university.edu",
        "fullName": "Aimie"
      },
      "timestamp": "2025-12-14T15:30:00Z",
      "oldValue": null,
      "newValue": "{\"id\":5,\"projectCode\":\"2025-350\",...}",
      "changedFields": null
    }
  ],
  "pagination": {
    "total": 145,
    "limit": 100,
    "offset": 0
  }
}
```

#### 2.3.2 Get Audit Logs for a Specific Resource

```
GET /audit-logs/:resourceType/:resourceId
Authorization: CHAIR, RESEARCH_ASSOCIATE, MEMBER, REVIEWER, ADMIN

Example: GET /audit-logs/PROJECT/5

Response:
[
  {
    "id": 1,
    "action": "CREATE",
    "resourceType": "PROJECT",
    "resourceId": 5,
    "resourceName": "2025-350",
    "timestamp": "2025-12-14T15:00:00Z",
    ...
  },
  {
    "id": 12,
    "action": "STATUS_CHANGE",
    "resourceType": "PROJECT",
    "resourceId": 5,
    "oldValue": "{\"overallStatus\":\"DRAFT\"}",
    "newValue": "{\"overallStatus\":\"ACTIVE\"}",
    "changedFields": "[\"overallStatus\"]",
    "timestamp": "2025-12-14T16:00:00Z",
    ...
  }
]
```

#### 2.3.3 Get Audit Compliance Summary

```
GET /audit-logs/summary/compliance
Authorization: CHAIR, RESEARCH_ASSOCIATE, ADMIN
Query Parameters:
  - startDate (optional): ISO date string
  - endDate (optional): ISO date string

Response:
{
  "period": {
    "startDate": "2025-12-01T00:00:00Z",
    "endDate": "2025-12-31T23:59:59Z"
  },
  "actionCounts": [
    {
      "action": "CREATE",
      "resourceType": "SUBMISSION",
      "_count": 23
    },
    {
      "action": "STATUS_CHANGE",
      "resourceType": "SUBMISSION",
      "_count": 47
    }
  ],
  "userActivity": [
    {
      "userId": 1,
      "userEmail": "aimie@university.edu",
      "_count": 89
    }
  ],
  "totalEvents": 156
}
```

### 2.4 Audit Logging Implementation

All write operations automatically log events. Example:

```typescript
// When creating a project
const project = await prisma.project.create({ ... });

// Automatically logged
await logAuditEvent({
  action: "CREATE",
  resourceType: "PROJECT",
  resourceId: project.id,
  resourceName: project.projectCode,
  userId: req.user?.id,
  userEmail: req.user?.email,
  newValue: sanitizeForAudit(project),
});
```

---

## 3. Implementation Status

### ✅ Completed

- Authentication middleware with role checking
- Authorization middleware for endpoint protection
- Field-level access control utilities
- Audit log data model (requires database migration)
- Audit logging infrastructure
- Audit log retrieval endpoints
- Basic field filtering on GET /projects

### ⏳ In Progress

- Add audit logging to all write operations (submissions, classifications, reviews, decisions)
- Full audit logging on status changes
- Comprehensive field filtering on all sensitive endpoints

### 📋 Recommended Next Steps

1. **Database Migration**: Run `npx prisma migrate dev --name add_audit_logs` when database is available
2. **Enhanced Audit Logging**: Add logging calls to remaining endpoints (POST submissions, classifications, reviews, final decisions, status changes)
3. **Field Filtering Expansion**: Apply field-level access filtering to all sensitive GET endpoints
4. **Frontend Updates**: Update frontend to include auth headers in all API requests
5. **Production Authentication**: Replace header-based auth with JWT or session-based authentication
6. **Audit Analytics**: Build dashboards showing audit trails for compliance reporting (Phase 2)

---

## 4. Security Considerations

### Current Limitations

- Header-based authentication is for development only
- No rate limiting implemented
- No IP-based restrictions

### Recommendations for Production

1. Implement JWT token authentication with refresh tokens
2. Add rate limiting middleware
3. Enable HTTPS only
4. Add request validation/sanitization
5. Implement CORS properly (currently accepts all origins if not specified)
6. Add audit log retention policies
7. Encrypt sensitive data in audit logs (optional)
8. Implement request logging for all API calls

---

## 5. Audit Trail Examples

### Example 1: Project Creation Audit Trail

```json
{
  "action": "CREATE",
  "resourceType": "PROJECT",
  "resourceName": "2025-350",
  "user": "Aimie",
  "timestamp": "2025-12-14T10:00:00Z",
  "newValue": {
    "projectCode": "2025-350",
    "title": "Pilot Study on RERC Workflow",
    "piName": "Dr. Sample PI",
    "fundingType": "INTERNAL"
  }
}
```

### Example 2: Submission Status Change Audit Trail

```json
{
  "action": "STATUS_CHANGE",
  "resourceType": "SUBMISSION",
  "resourceId": 123,
  "user": "Aimie",
  "timestamp": "2025-12-15T11:30:00Z",
  "oldValue": { "status": "RECEIVED" },
  "newValue": { "status": "UNDER_COMPLETENESS_CHECK" },
  "changedFields": ["status"],
  "reason": "Initial completeness check in progress"
}
```

### Example 3: Review Decision Audit Trail

```json
{
  "action": "DECISION",
  "resourceType": "REVIEW",
  "resourceId": 456,
  "user": "Dr. Jane Reviewer",
  "timestamp": "2025-12-20T14:00:00Z",
  "oldValue": { "decision": null, "remarks": null },
  "newValue": {
    "decision": "APPROVED",
    "remarks": "Clear protocol, well-designed"
  },
  "changedFields": ["decision", "remarks"]
}
```

---

## 6. Testing RBAC and Audit Logs

### Test Case 1: Chair Can Create Project

```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -H "X-User-ID: 1" \
  -H "X-User-Email: chair@university.edu" \
  -H "X-User-Name: Dr. Chair" \
  -H "X-User-Roles: CHAIR" \
  -H "X-User-Committee-Roles: {\"1\":\"CHAIR\"}" \
  -d '{
    "projectCode": "2025-999",
    "title": "Test Project",
    "piName": "Dr. Test",
    "fundingType": "INTERNAL",
    "committeeId": 1
  }'
# Expected: 201 Created
```

### Test Case 2: Reviewer Cannot Create Project

```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -H "X-User-ID: 10" \
  -H "X-User-Email: reviewer@university.edu" \
  -H "X-User-Name: Dr. Reviewer" \
  -H "X-User-Roles: REVIEWER" \
  -H "X-User-Committee-Roles: {}" \
  -d '{ ... }'
# Expected: 403 Forbidden - "Requires one of CHAIR, RESEARCH_ASSOCIATE, ADMIN"
```

### Test Case 3: View Audit Logs

```bash
curl http://localhost:3000/audit-logs \
  -H "X-User-ID: 1" \
  -H "X-User-Email: chair@university.edu" \
  -H "X-User-Name: Dr. Chair" \
  -H "X-User-Roles: CHAIR" \
  -H "X-User-Committee-Roles: {\"1\":\"CHAIR\"}"
# Returns audit log entries
```

---

## 7. Files Modified/Created

### New Files

- `src/middleware/auth.ts` - Authentication and authorization middleware
- `src/utils/fieldAccessControl.ts` - Field-level access control utilities
- `src/utils/auditLogger.ts` - Audit logging utilities
- `docs/SECURITY.md` - This document

### Modified Files

- `src/server.ts` - Added auth middleware, authorization to endpoints, audit logging
- `prisma/schema.prisma` - Added AuditLog model and enums

---

## 8. Future Enhancements

1. **OAuth/LDAP Integration**: Connect to university directory
2. **Audit Log Analytics**: Dashboard showing trends, delay patterns
3. **Automated Alerts**: Notify on SLA violations, suspicious activity
4. **Encryption**: Encrypt sensitive data in audit logs
5. **Data Retention Policies**: Auto-purge old audit logs after compliance period
6. **Export Audit Trail**: Generate compliance reports for auditors
