import { Router } from "express";
import prisma from "../config/prismaClient";
import { RoleType } from "../generated/prisma/client";
import { requireRoles } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createAcademicTermSchema, updateAcademicTermSchema } from "../schemas/academicTerm";
import { parseHolidayDateInput } from "../utils/holidayDate";

const router = Router();

const TERM_ROLES = [
  RoleType.ADMIN,
  RoleType.CHAIR,
  RoleType.RESEARCH_ASSOCIATE,
];

// ---------------------------------------------------------------------------
// GET /academic-terms — list all terms, optional ?year=2025-2026 filter
// ---------------------------------------------------------------------------
router.get("/academic-terms", requireRoles(TERM_ROLES), async (req, res, next) => {
  try {
    const { year } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (year) {
      where.academicYear = year;
    }

    const terms = await prisma.academicTerm.findMany({
      where,
      orderBy: [{ academicYear: "asc" }, { term: "asc" }],
    });

    return res.json({
      items: terms.map((t) => ({
        id: t.id,
        academicYear: t.academicYear,
        term: t.term,
        startDate: t.startDate.toISOString().slice(0, 10),
        endDate: t.endDate.toISOString().slice(0, 10),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /academic-terms — upsert a term (one term per academicYear + term combo)
// ---------------------------------------------------------------------------
router.post(
  "/academic-terms",
  requireRoles(TERM_ROLES),
  validate(createAcademicTermSchema),
  async (req, res, next) => {
    try {
      const { academicYear, term, startDate, endDate } = req.body as {
        academicYear: string;
        term: number;
        startDate: string;
        endDate: string;
      };

      const parsedStart = parseHolidayDateInput(startDate);
      const parsedEnd = parseHolidayDateInput(endDate);

      if (!parsedStart) {
        return res.status(400).json({ message: "Invalid startDate" });
      }
      if (!parsedEnd) {
        return res.status(400).json({ message: "Invalid endDate" });
      }
      if (parsedEnd < parsedStart) {
        return res.status(400).json({ message: "End date cannot be before start date" });
      }

      const created = await prisma.academicTerm.upsert({
        where: { academicYear_term: { academicYear, term } },
        update: { startDate: parsedStart, endDate: parsedEnd },
        create: { academicYear, term, startDate: parsedStart, endDate: parsedEnd },
      });

      return res.status(201).json({
        id: created.id,
        academicYear: created.academicYear,
        term: created.term,
        startDate: created.startDate.toISOString().slice(0, 10),
        endDate: created.endDate.toISOString().slice(0, 10),
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /academic-terms/:id — update startDate and/or endDate
// ---------------------------------------------------------------------------
router.patch(
  "/academic-terms/:id",
  requireRoles(TERM_ROLES),
  validate(updateAcademicTermSchema),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid academic term id" });
      }

      const existing = await prisma.academicTerm.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ message: "Academic term not found" });
      }

      const data: { startDate?: Date; endDate?: Date } = {};

      if (req.body.startDate !== undefined) {
        const parsed = parseHolidayDateInput(req.body.startDate as string);
        if (!parsed) {
          return res.status(400).json({ message: "Invalid startDate" });
        }
        data.startDate = parsed;
      }

      if (req.body.endDate !== undefined) {
        const parsed = parseHolidayDateInput(req.body.endDate as string);
        if (!parsed) {
          return res.status(400).json({ message: "Invalid endDate" });
        }
        data.endDate = parsed;
      }

      const effectiveStart = data.startDate ?? existing.startDate;
      const effectiveEnd = data.endDate ?? existing.endDate;

      if (effectiveEnd < effectiveStart) {
        return res.status(400).json({ message: "End date cannot be before start date" });
      }

      const updated = await prisma.academicTerm.update({
        where: { id },
        data,
      });

      return res.json({
        id: updated.id,
        academicYear: updated.academicYear,
        term: updated.term,
        startDate: updated.startDate.toISOString().slice(0, 10),
        endDate: updated.endDate.toISOString().slice(0, 10),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /academic-terms/:id
// ---------------------------------------------------------------------------
router.delete("/academic-terms/:id", requireRoles(TERM_ROLES), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid academic term id" });
    }

    const existing = await prisma.academicTerm.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Academic term not found" });
    }

    await prisma.academicTerm.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
