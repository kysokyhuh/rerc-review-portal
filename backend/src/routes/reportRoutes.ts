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

export default router;
