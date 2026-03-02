/**
 * Committee and panel routes
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import { requireUser } from "../middleware/auth";
import prisma from "../config/prismaClient";

const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
  const expected = process.env.API_KEY;
  if (!expected) return next();
  const provided = req.header("x-api-key");
  if (provided !== expected) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

const router = Router();
router.use(requireApiKey);

// List committees with panels and members (including user info)
router.get("/committees", requireUser, async (_req, res, next) => {
  try {
    const committees = await prisma.committee.findMany({
      include: {
        panels: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    res.json(committees);
  } catch (error) {
    next(error);
  }
});

// Get a panel with its members
router.get("/panels/:id/members", requireUser, async (req, res, next) => {
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
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                isActive: true,
              },
            },
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
      members: panel.members.map((member: any) => ({
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
    next(error);
  }
});

// Get all panels for a committee including members
router.get("/committees/:code/panels", requireUser, async (req, res, next) => {
  try {
    const committee = await prisma.committee.findUnique({
      where: { code: req.params.code },
      include: {
        panels: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    isActive: true,
                  },
                },
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
      panels: committee.panels.map((panel: any) => ({
        id: panel.id,
        name: panel.name,
        code: panel.code,
        isActive: panel.isActive,
        members: panel.members.map((member: any) => ({
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
    next(error);
  }
});

export default router;
