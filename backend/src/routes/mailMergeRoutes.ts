/**
 * Mail merge and letter generation routes
 */
import { Router } from "express";
import prisma from "../config/prismaClient";
import { csvEscape } from "../utils/csvUtils";
import {
  buildInitialAckLetter,
  buildInitialApprovalLetter,
} from "../services/letterGenerator";
import { Parser as Json2CsvParser } from "json2csv";

const router = Router();

// Mail-merge CSV export for initial submission acknowledgment letters
router.get("/mail-merge/initial-ack.csv", async (req, res) => {
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
      if (!project) {
        continue;
      }
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
        ].join(",")
      );
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="initial_ack_mail_merge.csv"'
    );
    res.send(rows.join("\r\n"));
  } catch (error) {
    console.error("Error generating mail merge CSV:", error);
    res.status(500).json({ message: "Failed to generate CSV" });
  }
});

// Mail-merge CSV export for initial approval letters
router.get("/mail-merge/initial-approval.csv", async (req, res) => {
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
      if (!project) {
        continue;
      }
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
        ].join(",")
      );
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="initial_approval_mail_merge.csv"'
    );
    res.send(rows.join("\r\n"));
  } catch (error) {
    console.error("Error generating approval mail merge CSV:", error);
    res.status(500).json({ message: "Failed to generate approval CSV" });
  }
});

// Mail merge payload for a single submission's initial acknowledgement letter
router.get("/mail-merge/initial-ack/:submissionId", async (req, res) => {
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

// CSV export for initial acknowledgement
router.get("/mail-merge/initial-ack/:submissionId/csv", async (req, res) => {
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

    const data = {
      project_code: project.projectCode,
      project_title: project.title,
      pi_name: project.piName,
      pi_affiliation: project.piAffiliation,
      committee_code: committee.code,
      committee_name: committee.name,
      submission_type: submission.submissionType,
      review_type: classification?.reviewType ?? null,
      received_date:
        submission.receivedDate?.toISOString().slice(0, 10) ?? null,
      classification_date:
        classification?.classificationDate?.toISOString().slice(0, 10) ?? null,
      letter_date: letterDate.toISOString().slice(0, 10),
      ra_full_name: project.createdBy?.fullName ?? null,
      ra_email: project.createdBy?.email ?? null,
    };

    const fields = [
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

    const parser = new Json2CsvParser({ fields });
    const csv = parser.parse([data]);

    const filename = `initial_ack_${project.projectCode}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error("Error exporting initial ack CSV:", error);
    res.status(500).json({ message: "Failed to export CSV" });
  }
});

// Mail merge payload for a single submission's initial approval letter
router.get("/mail-merge/initial-approval/:submissionId", async (req, res) => {
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
      submission.finalDecisionDate ?? project.approvalStartDate ?? new Date();

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
    res
      .status(500)
      .json({ message: "Failed to build initial approval payload" });
  }
});

// CSV export for initial approval
router.get("/mail-merge/initial-approval/:submissionId/csv", async (req, res) => {
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
      submission.finalDecisionDate ?? project.approvalStartDate ?? new Date();

    const data = {
      project_code: project.projectCode,
      project_title: project.title,
      pi_name: project.piName,
      pi_affiliation: project.piAffiliation,
      committee_code: committee.code,
      committee_name: committee.name,
      submission_type: submission.submissionType,
      review_type: classification?.reviewType ?? null,
      final_decision: submission.finalDecision,
      final_decision_date:
        submission.finalDecisionDate?.toISOString().slice(0, 10) ?? null,
      approval_start_date:
        project.approvalStartDate?.toISOString().slice(0, 10) ?? null,
      approval_end_date:
        project.approvalEndDate?.toISOString().slice(0, 10) ?? null,
      letter_date: letterDate.toISOString().slice(0, 10),
      ra_full_name: project.createdBy?.fullName ?? null,
      ra_email: project.createdBy?.email ?? null,
    };

    const fields = [
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

    const parser = new Json2CsvParser({ fields });
    const csv = parser.parse([data]);

    const filename = `initial_approval_${project.projectCode}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error("Error exporting initial approval CSV:", error);
    res.status(500).json({ message: "Failed to export CSV" });
  }
});

// Generate initial acknowledgment letter (DOCX)
router.get("/letters/initial-ack/:submissionId.docx", async (req, res) => {
  try {
    const submissionId = Number(req.params.submissionId);
    if (Number.isNaN(submissionId)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }
    const buffer = await buildInitialAckLetter(submissionId);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=initial_ack_${submissionId}.docx`
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error generating initial ack letter:", error);
    res.status(500).json({ message: "Failed to generate letter" });
  }
});

// Generate initial approval letter (DOCX)
router.get("/letters/initial-approval/:submissionId.docx", async (req, res) => {
  try {
    const submissionId = Number(req.params.submissionId);
    if (Number.isNaN(submissionId)) {
      return res.status(400).json({ message: "Invalid submission id" });
    }
    const buffer = await buildInitialApprovalLetter(submissionId);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=initial_approval_${submissionId}.docx`
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error generating initial approval letter:", error);
    res.status(500).json({ message: "Failed to generate letter" });
  }
});

export default router;
