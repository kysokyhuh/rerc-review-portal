import { Router } from "express";
import prisma from "../config/prismaClient";
import { RoleType } from "../generated/prisma/client";
import { requireRoles } from "../middleware/auth";
import {
  normalizeHolidayName,
  parseHolidayDateInput,
} from "../utils/holidayDate";

const router = Router();

const HOLIDAY_ROLES = [
  RoleType.ADMIN,
  RoleType.CHAIR,
  RoleType.RESEARCH_ASSOCIATE,
];

router.get("/holidays", requireRoles(HOLIDAY_ROLES), async (req, res) => {
  try {
    const { year, from, to } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    const dateFilter: Record<string, Date> = {};

    if (year !== undefined) {
      const parsedYear = Number(year);
      if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 9999) {
        return res.status(400).json({ message: "Invalid year query param" });
      }
      dateFilter.gte = new Date(Date.UTC(parsedYear, 0, 1));
      dateFilter.lte = new Date(Date.UTC(parsedYear, 11, 31));
    }

    if (from !== undefined) {
      const parsedFrom = parseHolidayDateInput(from);
      if (!parsedFrom) {
        return res.status(400).json({ message: "Invalid from query param" });
      }
      dateFilter.gte = parsedFrom;
    }

    if (to !== undefined) {
      const parsedTo = parseHolidayDateInput(to);
      if (!parsedTo) {
        return res.status(400).json({ message: "Invalid to query param" });
      }
      dateFilter.lte = parsedTo;
    }

    if (dateFilter.gte && dateFilter.lte && dateFilter.gte > dateFilter.lte) {
      return res.status(400).json({ message: "`from` cannot be after `to`" });
    }

    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        name: true,
        createdAt: true,
      },
    });

    return res.json({
      items: holidays.map((holiday) => ({
        id: holiday.id,
        date: holiday.date.toISOString(),
        name: holiday.name,
        createdAt: holiday.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error listing holidays:", error);
    return res.status(500).json({ message: "Failed to list holidays" });
  }
});

router.post("/holidays", requireRoles(HOLIDAY_ROLES), async (req, res) => {
  try {
    const date = parseHolidayDateInput(req.body?.date);
    const name = normalizeHolidayName(req.body?.name);

    if (!date) {
      return res.status(400).json({ message: "Invalid date" });
    }
    if (!name) {
      return res.status(400).json({ message: "Invalid name" });
    }

    const existing = await prisma.holiday.findUnique({ where: { date } });
    if (existing) {
      return res.status(409).json({ message: "Holiday date already exists" });
    }

    const holiday = await prisma.holiday.create({
      data: { date, name },
      select: {
        id: true,
        date: true,
        name: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      id: holiday.id,
      date: holiday.date.toISOString(),
      name: holiday.name,
      createdAt: holiday.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Error creating holiday:", error);
    return res.status(500).json({ message: "Failed to create holiday" });
  }
});

router.patch("/holidays/:id", requireRoles(HOLIDAY_ROLES), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Invalid holiday id" });
    }

    const hasDate = req.body?.date !== undefined;
    const hasName = req.body?.name !== undefined;
    if (!hasDate && !hasName) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const holiday = await prisma.holiday.findUnique({ where: { id } });
    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    const data: { date?: Date; name?: string } = {};
    if (hasDate) {
      const date = parseHolidayDateInput(req.body?.date);
      if (!date) {
        return res.status(400).json({ message: "Invalid date" });
      }
      data.date = date;
    }
    if (hasName) {
      const name = normalizeHolidayName(req.body?.name);
      if (!name) {
        return res.status(400).json({ message: "Invalid name" });
      }
      data.name = name;
    }

    if (data.date) {
      const duplicate = await prisma.holiday.findUnique({ where: { date: data.date } });
      if (duplicate && duplicate.id !== id) {
        return res.status(409).json({ message: "Holiday date already exists" });
      }
    }

    const updated = await prisma.holiday.update({
      where: { id },
      data,
      select: {
        id: true,
        date: true,
        name: true,
        createdAt: true,
      },
    });

    return res.json({
      id: updated.id,
      date: updated.date.toISOString(),
      name: updated.name,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating holiday:", error);
    return res.status(500).json({ message: "Failed to update holiday" });
  }
});

router.delete("/holidays/:id", requireRoles(HOLIDAY_ROLES), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Invalid holiday id" });
    }

    const existing = await prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    await prisma.holiday.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting holiday:", error);
    return res.status(500).json({ message: "Failed to delete holiday" });
  }
});

export default router;
