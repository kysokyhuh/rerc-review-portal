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
  resolveTermWindows,
} from "../services/reports/reportService";

const router = Router();

export const getAcademicYearsHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await getAcademicYearOptions();
    return res.json({ items });
  } catch (error) {
    next(error);
  }
};

export const getAnnualSummaryHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = parseReportFilters(req.query as Record<string, unknown>);
    const termWindows = await resolveTermWindows(filters.ay, filters.term);
    const submissions = await fetchReportSubmissions(filters, termWindows);
    return res.json(buildAnnualSummaryPayload(filters, termWindows, submissions));
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
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20) || 20));
    const sort = String(req.query.sort ?? "receivedDate:desc");

    const termWindows = await resolveTermWindows(filters.ay, filters.term);
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
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  getAcademicYearsHandler
);
router.get(
  "/reports/annual-summary",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  getAnnualSummaryHandler
);
router.get(
  "/reports/submissions",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  getReportSubmissionsHandler
);

export default router;
