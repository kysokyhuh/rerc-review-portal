import type { Request, Response } from "express";
import { Router } from "express";
import prisma from "../config/prismaClient";
import {
  buildAcademicYearSummary,
  type ReportSubmissionRecord,
} from "../services/reports/reportMetrics";
import {
  listAcademicYears,
  parseTermSelector,
} from "../services/reports/academicTerms";

const router = Router();

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const getAcademicYearsHandler = async (_req: Request, res: Response) => {
  try {
    const terms = await prisma.academicTerm.findMany({
      orderBy: [{ academicYear: "desc" }, { term: "asc" }],
      select: {
        academicYear: true,
        term: true,
        startDate: true,
        endDate: true,
      },
    });

    return res.json({
      items: listAcademicYears(terms),
    });
  } catch (error) {
    console.error("Error fetching academic years:", error);
    return res.status(500).json({ message: "Failed to fetch academic years" });
  }
};

export const getAcademicYearSummaryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const academicYear = String(req.query.academicYear || "").trim();
    if (!academicYear) {
      return res.status(400).json({ message: "academicYear is required" });
    }

    const committeeCode = req.query.committeeCode
      ? String(req.query.committeeCode).trim()
      : null;

    let term;
    try {
      term = parseTermSelector(req.query.term);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }

    const terms = await prisma.academicTerm.findMany({
      ...(academicYear === "ALL" ? {} : { where: { academicYear } }),
      orderBy: { term: "asc" },
      select: {
        academicYear: true,
        term: true,
        startDate: true,
        endDate: true,
      },
    });

    if (terms.length === 0) {
      return res.status(404).json({
        message:
          academicYear === "ALL"
            ? "No academic terms configured"
            : `No academic terms configured for ${academicYear}`,
      });
    }

    const termRecords =
      academicYear === "ALL"
        ? terms
        : terms.filter((item) => item.academicYear === academicYear);
    if (termRecords.length === 0) {
      return res.status(404).json({
        message: `No academic terms configured for ${academicYear}`,
      });
    }

    const selectedTerms =
      term === "ALL" ? [1, 2, 3] : [term];
    if (term !== "ALL") {
      const hasSelectedTerm = termRecords.some((item) => item.term === term);
      if (!hasSelectedTerm) {
        return res.status(400).json({
          message:
            academicYear === "ALL"
              ? `Term ${term} is not configured in any academic year`
              : `Term ${term} not found for ${academicYear}`,
        });
      }
    }

    const termWindows = termRecords
      .filter((item) => selectedTerms.includes(item.term))
      .map((item) => ({
        term: item.term,
        startDate: item.startDate,
        endDate: addDays(item.endDate, 1),
      }));
    if (termWindows.length === 0) {
      return res.status(400).json({
        message:
          academicYear === "ALL"
            ? "No terms available for selected filter"
            : `No terms available for ${academicYear}`,
      });
    }

    const earliestStart = termWindows.reduce(
      (min, item) => (item.startDate < min ? item.startDate : min),
      termWindows[0].startDate
    );
    const latestEndExclusive = termWindows.reduce(
      (max, item) => (item.endDate > max ? item.endDate : max),
      termWindows[0].endDate
    );
    const latestEnd = addDays(latestEndExclusive, -1);

    const dateWindowFilter = termWindows.map((window) => ({
      receivedDate: {
        gte: window.startDate,
        lt: window.endDate,
      },
    }));

    const [submissionsRaw, holidays] = await Promise.all([
      prisma.submission.findMany({
        where: {
          sequenceNumber: 1,
          OR: dateWindowFilter,
          ...(committeeCode
            ? {
                project: {
                  committee: {
                    code: committeeCode,
                  },
                },
              }
            : {}),
        },
        include: {
          classification: {
            select: {
              reviewType: true,
            },
          },
          project: {
            select: {
              id: true,
              piAffiliation: true,
              collegeOrUnit: true,
              proponentCategory: true,
              approvalStartDate: true,
              committee: {
                select: {
                  code: true,
                },
              },
            },
          },
          statusHistory: {
            select: {
              newStatus: true,
              effectiveDate: true,
            },
            orderBy: {
              effectiveDate: "asc",
            },
          },
        },
      }),
      prisma.holiday.findMany({
        where: {
          date: {
            gte: earliestStart,
            lt: latestEndExclusive,
          },
        },
        select: {
          date: true,
        },
      }),
    ]);

    const submissions = submissionsRaw as ReportSubmissionRecord[];
    const holidayDates = holidays.map((item) => item.date);

    const summary = buildAcademicYearSummary({
      submissions,
      holidayDates,
      termWindows,
    });

    const academicYearVolume =
      academicYear === "ALL"
        ? Array.from(
            termRecords.reduce((map, item) => {
              if (!map.has(item.academicYear)) {
                map.set(item.academicYear, []);
              }
              if (selectedTerms.includes(item.term)) {
                map.get(item.academicYear)!.push({
                  startDate: item.startDate,
                  endDate: addDays(item.endDate, 1),
                });
              }
              return map;
            }, new Map<string, Array<{ startDate: Date; endDate: Date }>>())
          )
            .sort(([yearA], [yearB]) => yearB.localeCompare(yearA))
            .map(([year, windows]) => {
              const received = submissions.filter((submission) => {
                const timestamp = new Date(submission.receivedDate).getTime();
                return windows.some((window) => {
                  const start = new Date(window.startDate).getTime();
                  const endExclusive = new Date(window.endDate).getTime();
                  return timestamp >= start && timestamp < endExclusive;
                });
              }).length;
              return {
                academicYear: year,
                received,
              };
            })
        : undefined;

    return res.json({
      academicYear,
      term,
      committeeCode,
      dateRange: {
        startDate: earliestStart,
        endDate: latestEnd,
      },
      totals: summary.totals,
      termVolume: summary.termVolume,
      academicYearVolume,
      breakdownByCollegeOrUnit: summary.breakdownByCollegeOrUnit,
      averages: summary.averages,
    });
  } catch (error) {
    console.error("Error building academic year summary:", error);
    return res
      .status(500)
      .json({ message: "Failed to build academic year report" });
  }
};

router.get("/reports/academic-years", getAcademicYearsHandler);
router.get("/reports/academic-year-summary", getAcademicYearSummaryHandler);

export default router;
