import express from "express";
import path from "path";
import "dotenv/config";
import prisma from "./prisma";
import { workingDaysBetween } from "./slaUtils";
import { SubmissionStatus } from "./generated/prisma/client";
import {
  buildInitialAckLetter,
  buildInitialApprovalLetter,
} from "./letters";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str: string;
  if (value instanceof Date) {
    str = value.toISOString().slice(0, 10);
  } else {
    str = String(value);
  }

  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Root route – just to check server status
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "RERC API skeleton running" });
});

// DB health route – checks Prisma/Postgres connection
app.get("/health", async (_req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({
      status: "ok",
      db: "connected",
      userCount,
    });
  } catch (error) {
    console.error("DB healthcheck failed:", error);
    res.status(500).json({
      status: "error",
      db: "unreachable",
    });
  }
});

// List committees with panels and members (including user info)
app.get("/committees", async (_req, res) => {
  try {
    const committees = await prisma.committee.findMany({
      include: {
        panels: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    res.json(committees);
  } catch (error) {
    console.error("Error fetching committees:", error);
    res.status(500).json({ message: "Failed to fetch committees" });
  }
});

// Get a panel with its members
app.get("/panels/:id/members", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid panel id" });
    }

    const panel = await prisma.panel.findUnique({
      where: { id },
      include: {
        committee: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    res.json({
      id: panel.id,
      name: panel.name,
      code: panel.code,
      committee: {
        id: panel.committee.id,
        code: panel.committee.code,
        name: panel.committee.name,
      },
      members: panel.members.map((member) => ({
        id: member.id,
        role: member.role,
        isActive: member.isActive,
        createdAt: member.createdAt,
        user: {
          id: member.user.id,
          fullName: member.user.fullName,
          email: member.user.email,
          isActive: member.user.isActive,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching panel members:", error);
    res.status(500).json({ message: "Failed to fetch panel members" });
  }
});

// Get all panels for a committee including members
app.get("/committees/:code/panels", async (req, res) => {
  try {
    const committee = await prisma.committee.findUnique({
      where: { code: req.params.code },
      include: {
        panels: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!committee) {
      return res.status(404).json({ message: "Committee not found" });
    }

    res.json({
      id: committee.id,
      code: committee.code,
      name: committee.name,
      panels: committee.panels.map((panel) => ({
        id: panel.id,
        name: panel.name,
        code: panel.code,
        isActive: panel.isActive,
        members: panel.members.map((member) => ({
          id: member.id,
          role: member.role,
          isActive: member.isActive,
          user: {
            id: member.user.id,
            fullName: member.user.fullName,
            email: member.user.email,
            isActive: member.user.isActive,
          },
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching committee panels:", error);
    res.status(500).json({ message: "Failed to fetch committee panels" });
  }
});

// Dashboard queues for classification, review, revision
app.get("/dashboard/queues", async (req, res) => {
  try {
    const committeeCode = String(req.query.committeeCode || "RERC-HUMAN");

    const classificationQueue = await prisma.submission.findMany({
      where: {
        status: { in: ["RECEIVED", "UNDER_CLASSIFICATION"] },
        project: {
          committee: {
            code: committeeCode,
          },
        },
      },
      include: {
        project: true,
        classification: true,
      },
      orderBy: {
        receivedDate: "asc",
      },
    });

    const reviewQueue = await prisma.submission.findMany({
      where: {
        status: "UNDER_REVIEW",
        project: {
          committee: {
            code: committeeCode,
          },
        },
      },
      include: {
        project: true,
        classification: true,
      },
      orderBy: {
        receivedDate: "asc",
      },
    });

    const revisionQueue = await prisma.submission.findMany({
      where: {
        status: "AWAITING_REVISIONS",
        project: {
          committee: {
            code: committeeCode,
          },
        },
      },
      include: {
        project: true,
        classification: true,
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
  } catch (error) {
    console.error("Error generating dashboard queues:", error);
    res.status(500).json({ message: "Failed to load dashboard queues" });
  }
});

// Mail-merge CSV export for initial submission acknowledgment letters
app.get("/mail-merge/initial-ack.csv", async (req, res) => {
  try {
    const committeeCode = req.query.committeeCode
      ? String(req.query.committeeCode)
      : "RERC-HUMAN";
    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;
    const letterDateParam = req.query.letterDate as string | undefined;

    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    let letterDate: Date = new Date();

    if (fromParam) {
      const parsed = new Date(fromParam);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid from date" });
      }
      fromDate = parsed;
    }

    if (toParam) {
      const parsed = new Date(toParam);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid to date" });
      }
      toDate = parsed;
    }

    if (letterDateParam) {
      const parsed = new Date(letterDateParam);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid letterDate" });
      }
      letterDate = parsed;
    }

    const where: any = {
      submissionType: "INITIAL",
      project: {
        committee: {
          code: committeeCode,
        },
      },
    };

    if (fromDate || toDate) {
      where.receivedDate = {};
      if (fromDate) {
        where.receivedDate.gte = fromDate;
      }
      if (toDate) {
        where.receivedDate.lte = toDate;
      }
    }

    const submissions = await prisma.submission.findMany({
      where,
      include: {
        project: {
          include: {
            committee: true,
          },
        },
        classification: true,
        createdBy: true,
      },
      orderBy: {
        receivedDate: "asc",
      },
    });

    const headers = [
      "project_code",
      "project_title",
      "pi_name",
      "pi_affiliation",
      "committee_code",
      "committee_name",
      "submission_type",
      "review_type",
      "received_date",
      "classification_date",
      "letter_date",
      "ra_full_name",
      "ra_email",
    ];

    const rows: string[] = [headers.join(",")];

    for (const submission of submissions) {
      const project = submission.project;
      const committee = project.committee;
      const classification = submission.classification;
      const ra = submission.createdBy;

      rows.push(
        [
          csvEscape(project.projectCode),
          csvEscape(project.title),
          csvEscape(project.piName),
          csvEscape(project.piAffiliation),
          csvEscape(committee?.code ?? ""),
          csvEscape(committee?.name ?? ""),
          csvEscape(submission.submissionType),
          csvEscape(classification?.reviewType ?? ""),
          csvEscape(submission.receivedDate),
          csvEscape(classification?.classificationDate ?? ""),
          csvEscape(letterDate),
          csvEscape(ra?.fullName ?? ""),
          csvEscape(ra?.email ?? ""),
        ].join(","),
      );
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="initial_ack_mail_merge.csv"',
    );
    res.send(rows.join("\r\n"));
  } catch (error) {
    console.error("Error generating mail merge CSV:", error);
    res.status(500).json({ message: "Failed to generate CSV" });
  }
});

// Mail-merge CSV export for initial approval letters
app.get("/mail-merge/initial-approval.csv", async (req, res) => {
  try {
    const committeeCode = req.query.committeeCode
      ? String(req.query.committeeCode)
      : "RERC-HUMAN";
    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;
    const letterDateParam = req.query.letterDate as string | undefined;

    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    let letterDate: Date = new Date();

    if (fromParam) {
      const parsed = new Date(fromParam);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid from date" });
      }
      fromDate = parsed;
    }

    if (toParam) {
      const parsed = new Date(toParam);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid to date" });
      }
      toDate = parsed;
    }

    if (letterDateParam) {
      const parsed = new Date(letterDateParam);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid letterDate" });
      }
      letterDate = parsed;
    }

    const where: any = {
      submissionType: "INITIAL",
      finalDecision: "APPROVED",
      project: {
        committee: {
          code: committeeCode,
        },
      },
    };

    if (fromDate || toDate) {
      where.finalDecisionDate = {};
      if (fromDate) {
        where.finalDecisionDate.gte = fromDate;
      }
      if (toDate) {
        where.finalDecisionDate.lte = toDate;
      }
    }

    const submissions = await prisma.submission.findMany({
      where,
      include: {
        project: {
          include: {
            committee: true,
          },
        },
        classification: true,
        createdBy: true,
      },
      orderBy: {
        finalDecisionDate: "asc",
      },
    });

    const headers = [
      "project_code",
      "project_title",
      "pi_name",
      "pi_affiliation",
      "committee_code",
      "committee_name",
      "submission_type",
      "review_type",
      "final_decision",
      "final_decision_date",
      "approval_start_date",
      "approval_end_date",
      "letter_date",
      "ra_full_name",
      "ra_email",
    ];

    const rows: string[] = [headers.join(",")];

    for (const submission of submissions) {
      const project = submission.project;
      const committee = project.committee;
      const classification = submission.classification;
      const ra = submission.createdBy;

      rows.push(
        [
          csvEscape(project.projectCode),
          csvEscape(project.title),
          csvEscape(project.piName),
          csvEscape(project.piAffiliation),
          csvEscape(committee?.code ?? ""),
          csvEscape(committee?.name ?? ""),
          csvEscape(submission.submissionType),
          csvEscape(classification?.reviewType ?? ""),
          csvEscape(submission.finalDecision ?? ""),
          csvEscape(submission.finalDecisionDate ?? ""),
          csvEscape(project.approvalStartDate ?? ""),
          csvEscape(project.approvalEndDate ?? ""),
          csvEscape(letterDate),
          csvEscape(ra?.fullName ?? ""),
          csvEscape(ra?.email ?? ""),
        ].join(","),
      );
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="initial_approval_mail_merge.csv"',
    );
    res.send(rows.join("\r\n"));
  } catch (error) {
    console.error("Error generating approval mail merge CSV:", error);
    res.status(500).json({ message: "Failed to generate approval CSV" });
  }
});

// Mail merge payload for a single submission's initial acknowledgement letter
app.get("/mail-merge/initial-ack/:submissionId", async (req, res) => {
  try {
    const submissionId = Number(req.params.submissionId);
    if (Number.isNaN(submissionId)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        project: {
          include: {
            committee: true,
            createdBy: true,
          },
        },
        classification: true,
      },
    });

    if (!submission || !submission.project || !submission.project.committee) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const project = submission.project;
    const committee = project.committee;
    const classification = submission.classification;

    const letterDate = submission.receivedDate ?? new Date();

    res.json({
      project_code: project.projectCode,
      project_title: project.title,
      pi_name: project.piName,
      pi_affiliation: project.piAffiliation,
      committee_code: committee.code,
      committee_name: committee.name,
      submission_type: submission.submissionType,
      review_type: classification?.reviewType ?? null,
      received_date: submission.receivedDate,
      classification_date: classification?.classificationDate ?? null,
      letter_date: letterDate.toISOString().slice(0, 10),
      ra_full_name: project.createdBy?.fullName ?? null,
      ra_email: project.createdBy?.email ?? null,
    });
  } catch (error) {
    console.error("Error building initial ack payload:", error);
    res.status(500).json({ message: "Failed to build initial ack payload" });
  }
});

// Mail merge payload for a single submission's initial approval letter
app.get("/mail-merge/initial-approval/:submissionId", async (req, res) => {
  try {
    const submissionId = Number(req.params.submissionId);
    if (Number.isNaN(submissionId)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        project: {
          include: {
            committee: true,
            createdBy: true,
          },
        },
        classification: true,
      },
    });

    if (!submission || !submission.project || !submission.project.committee) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const project = submission.project;
    const committee = project.committee;
    const classification = submission.classification;

    const letterDate =
      submission.finalDecisionDate ??
      project.approvalStartDate ??
      new Date();

    res.json({
      project_code: project.projectCode,
      project_title: project.title,
      pi_name: project.piName,
      pi_affiliation: project.piAffiliation,
      committee_code: committee.code,
      committee_name: committee.name,
      submission_type: submission.submissionType,
      review_type: classification?.reviewType ?? null,
      final_decision: submission.finalDecision,
      final_decision_date: submission.finalDecisionDate,
      approval_start_date: project.approvalStartDate,
      approval_end_date: project.approvalEndDate,
      letter_date: letterDate.toISOString().slice(0, 10),
      ra_full_name: project.createdBy?.fullName ?? null,
      ra_email: project.createdBy?.email ?? null,
    });
  } catch (error) {
    console.error("Error building initial approval payload:", error);
    res.status(500).json({ message: "Failed to build initial approval payload" });
  }
});

app.get("/letters/initial-ack/:submissionId.docx", async (req, res) => {
  try {
    const submissionId = Number(req.params.submissionId);
    if (Number.isNaN(submissionId)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }
    const buffer = await buildInitialAckLetter(submissionId);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=initial_ack_${submissionId}.docx`,
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error generating initial ack letter:", error);
    res.status(500).json({ message: "Failed to generate letter" });
  }
});

app.get("/letters/initial-approval/:submissionId.docx", async (req, res) => {
  try {
    const submissionId = Number(req.params.submissionId);
    if (Number.isNaN(submissionId)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }
    const buffer = await buildInitialApprovalLetter(submissionId);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=initial_approval_${submissionId}.docx`,
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error generating initial approval letter:", error);
    res.status(500).json({ message: "Failed to generate letter" });
  }
});

// RA dashboard - queues overview
app.get("/ra/dashboard", async (_req, res, next) => {
  try {
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>RA Dashboard – RERC-HUMAN</title>
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
    <h1>RA Dashboard – RERC-HUMAN</h1>
    <p>Queues based on current submission statuses. Click “Open submission” for details.</p>

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
              <td>\${s.project.projectCode}</td>
              <td>\${s.project.title}</td>
              <td>\${s.project.piName}</td>
              <td>\${s.submissionType}</td>
              <td><span class="badge">\${s.status}</span></td>
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
  } catch (error) {
    next(error);
  }
});

// RA submission detail page with letter actions
app.get("/ra/submissions/:submissionId", async (req, res, next) => {
  try {
    const submissionId = Number(req.params.submissionId);
    if (Number.isNaN(submissionId)) {
      return res.status(400).send("Invalid submission id");
    }

    const submission = await prisma.submission.findUnique({
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
    const canDownloadApproval =
      submission.finalDecision === "APPROVED" &&
      project.approvalStartDate &&
      project.approvalEndDate;

    const statusRows =
      submission.statusHistory
        .map((history) => {
          const date = history.effectiveDate?.toISOString().slice(0, 10) ?? "-";
          const who = history.changedBy?.fullName ?? "System";
          return `<tr>
            <td>${date}</td>
            <td>${history.oldStatus ?? ""}</td>
            <td>${history.newStatus ?? ""}</td>
            <td>${who}</td>
            <td>${history.reason ?? ""}</td>
          </tr>`;
        })
        .join("") || `<tr><td colspan="5"><em>No status changes recorded yet.</em></td></tr>`;

    const classificationBlock = submission.classification
      ? `
      <p><strong>Review type:</strong> ${submission.classification.reviewType}</p>
      <p><strong>Classification date:</strong> ${
        submission.classification.classificationDate?.toISOString().slice(0, 10) ?? "-"
      }</p>
      <p><strong>Rationale:</strong> ${submission.classification.rationale ?? "-"}</p>
    `
      : "<p><em>No classification recorded yet.</em></p>";

    const approvalBlock = canDownloadApproval
      ? `
      <p><strong>Final decision:</strong> ${submission.finalDecision}</p>
      <p><strong>Final decision date:</strong> ${
        submission.finalDecisionDate?.toISOString().slice(0, 10) ?? "-"
      }</p>
      <p><strong>Approval period:</strong> ${
        project.approvalStartDate?.toISOString().slice(0, 10) ?? "?"
      } to ${project.approvalEndDate?.toISOString().slice(0, 10) ?? "?"}</p>
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
        <div><strong>Project code:</strong> ${project.projectCode}</div>
        <div><strong>Title:</strong> ${project.title}</div>
        <div><strong>PI:</strong> ${project.piName}</div>
        <div><strong>Affiliation:</strong> ${project.piAffiliation ?? "-"}</div>
        <div><strong>Committee:</strong> ${project.committee.code} – ${project.committee.name}</div>
        <div><strong>Submission type:</strong> ${submission.submissionType}</div>
        <div><strong>Received date:</strong> ${submission.receivedDate.toISOString().slice(0, 10)}</div>
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
        ${
          canDownloadAck
            ? `<a class="btn" href="/letters/initial-ack/${submission.id}.docx">Download Initial Acknowledgment Letter</a>`
            : `<span class="btn disabled">Initial acknowledgment not available</span>`
        }
        ${
          canDownloadApproval
            ? `<a class="btn primary" href="/letters/initial-approval/${submission.id}.docx">Download Initial Approval Letter</a>`
            : `<span class="btn disabled">Approval letter not available yet</span>`
        }
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
  } catch (error) {
    next(error);
  }
});


// Create a new project (RA / Chair encoding a protocol)
app.post("/projects", async (req, res) => {
  try {
    const {
      projectCode,
      title,
      piName,
      piAffiliation,
      fundingType,
      committeeId,
      initialSubmissionDate,
    } = req.body;

    // Basic required field checks
    if (!projectCode || !title || !piName || !fundingType || !committeeId) {
      return res.status(400).json({
        message:
          "projectCode, title, piName, fundingType, and committeeId are required",
      });
    }

    // Very light fundingType validation – ties to Prisma enum FundingType
    const allowedFundingTypes = [
      "INTERNAL",
      "EXTERNAL",
      "SELF_FUNDED",
      "NO_FUNDING",
    ];
    if (!allowedFundingTypes.includes(fundingType)) {
      return res.status(400).json({
        message: `Invalid fundingType. Allowed: ${allowedFundingTypes.join(", ")}`,
      });
    }

    // Parse date if provided
    const initialDate = initialSubmissionDate
      ? new Date(initialSubmissionDate)
      : null;

    const project = await prisma.project.create({
      data: {
        projectCode,
        title,
        piName,
        piAffiliation,
        fundingType, // Prisma will enforce the enum
        committeeId,
        initialSubmissionDate: initialDate,
        // TODO: replace with real logged-in user later
        createdById: 1, // RA user from seed
      },
    });

    res.status(201).json(project);
  } catch (error: any) {
    console.error("Error creating project:", error);

    // Unique constraint on projectCode
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "Project code already exists",
      });
    }

    res.status(500).json({ message: "Failed to create project" });
  }
});

// List all projects (with basic metadata)
app.get("/projects", async (_req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        committee: true, // which committee handles it
        createdBy: true, // which user encoded it
      },
    });

    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
});

// Get a single project by id
app.get("/projects/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid project id" });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        committee: true,
        createdBy: true,
        submissions: {
          orderBy: { sequenceNumber: "asc" },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ message: "Failed to fetch project" });
  }
});

// Get full project lifecycle (all submissions, classifications, reviews, status history)
app.get("/projects/:id/full", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid project id" });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        committee: true,
        createdBy: true,
        submissions: {
          orderBy: [
            { receivedDate: "asc" },
            { id: "asc" },
          ],
          include: {
            classification: true,
            reviews: {
              include: {
                reviewer: true,
              },
            },
            statusHistory: {
              orderBy: { effectiveDate: "asc" },
              include: {
                changedBy: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json(project);
  } catch (error) {
    console.error("Error fetching full project:", error);
    res.status(500).json({ message: "Failed to fetch project lifecycle" });
  }
});

// Create a submission for a project (initial, amendment, etc.)
app.post("/projects/:projectId/submissions", async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid projectId" });
    }

    const {
      submissionType, // e.g. "INITIAL", "AMENDMENT", ...
      receivedDate, // ISO string
      documentLink, // optional string
      completenessStatus, // e.g. "COMPLETE", "MINOR_MISSING", ...
      completenessRemarks, // optional string
    } = req.body;

    // Basic required fields
    if (!submissionType || !receivedDate) {
      return res.status(400).json({
        message: "submissionType and receivedDate are required",
      });
    }

    const allowedSubmissionTypes = [
      "INITIAL",
      "AMENDMENT",
      "CONTINUING_REVIEW",
      "FINAL_REPORT",
      "WITHDRAWAL",
      "SAFETY_REPORT",
      "PROTOCOL_DEVIATION",
    ];
    if (!allowedSubmissionTypes.includes(submissionType)) {
      return res.status(400).json({
        message: `Invalid submissionType. Allowed: ${allowedSubmissionTypes.join(", ")}`,
      });
    }

    const allowedCompleteness = [
      "COMPLETE",
      "MINOR_MISSING",
      "MAJOR_MISSING",
      "MISSING_SIGNATURES",
      "OTHER",
    ];
    if (
      completenessStatus &&
      !allowedCompleteness.includes(completenessStatus)
    ) {
      return res.status(400).json({
        message: `Invalid completenessStatus. Allowed: ${allowedCompleteness.join(", ")}`,
      });
    }

    const receivedAt = new Date(receivedDate);

    // Compute next sequenceNumber for this project
    const existingCount = await prisma.submission.count({
      where: { projectId },
    });
    const sequenceNumber = existingCount + 1;

    const submission = await prisma.submission.create({
      data: {
        projectId,
        submissionType,
        sequenceNumber,
        receivedDate: receivedAt,
        documentLink,
        completenessStatus: completenessStatus || "COMPLETE",
        completenessRemarks,
        createdById: 1, // RA for now - later: logged-in user
      },
    });

    res.status(201).json(submission);
  } catch (error) {
    console.error("Error creating submission:", error);
    res.status(500).json({ message: "Failed to create submission" });
  }
});

// Classify a submission (EXEMPT / EXPEDITED / FULL_BOARD)
app.post("/submissions/:submissionId/classifications", async (req, res) => {
  try {
    const submissionId = Number(req.params.submissionId);
    if (Number.isNaN(submissionId)) {
      return res.status(400).json({ message: "Invalid submissionId" });
    }

    const { reviewType, classificationDate, panelId, rationale } = req.body;

    if (!reviewType || !classificationDate) {
      return res.status(400).json({
        message: "reviewType and classificationDate are required",
      });
    }

    const allowedReviewTypes = ["EXEMPT", "EXPEDITED", "FULL_BOARD"];
    if (!allowedReviewTypes.includes(reviewType)) {
      return res.status(400).json({
        message: `Invalid reviewType. Allowed: ${allowedReviewTypes.join(", ")}`,
      });
    }

    const classifiedAt = new Date(classificationDate);

    // Optional: verify the submission exists
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // For FULL_BOARD, panelId should be provided; for EXEMPT/EXPEDITED, it's optional
    const classification = await prisma.classification.upsert({
      where: { submissionId }, // there should be max 1 per submission
      update: {
        reviewType,
        classificationDate: classifiedAt,
        panelId: panelId ?? null,
        rationale,
        classifiedById: 1, // RA/Chair for now
      },
      create: {
        submissionId,
        reviewType,
        classificationDate: classifiedAt,
        panelId: panelId ?? null,
        rationale,
        classifiedById: 1,
      },
    });

    res.status(201).json(classification);
  } catch (error) {
    console.error("Error classifying submission:", error);
    res.status(500).json({ message: "Failed to classify submission" });
  }
});

// Get a submission with its classification
app.get("/submissions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        project: true,
        classification: {
          include: {
            panel: true,
            classifiedBy: true,
          },
        },
        reviews: {
          include: {
            reviewer: true,
          },
          orderBy: { assignedAt: "asc" },
        },
        statusHistory: {
          include: {
            changedBy: true,
          },
          orderBy: { effectiveDate: "asc" },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    res.json(submission);
  } catch (error) {
    console.error("Error fetching submission:", error);
    res.status(500).json({ message: "Failed to fetch submission" });
  }
});

// Change submission status and log history
app.patch("/submissions/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }

    const { newStatus, reason } = req.body;

    const allowedStatuses = [
      "RECEIVED",
      "UNDER_COMPLETENESS_CHECK",
      "AWAITING_CLASSIFICATION",
      "UNDER_CLASSIFICATION",
      "CLASSIFIED",
      "UNDER_REVIEW",
      "AWAITING_REVISIONS",
      "REVISION_SUBMITTED",
      "CLOSED",
      "WITHDRAWN",
    ];

    if (!newStatus || !allowedStatuses.includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
      });
    }

    const submission = await prisma.submission.findUnique({
      where: { id },
      select: {
        status: true,
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const changedById = 1; // TODO: replace with authenticated user later

    const [history, updated] = await prisma.$transaction([
      prisma.submissionStatusHistory.create({
        data: {
          submissionId: id,
          oldStatus: submission.status,
          newStatus,
          reason,
          changedById,
        },
      }),
      prisma.submission.update({
        where: { id },
        data: { status: newStatus },
      }),
    ]);

    res.json({ submission: updated, history });
  } catch (error) {
    console.error("Error updating submission status:", error);
    res.status(500).json({ message: "Failed to update submission status" });
  }
});

// Assign a reviewer to a submission
app.post("/submissions/:submissionId/reviews", async (req, res) => {
  try {
    const submissionId = Number(req.params.submissionId);
    if (Number.isNaN(submissionId)) {
      return res.status(400).json({ message: "Invalid submissionId" });
    }

    const reviewerId = Number(req.body.reviewerId);
    if (Number.isNaN(reviewerId)) {
      return res.status(400).json({ message: "Invalid reviewerId" });
    }

    const isPrimary = Boolean(req.body.isPrimary);

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
    });
    if (!reviewer) {
      return res.status(404).json({ message: "Reviewer not found" });
    }

    const review = await prisma.review.create({
      data: {
        submissionId,
        reviewerId,
        isPrimary,
      },
    });

    res.status(201).json(review);
  } catch (error) {
    console.error("Error assigning reviewer:", error);
    res.status(500).json({ message: "Failed to assign reviewer" });
  }
});

// Record a decision for a review
app.post("/reviews/:reviewId/decision", async (req, res) => {
  try {
    const reviewId = Number(req.params.reviewId);
    if (Number.isNaN(reviewId)) {
      return res.status(400).json({ message: "Invalid reviewId" });
    }

    const { decision, remarks } = req.body;
    if (!decision) {
      return res.status(400).json({ message: "decision is required" });
    }

    const allowedDecisions = [
      "APPROVED",
      "MINOR_REVISIONS",
      "MAJOR_REVISIONS",
      "DISAPPROVED",
      "INFO_ONLY",
    ];
    if (!allowedDecisions.includes(decision)) {
      return res.status(400).json({
        message: `Invalid decision. Allowed: ${allowedDecisions.join(", ")}`,
      });
    }

    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!existingReview) {
      return res.status(404).json({ message: "Review not found" });
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        decision,
        remarks,
        respondedAt: new Date(),
      },
    });

    res.json(updatedReview);
  } catch (error) {
    console.error("Error recording review decision:", error);
    res.status(500).json({ message: "Failed to record decision" });
  }
});

// Record final decision for a submission and update project approvals
app.post("/submissions/:id/final-decision", async (req, res) => {
  try {
    const submissionId = Number(req.params.id);
    if (Number.isNaN(submissionId)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }

    const {
      finalDecision,
      finalDecisionDate,
      approvalStartDate,
      approvalEndDate,
    } = req.body;

    if (!finalDecision) {
      return res.status(400).json({ message: "finalDecision is required" });
    }

    const allowedDecisions = [
      "APPROVED",
      "MINOR_REVISIONS",
      "MAJOR_REVISIONS",
      "DISAPPROVED",
      "WITHDRAWN",
    ];

    if (!allowedDecisions.includes(finalDecision)) {
      return res.status(400).json({
        message: `Invalid finalDecision. Allowed: ${allowedDecisions.join(", ")}`,
      });
    }

    let decisionDate = finalDecisionDate ? new Date(finalDecisionDate) : new Date();
    if (Number.isNaN(decisionDate.getTime())) {
      return res.status(400).json({ message: "Invalid finalDecisionDate" });
    }

    let approvalStart = approvalStartDate ? new Date(approvalStartDate) : null;
    if (approvalStart && Number.isNaN(approvalStart.getTime())) {
      return res.status(400).json({ message: "Invalid approvalStartDate" });
    }

    let approvalEnd = approvalEndDate ? new Date(approvalEndDate) : null;
    if (approvalEnd && Number.isNaN(approvalEnd.getTime())) {
      return res.status(400).json({ message: "Invalid approvalEndDate" });
    }

    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        finalDecision,
        finalDecisionDate: decisionDate,
        project:
          approvalStart || approvalEnd
            ? {
                update: {
                  approvalStartDate: approvalStart ?? undefined,
                  approvalEndDate: approvalEnd ?? undefined,
                },
              }
            : undefined,
      },
      include: {
        project: true,
      },
    });

    res.json(submission);
  } catch (error) {
    console.error("Error recording final decision:", error);
    res.status(500).json({ message: "Failed to record final decision" });
  }
});

// Summarize SLA compliance for a submission (currently classification SLA)
app.get("/submissions/:id/sla-summary", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        project: {
          include: { committee: true },
        },
        classification: true,
        statusHistory: {
          orderBy: { effectiveDate: "asc" },
        },
        reviews: true,
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (!submission.project?.committee) {
      return res.status(400).json({ message: "Submission has no committee" });
    }

    if (!submission.classification) {
      return res
        .status(400)
        .json({ message: "Submission has not been classified yet" });
    }

    const committeeId = submission.project.committeeId;
    const reviewType = submission.classification.reviewType; // EXEMPT / EXPEDITED / FULL_BOARD

    const classificationSlaConfig = await prisma.configSLA.findFirst({
      where: {
        committeeId,
        stage: "CLASSIFICATION",
        reviewType,
        isActive: true,
      },
    });

    const classificationStartHistory = submission.statusHistory.find(
      (history) => history.newStatus === SubmissionStatus.UNDER_CLASSIFICATION,
    );

    const classificationStart =
      classificationStartHistory?.effectiveDate ?? submission.receivedDate;

    const classificationEnd =
      submission.classification.classificationDate ?? new Date();

    const classificationActual = workingDaysBetween(
      new Date(classificationStart),
      new Date(classificationEnd),
    );

    const classificationConfigured = classificationSlaConfig?.workingDays ?? null;
    const classificationWithin =
      classificationConfigured === null
        ? null
        : classificationActual <= classificationConfigured;

    const reviewSlaConfig = await prisma.configSLA.findFirst({
      where: {
        committeeId,
        stage: "REVIEW",
        reviewType,
        isActive: true,
      },
    });

    const reviewStartHistory = submission.statusHistory.find(
      (history) => history.newStatus === SubmissionStatus.UNDER_REVIEW,
    );
    const reviewStart = reviewStartHistory?.effectiveDate ?? null;

    const reviewEndHistory = submission.statusHistory.find((history) => {
      const status = history.newStatus;
      if (!status) {
        return false;
      }
      return (
        status === SubmissionStatus.AWAITING_REVISIONS ||
        status === SubmissionStatus.REVISION_SUBMITTED ||
        status === SubmissionStatus.CLOSED ||
        status === SubmissionStatus.WITHDRAWN
      );
    });
    const reviewEnd = reviewEndHistory?.effectiveDate ?? null;

    let reviewActual: number | null = null;
    let reviewWithin: boolean | null = null;
    if (reviewStart && reviewEnd && reviewSlaConfig) {
      reviewActual = workingDaysBetween(
        new Date(reviewStart),
        new Date(reviewEnd),
      );
      reviewWithin = reviewActual <= reviewSlaConfig.workingDays;
    }

    const revisionSlaConfig = await prisma.configSLA.findFirst({
      where: {
        committeeId,
        stage: "REVISION_RESPONSE",
        reviewType: null,
        isActive: true,
      },
    });

    const revisionStartHistory = submission.statusHistory.find(
      (history) => history.newStatus === SubmissionStatus.AWAITING_REVISIONS,
    );
    const revisionEndHistory = submission.statusHistory.find(
      (history) => history.newStatus === SubmissionStatus.REVISION_SUBMITTED,
    );

    const revisionStart = revisionStartHistory?.effectiveDate ?? null;
    const revisionEnd = revisionEndHistory?.effectiveDate ?? null;

    let revisionActual: number | null = null;
    let revisionWithin: boolean | null = null;
    if (revisionStart && revisionEnd && revisionSlaConfig) {
      revisionActual = workingDaysBetween(
        new Date(revisionStart),
        new Date(revisionEnd),
      );
      revisionWithin = revisionActual <= revisionSlaConfig.workingDays;
    }

    res.json({
      submissionId: submission.id,
      committeeCode: submission.project.committee.code,
      reviewType,
      classification: {
        start: classificationStart,
        end: classificationEnd,
        configuredWorkingDays: classificationConfigured,
        actualWorkingDays: classificationActual,
        withinSla: classificationWithin,
        description: classificationSlaConfig?.description ?? null,
      },
      review: {
        start: reviewStart,
        end: reviewEnd,
        configuredWorkingDays: reviewSlaConfig?.workingDays ?? null,
        actualWorkingDays: reviewActual,
        withinSla: reviewWithin,
        description: reviewSlaConfig?.description ?? null,
      },
      revisionResponse: {
        start: revisionStart,
        end: revisionEnd,
        configuredWorkingDays: revisionSlaConfig?.workingDays ?? null,
        actualWorkingDays: revisionActual,
        withinSla: revisionWithin,
        description: revisionSlaConfig?.description ?? null,
      },
    });
  } catch (error) {
    console.error("Error building SLA summary:", error);
    res.status(500).json({ message: "Failed to build SLA summary" });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
