import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { requireAnyRole } from "../middleware/auth";
import { RoleType } from "../generated/prisma/client";
import {
  buildAnnualSummaryPayload,
  buildSubmissionRecordsPayload,
  fetchReportSubmissions,
  getAcademicYearOptions,
  parseReportFilters,
  resolveReportWindows,
} from "../services/reports/reportService";
import { logAuditEvent } from "../services/audit/auditService";

const router = Router();
router.use("/reports", requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]));
router.use("/reports", (req, res, next) => {
  res.on("finish", () => {
    if (req.method !== "GET" || res.statusCode >= 400 || !req.user?.id) {
      return;
    }

    void logAuditEvent({
      actorId: req.user.id,
      action: "REPORT_VIEWED",
      entityType: "Route",
      entityId: req.originalUrl,
      metadata: {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
      },
    }).catch(() => {});
  });
  next();
});

export const getAcademicYearsHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(await getAcademicYearOptions());
  } catch (error) {
    next(error);
  }
};

export const getAnnualSummaryHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = parseReportFilters(req.query as Record<string, unknown>);
    const termWindows = await resolveReportWindows(filters);
    const submissions = await fetchReportSubmissions(filters, termWindows);
    return res.json(await buildAnnualSummaryPayload(filters, termWindows, submissions));
  } catch (error: any) {
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

export const getReportSubmissionsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = parseReportFilters(req.query as Record<string, unknown>);
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(5000, Math.max(1, Number(req.query.pageSize ?? 20) || 20));
    const sort = String(req.query.sort ?? "receivedDate:desc");

    const termWindows = await resolveReportWindows(filters);
    const submissions = await fetchReportSubmissions(filters, termWindows);

    return res.json(buildSubmissionRecordsPayload(submissions, page, pageSize, sort));
  } catch (error: any) {
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

type ReportSubmission = Awaited<ReturnType<typeof fetchReportSubmissions>>[number];

const databaseCsvHeaders = [
  "Project Code",
  "Title",
  "Project Leader",
  "College",
  "Department",
  "Date of Submission",
  "Month of Submission",
  "Type of Review",
  "Proponent",
  "Funding",
  "Type of Research PHREB",
  "Type of Research PHREB (Specific for Others)",
  "Status",
  "Finish Date",
  "Month of Clearance",
  "Review Duration\n(Receipt to Finish date)",
  "Remarks",
  "Panel",
  "Scientist Reviewer",
  "Lay Reviewer",
  "Independent Consultant (if applicable)",
  "Honorarium Status\n(c/o Ms. Maja)",
  "Classification of Proposal (RERC)",
  "# days",
  "Provision of Project Proposal Documents and Assessment Forms to Primary Reviewer (RERC Staff)",
  "# days",
  "Accomplishment of Assessment Forms (Primary Reviewers)",
  "# days",
  "Full Review Meeting (RERP) - for Full Review only",
  "# days",
  "Finalization of Review Results (RERP Chair Designate)",
  "# days",
  "Communication of Review Results to the Project Leader (RERC Chair/Staff)",
  "# days",
  "1 \nResubmission from Proponent (RERC Staff)",
  "# days",
  "1 \nReview of Resubmission (Primary Reviewers)",
  "# days",
  "1\nFinalization of Review Results (RERP Chair Designate) - Resubmission",
  "# days",
  "2\nResubmission from Proponent (RERC Staff)",
  "# days",
  "2\nReview of Resubmission (Primary Reviewers)",
  "# days",
  "2\nFinalization of Review Results (RERP Chair Designate) - Resubmission",
  "# days",
  "3\nResubmission from Proponent (RERC Staff)",
  "# days",
  "3\nReview of Resubmission (Primary Reviewers)",
  "# days",
  "3\nFinalization of Review Results (RERP Chair Designate) - Resubmission",
  "# days",
  "4\nResubmission from Proponent (RERC Staff)",
  "# days",
  "4\nReview of Resubmission (Primary Reviewers)",
  "# days",
  "4\nFinalization of Review Results (RERP Chair Designate) - Resubmission",
  "# days",
  "Issuance of Ethics Clearance (RERC and RERC Chair)",
  "# days",
  "Total days",
  "# Submissions",
  "Withdrawn",
  "Project\nEnd Date (6A)",
  "Clearance Expiration",
  "Progress Report\n[Target Date]",
  "Progress Report\n[Submission]",
  "Progress Report\n[Approval Date]",
  "Status",
  "# of Days",
  "Final Report\n[Target Date]",
  "Final Report\n[Submission]",
  "Final Report\n[Completion Date]",
  "Status",
  "# of Days",
  "Amendment\n[Submission]",
  "Status of Request",
  "Approval Date",
  "# of Days",
  "Continuing\n[Submission]",
  "Status of Request",
  "Approval Date",
  "# of Days",
  "Primary Reviewer",
  "Lay Reviewer",
  "Holidays",
  "",
] as const;

const escapeCsvCell = (value: unknown) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

const formatSpreadsheetDate = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
};

