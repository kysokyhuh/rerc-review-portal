"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Dashboard and queue routes
 */
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../config/prismaClient"));
const branding_1 = require("../config/branding");
const dashboardFilters_1 = require("../utils/dashboardFilters");
const overdueClassifier_1 = require("../utils/overdueClassifier");
const router = (0, express_1.Router)();
const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
// Dashboard queues for classification, review, revision
router.get("/dashboard/queues", async (req, res) => {
    try {
        const committeeCode = String(req.query.committeeCode || "RERC-HUMAN");
        const filterParams = (0, dashboardFilters_1.parseDashboardFilterParams)(req.query);
        const filterWhere = (0, dashboardFilters_1.buildDashboardFiltersWhere)(filterParams);
        const baseProject = { committee: { code: committeeCode } };
        const classificationQueue = await prismaClient_1.default.submission.findMany({
            where: (0, dashboardFilters_1.mergeDashboardWhere)({
                status: filterParams.status
                    ? filterParams.status
                    : { in: ["RECEIVED", "UNDER_CLASSIFICATION"] },
                project: baseProject,
            }, 
            // Don't override status if the user explicitly passed one
            filterParams.status ? (() => { const { status, ...rest } = filterWhere; return rest; })() : filterWhere),
            include: {
                project: true,
                classification: true,
                staffInCharge: true,
            },
            orderBy: {
                receivedDate: "asc",
            },
        });
        const reviewQueue = await prismaClient_1.default.submission.findMany({
            where: (0, dashboardFilters_1.mergeDashboardWhere)({
                status: filterParams.status ? filterParams.status : "UNDER_REVIEW",
                project: baseProject,
            }, filterParams.status ? (() => { const { status, ...rest } = filterWhere; return rest; })() : filterWhere),
            include: {
                project: true,
                classification: true,
                staffInCharge: true,
            },
            orderBy: {
                receivedDate: "asc",
            },
        });
        const revisionQueue = await prismaClient_1.default.submission.findMany({
            where: (0, dashboardFilters_1.mergeDashboardWhere)({
                status: filterParams.status ? filterParams.status : "AWAITING_REVISIONS",
                project: baseProject,
            }, filterParams.status ? (() => { const { status, ...rest } = filterWhere; return rest; })() : filterWhere),
            include: {
                project: true,
                classification: true,
                staffInCharge: true,
            },
            orderBy: {
                receivedDate: "asc",
            },
        });
        res.json({
            committeeCode,
            counts: {
                classification: classificationQueue.length,
                review: reviewQueue.length,
                revision: revisionQueue.length,
            },
            classificationQueue,
            reviewQueue,
            revisionQueue,
        });
    }
    catch (error) {
        console.error("Error generating dashboard queues:", error);
        res.status(500).json({ message: "Failed to load dashboard queues" });
    }
});
// Overdue review and endorsement tracking
router.get("/dashboard/overdue", async (req, res) => {
    try {
        const committeeCode = String(req.query.committeeCode || "RERC-HUMAN");
        const filterParams = (0, dashboardFilters_1.parseDashboardFilterParams)(req.query);
        const filterWhere = (0, dashboardFilters_1.buildDashboardFiltersWhere)(filterParams);
        const now = new Date();
        // Build the submission-level where for filters on project fields
        const submissionWhere = {
            project: {
                committee: { code: committeeCode },
            },
        };
        // Merge project-level filters
        if (filterWhere.project) {
            submissionWhere.project = { ...submissionWhere.project, ...filterWhere.project };
        }
        // Merge classification-level filters
        if (filterWhere.classification) {
            submissionWhere.classification = filterWhere.classification;
        }
        const reviews = await prismaClient_1.default.review.findMany({
            where: {
                respondedAt: null,
                submission: submissionWhere,
            },
            include: {
                reviewer: true,
                submission: {
                    include: {
                        project: true,
                    },
                },
            },
        });
        const addDays = (date, days) => {
            const next = new Date(date);
            next.setDate(next.getDate() + days);
            return next;
        };
        const overdueReviews = [];
        const overdueEndorsements = [];
        for (const review of reviews) {
            const dueDate = review.dueDate ?? addDays(review.assignedAt, 7);
            if (dueDate >= now)
                continue;
            const daysOverdue = Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / 86400000));
            const basePayload = {
                id: review.id,
                submissionId: review.submissionId,
                projectCode: review.submission.project?.projectCode ?? "N/A",
                projectTitle: review.submission.project?.title ?? "N/A",
                piName: review.submission.project?.piName ?? "N/A",
                reviewerName: review.reviewer.fullName,
                reviewerRole: review.reviewerRole,
                dueDate,
                daysOverdue,
                ...(0, overdueClassifier_1.classifyOverdue)(review.submission.status, {
                    hasActionableAssignee: Boolean(review.reviewerId),
                    hasRoutingMetadata: Boolean(review.submissionId),
                    isReviewerTask: review.reviewerRole !== "INDEPENDENT_CONSULTANT",
                    isEndorsementTask: review.reviewerRole === "INDEPENDENT_CONSULTANT",
                    hasChairGate: review.submission.status === "UNDER_CLASSIFICATION" ||
                        review.submission.status === "CLASSIFIED",
                }),
            };
            if (review.reviewerRole === "INDEPENDENT_CONSULTANT") {
                const status = review.endorsementStatus ?? "PENDING";
                if (["RECEIVED", "WAIVED", "NOT_REQUIRED"].includes(status)) {
                    continue;
                }
                overdueEndorsements.push({
                    ...basePayload,
                    endorsementStatus: status,
                });
            }
            else {
                overdueReviews.push(basePayload);
            }
        }
        res.json({
            committeeCode,
            overdueReviews,
            overdueEndorsements,
        });
    }
    catch (error) {
        console.error("Error loading overdue reviews:", error);
        res.status(500).json({ message: "Failed to load overdue reviews" });
    }
});
// Dashboard recent activity (status history)
router.get("/dashboard/activity", async (req, res) => {
    try {
        const committeeCode = String(req.query.committeeCode || "RERC-HUMAN");
        const rawLimit = Number(req.query.limit || 8);
        const limit = Number.isFinite(rawLimit)
            ? Math.min(Math.max(rawLimit, 1), 20)
            : 8;
        const activity = await prismaClient_1.default.submissionStatusHistory.findMany({
            where: {
                submission: {
                    project: {
                        committee: {
                            code: committeeCode,
                        },
                    },
                },
            },
            include: {
                submission: {
                    include: {
                        project: true,
                    },
                },
                changedBy: true,
            },
            orderBy: {
                effectiveDate: "desc",
            },
            take: limit,
        });
        res.json({
            committeeCode,
            items: activity.map((entry) => ({
                id: entry.id,
                submissionId: entry.submissionId,
                projectCode: entry.submission.project?.projectCode ?? "N/A",
                projectTitle: entry.submission.project?.title ?? "N/A",
                piName: entry.submission.project?.piName ?? "N/A",
                oldStatus: entry.oldStatus,
                newStatus: entry.newStatus,
                effectiveDate: entry.effectiveDate,
                reason: entry.reason,
                changedBy: entry.changedBy
                    ? {
                        id: entry.changedBy.id,
                        fullName: entry.changedBy.fullName,
                        email: entry.changedBy.email,
                    }
                    : null,
            })),
        });
    }
    catch (error) {
        console.error("Error loading dashboard activity:", error);
        res.status(500).json({ message: "Failed to load dashboard activity" });
    }
});
// RA dashboard - queues overview (HTML page)
router.get("/ra/dashboard", async (_req, res, next) => {
    try {
        const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>RA Dashboard – ${branding_1.BRAND.committeeLabel}</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; max-width: 1100px; }
      h1 { margin-bottom: 0.5rem; }
      p { margin-top: 0; color: #4b5563; }
      .tabs { display: flex; gap: 8px; margin-bottom: 12px; }
      .tab-btn {
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid #d1d5db;
        background: #f9fafb;
        cursor: pointer;
        font-size: 13px;
      }
      .tab-btn.active {
        background: #2563eb;
        color: white;
        border-color: #2563eb;
      }
      table { border-collapse: collapse; width: 100%; margin-top: 0.5rem; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 13px; }
      th { background: #f3f4f6; text-align: left; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; background: #eef2ff; }
      .btn-link { color: #2563eb; text-decoration: none; font-size: 13px; }
    </style>
  </head>
  <body>
    <h1>RA Dashboard – ${branding_1.BRAND.committeeLabel}</h1>
    <p>Queues based on current submission statuses. Click "Open submission" for details.</p>

    <div class="tabs">
      <button class="tab-btn active" data-tab="classification">Classification queue</button>
      <button class="tab-btn" data-tab="review">Review queue</button>
      <button class="tab-btn" data-tab="revision">Revision queue</button>
    </div>

    <div id="table-container"><p>Loading…</p></div>

    <script>
      const committeeCode = "RERC-HUMAN";
      let queuesData = null;
      let currentTab = "classification";

      async function loadQueues() {
        const res = await fetch("/dashboard/queues?committeeCode=" + encodeURIComponent(committeeCode));
        queuesData = await res.json();
        renderTable();
      }

      function renderTable() {
        if (!queuesData) return;
        const container = document.getElementById("table-container");

        let rows = [];
        if (currentTab === "classification") {
          rows = queuesData.classificationQueue;
        } else if (currentTab === "review") {
          rows = queuesData.reviewQueue;
        } else {
          rows = queuesData.revisionQueue;
        }

        if (!rows || rows.length === 0) {
          container.innerHTML = "<p><em>No items in this queue.</em></p>";
          return;
        }

        const rowsHtml = rows
          .map((s) => {
            const received = new Date(s.receivedDate).toISOString().slice(0, 10);
            return \`
            <tr>
              <td>\${escapeHtml(s.project.projectCode)}</td>
              <td>\${escapeHtml(s.project.title)}</td>
              <td>\${escapeHtml(s.project.piName)}</td>
              <td>\${escapeHtml(s.submissionType)}</td>
              <td><span class="badge">\${escapeHtml(s.status)}</span></td>
              <td>\${received}</td>
              <td><a class="btn-link" href="/ra/submissions/\${s.id}">Open submission</a></td>
            </tr>\`;
          })
          .join("");

        container.innerHTML = \`
          <table>
            <thead>
              <tr>
                <th>Project code</th>
                <th>Title</th>
                <th>PI</th>
                <th>Submission type</th>
                <th>Status</th>
                <th>Received</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>\${rowsHtml}</tbody>
          </table>\`;
      }

      document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          currentTab = btn.getAttribute("data-tab");
          renderTable();
        });
      });

      loadQueues();
    </script>
  </body>
</html>`;
        res.send(html);
    }
    catch (error) {
        next(error);
    }
});
// RA submission detail page with letter actions (HTML page)
router.get("/ra/submissions/:submissionId", async (req, res, next) => {
    try {
        const submissionId = Number(req.params.submissionId);
        if (Number.isNaN(submissionId)) {
            return res.status(400).send("Invalid submission id");
        }
        const submission = await prismaClient_1.default.submission.findUnique({
            where: { id: submissionId },
            include: {
                project: {
                    include: {
                        committee: true,
                        createdBy: true,
                    },
                },
                classification: true,
                statusHistory: {
                    orderBy: { effectiveDate: "asc" },
                    include: { changedBy: true },
                },
            },
        });
        if (!submission || !submission.project || !submission.project.committee) {
            return res.status(404).send("Submission not found");
        }
        const project = submission.project;
        const canDownloadAck = true;
        const canDownloadApproval = submission.finalDecision === "APPROVED" &&
            project.approvalStartDate &&
            project.approvalEndDate;
        const statusRows = submission.statusHistory
            .map((history) => {
            const date = history.effectiveDate?.toISOString().slice(0, 10) ?? "-";
            const who = escapeHtml(history.changedBy?.fullName ?? "System");
            return `<tr>
            <td>${date}</td>
            <td>${escapeHtml(history.oldStatus ?? "")}</td>
            <td>${escapeHtml(history.newStatus ?? "")}</td>
            <td>${who}</td>
            <td>${escapeHtml(history.reason ?? "")}</td>
          </tr>`;
        })
            .join("") ||
            `<tr><td colspan="5"><em>No status changes recorded yet.</em></td></tr>`;
        const classificationBlock = submission.classification
            ? `
      <p><strong>Review type:</strong> ${escapeHtml(submission.classification.reviewType)}</p>
      <p><strong>Classification date:</strong> ${submission.classification.classificationDate
                ?.toISOString()
                .slice(0, 10) ?? "-"}</p>
      <p><strong>Rationale:</strong> ${escapeHtml(submission.classification.rationale ?? "-")}</p>
    `
            : "<p><em>No classification recorded yet.</em></p>";
        const approvalBlock = canDownloadApproval
            ? `
      <p><strong>Final decision:</strong> ${escapeHtml(submission.finalDecision ?? "")}</p>
      <p><strong>Final decision date:</strong> ${submission.finalDecisionDate?.toISOString().slice(0, 10) ?? "-"}</p>
      <p><strong>Approval period:</strong> ${project.approvalStartDate?.toISOString().slice(0, 10) ?? "?"} to ${project.approvalEndDate?.toISOString().slice(0, 10) ?? "?"}</p>
    `
            : "<p><em>No approval period set yet.</em></p>";
        const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>RA – Submission ${submission.id}</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; max-width: 960px; }
      h1, h2 { margin-bottom: 0.3rem; }
      p { margin-top: 0; }
      .section { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #e5e7eb; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #eef2ff; }
      table { border-collapse: collapse; width: 100%; margin-top: 0.5rem; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 13px; }
      th { background: #f3f4f6; text-align: left; }
      .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 4px 16px; font-size: 14px; }
      .btn { display: inline-block; padding: 6px 12px; font-size: 14px; border-radius: 4px; border: 1px solid #4b5563; text-decoration: none; color: #111827; background: #f9fafb; }
      .btn.primary { background: #2563eb; border-color: #2563eb; color: white; }
      .btn.disabled { opacity: 0.5; pointer-events: none; }
      .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    </style>
  </head>
  <body>
    <a href="/ra/dashboard" class="btn">&larr; Back to RA dashboard</a>
    <h1>Submission ${submission.id} <span class="badge">${submission.status}</span></h1>

    <div class="section">
      <h2>Project information</h2>
      <div class="meta-grid">
        <div><strong>Project code:</strong> ${escapeHtml(project.projectCode)}</div>
        <div><strong>Title:</strong> ${escapeHtml(project.title ?? "-")}</div>
        <div><strong>PI:</strong> ${escapeHtml(project.piName ?? "-")}</div>
        <div><strong>Affiliation:</strong> ${escapeHtml(project.piAffiliation ?? "-")}</div>
        <div><strong>Committee:</strong> ${escapeHtml(project.committee.code)} – ${escapeHtml(project.committee.name)}</div>
        <div><strong>Submission type:</strong> ${escapeHtml(submission.submissionType ?? "-")}</div>
        <div><strong>Received date:</strong> ${submission.receivedDate
            ? submission.receivedDate.toISOString().slice(0, 10)
            : "-"}</div>
      </div>
    </div>

    <div class="section">
      <h2>Classification</h2>
      ${classificationBlock}
    </div>

    <div class="section">
      <h2>Approval summary</h2>
      ${approvalBlock}
    </div>

    <div class="section">
      <h2>Actions / Letters</h2>
      <p>Use these buttons to generate Word letters with the current database values.</p>
      <div class="actions">
        ${canDownloadAck
            ? `<a class="btn" href="/letters/initial-ack/${submission.id}.docx">Download Initial Acknowledgment Letter</a>`
            : `<span class="btn disabled">Initial acknowledgment not available</span>`}
        ${canDownloadApproval
            ? `<a class="btn primary" href="/letters/initial-approval/${submission.id}.docx">Download Initial Approval Letter</a>`
            : `<span class="btn disabled">Approval letter not available yet</span>`}
      </div>
    </div>

    <div class="section">
      <h2>Status history</h2>
      <table>
        <thead>
          <tr>
            <th>Effective date</th>
            <th>From</th>
            <th>To</th>
            <th>Changed by</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${statusRows}
        </tbody>
      </table>
    </div>
  </body>
</html>`;
        res.send(html);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