const formatBoolean = (value: boolean | null | undefined) => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
};

const formatReviewType = (value: string | null | undefined) => {
  if (value === "FULL_BOARD") return "Full Review";
  if (value === "EXPEDITED") return "Expedited";
  if (value === "EXEMPT") return "Exempted";
  return value ?? "";
};

const getMilestone = (submission: ReportSubmission, label: string) =>
  submission.project?.protocolMilestones?.find((milestone) => milestone.label === label) ?? null;

const milestoneCells = (submission: ReportSubmission, label: string) => {
  const milestone = getMilestone(submission, label);
  return [formatSpreadsheetDate(milestone?.dateOccurred), milestone?.days ?? ""];
};

const databaseCsvRow = (submission: ReportSubmission) => {
  const project = submission.project;
  const profile = project?.protocolProfile;
  const classificationDate =
    profile?.classificationOfProposalRerc ||
    formatSpreadsheetDate(getMilestone(submission, "Classification of Proposal (RERC)")?.dateOccurred);
  const classificationDays =
    getMilestone(submission, "Classification of Proposal (RERC)")?.days ?? "";

  return [
    project?.projectCode ?? "",
    profile?.title ?? project?.title ?? "",
    profile?.projectLeader ?? project?.piName ?? "",
    profile?.college ?? project?.collegeOrUnit ?? project?.piAffiliation ?? "",
    profile?.department ?? project?.department ?? "",
    formatSpreadsheetDate(profile?.dateOfSubmission ?? submission.receivedDate),
    profile?.monthOfSubmission ?? "",
    profile?.typeOfReview ?? formatReviewType(submission.classification?.reviewType),
    profile?.proponent ?? project?.proponent ?? "",
    profile?.funding ?? "",
    profile?.typeOfResearchPhreb ?? "",
    profile?.typeOfResearchPhrebOther ?? "",
    profile?.status ?? String(submission.status ?? ""),
    formatSpreadsheetDate(profile?.finishDate),
    profile?.monthOfClearance ?? "",
    profile?.reviewDurationDays ?? "",
    profile?.remarks ?? "",
    profile?.panel ?? submission.classification?.panel?.name ?? "",
    profile?.scientistReviewer ?? "",
    profile?.layReviewer ?? "",
    profile?.independentConsultant ?? "",
    profile?.honorariumStatus ?? "",
    classificationDate,
    classificationDays,
    ...milestoneCells(submission, "Provision of Documents & Assessment Forms to Primary Reviewer"),
    ...milestoneCells(submission, "Accomplishment of Assessment Forms"),
    ...milestoneCells(submission, "Full Review Meeting"),
    ...milestoneCells(submission, "Finalization of Review Results"),
    ...milestoneCells(submission, "Communication of Review Results to Project Leader"),
    ...milestoneCells(submission, "1st Resubmission from Proponent"),
    ...milestoneCells(submission, "1st Review of Resubmission"),
    ...milestoneCells(submission, "1st Finalization of Review Results - Resubmission"),
    ...milestoneCells(submission, "2nd Resubmission from Proponent"),
    ...milestoneCells(submission, "2nd Review of Resubmission"),
    ...milestoneCells(submission, "2nd Finalization of Review Results - Resubmission"),
    ...milestoneCells(submission, "3rd Resubmission from Proponent"),
    ...milestoneCells(submission, "3rd Review of Resubmission"),
    ...milestoneCells(submission, "3rd Finalization of Review Results - Resubmission"),
    ...milestoneCells(submission, "4th Resubmission from Proponent"),
    ...milestoneCells(submission, "4th Review of Resubmission"),
    ...milestoneCells(submission, "4th Finalization of Review Results - Resubmission"),
    ...milestoneCells(submission, "Issuance of Ethics Clearance"),
    profile?.totalDays ?? "",
    profile?.submissionCount ?? "",
    formatBoolean(profile?.withdrawn),
    formatSpreadsheetDate(profile?.projectEndDate6A),
    formatSpreadsheetDate(profile?.clearanceExpiration),
    formatSpreadsheetDate(profile?.progressReportTargetDate),
    formatSpreadsheetDate(profile?.progressReportSubmission),
    formatSpreadsheetDate(profile?.progressReportApprovalDate),
    profile?.progressReportStatus ?? "",
    profile?.progressReportDays ?? "",
    formatSpreadsheetDate(profile?.finalReportTargetDate),
    formatSpreadsheetDate(profile?.finalReportSubmission),
    formatSpreadsheetDate(profile?.finalReportCompletionDate),
    profile?.finalReportStatus ?? "",
    profile?.finalReportDays ?? "",
    formatSpreadsheetDate(profile?.amendmentSubmission),
    profile?.amendmentStatusOfRequest ?? "",
    formatSpreadsheetDate(profile?.amendmentApprovalDate),
    profile?.amendmentDays ?? "",
    formatSpreadsheetDate(profile?.continuingSubmission),
    profile?.continuingStatusOfRequest ?? "",
    formatSpreadsheetDate(profile?.continuingApprovalDate),
    profile?.continuingDays ?? "",
    profile?.primaryReviewer ?? "",
    profile?.finalLayReviewer ?? "",
    "",
    "",
  ];
};

const buildReportDatabaseCsv = (submissions: ReportSubmission[]) =>
  [
    databaseCsvHeaders.map(escapeCsvCell).join(","),
    ...submissions.map((submission) =>
      databaseCsvRow(submission).map(escapeCsvCell).join(",")
    ),
  ].join("\r\n");

export const getReportSubmissionsCsvHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const filters = parseReportFilters(req.query as Record<string, unknown>);
    const sort = String(req.query.sort ?? "receivedDate:desc");

    const termWindows = await resolveReportWindows(filters);
    const submissions = await fetchReportSubmissions(filters, termWindows);
    const sortedRecords = buildSubmissionRecordsPayload(
      submissions,
      1,
      Math.max(submissions.length, 1),
      sort
    );
    const submissionsById = new Map(
      submissions.map((submission) => [submission.id, submission])
    );
    const sortedSubmissions = sortedRecords.items
      .map((item) => submissionsById.get(item.submissionId))
      .filter((item): item is ReportSubmission => Boolean(item));
    const csv = buildReportDatabaseCsv(sortedSubmissions);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="annual_report_records_${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`
    );
    return res.status(200).send(csv);
  } catch (error: any) {
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

// Backward-compatible alias for existing tests/integrations
export const getAcademicYearSummaryHandler = getAnnualSummaryHandler;

router.get(
  "/reports/academic-years",
  getAcademicYearsHandler
);
router.get(
  "/reports/academic-year-summary",
  getAcademicYearSummaryHandler
);
router.get(
  "/reports/annual-summary",
  getAnnualSummaryHandler
);
router.get(
  "/reports/submissions",
  getReportSubmissionsHandler
);
router.get(
  "/reports/submissions.csv",
  getReportSubmissionsCsvHandler
);

export default router;
