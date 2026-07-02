/**
 * Committee and panel routes
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import { requireRole, requireUser } from "../middleware/auth";
import prisma from "../config/prismaClient";
import { PanelMemberRole, RoleType, UserStatus } from "../generated/prisma/client";
import { validate } from "../middleware/validate";
import {
  createPanelSchema,
  createPanelMemberSchema,
  updatePanelMemberSchema,
} from "../schemas/panelManagement";

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

const panelMemberSelect = {
  id: true,
  role: true,
  isActive: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      roles: true,
      status: true,
      isActive: true,
    },
  },
} as const;

const serializePanelMember = (member: {
  id: number;
  role: PanelMemberRole;
  isActive: boolean;
  createdAt: Date;
  user: {
    id: number;
    fullName: string;
    email: string;
    roles?: RoleType[];
    status?: UserStatus;
    isActive: boolean;
  };
}) => ({
  id: member.id,
  role: member.role,
  isActive: member.isActive,
  createdAt: member.createdAt,
  user: {
    id: member.user.id,
    fullName: member.user.fullName,
    email: member.user.email,
    roles: member.user.roles ?? [],
    status: member.user.status,
    isActive: member.user.isActive,
  },
});

const parsePanelNumber = (value?: string | null) => {
  const match = String(value ?? "").match(/^P(?:anel)?\s*(\d+)$/i);
  return match ? Number(match[1]) : null;
};

const comparePanels = <
  T extends { committeeId: number; name: string; code: string | null }
>(
  a: T,
  b: T
) => {
  if (a.committeeId !== b.committeeId) return a.committeeId - b.committeeId;

  const aNumber = parsePanelNumber(a.name) ?? parsePanelNumber(a.code);
  const bNumber = parsePanelNumber(b.name) ?? parsePanelNumber(b.code);
  if (aNumber !== null && bNumber !== null && aNumber !== bNumber) {
    return aNumber - bNumber;
  }

  return a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

const serializePanel = (panel: {
  id: number;
  name: string;
  code: string | null;
  isActive: boolean;
  committee: { id: number; code: string; name: string };
  members: Array<Parameters<typeof serializePanelMember>[0]>;
}) => ({
  id: panel.id,
  name: panel.name,
  code: panel.code,
  isActive: panel.isActive,
  committee: panel.committee,
  members: panel.members.map(serializePanelMember),
});

router.get("/admin/panels", requireRole(RoleType.CHAIR), async (_req, res, next) => {
  try {
    const panels = await prisma.panel.findMany({
      include: {
        committee: { select: { id: true, code: true, name: true } },
        members: {
          select: panelMemberSelect,
          orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        },
      },
      orderBy: [{ committeeId: "asc" }, { name: "asc" }],
    });

    res.json({
      panels: [...panels].sort(comparePanels).map(serializePanel),
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/admin/panel-user-options",
  requireRole(RoleType.CHAIR),
  async (_req, res, next) => {
    try {
      const users = await prisma.user.findMany({
        where: {
          status: UserStatus.APPROVED,
          isActive: true,
        },
        orderBy: [{ fullName: "asc" }, { email: "asc" }],
        select: {
          id: true,
          fullName: true,
          email: true,
          roles: true,
        },
      });

      return res.json({ users });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/admin/panels",
  requireRole(RoleType.CHAIR),
  validate(createPanelSchema),
  async (req, res, next) => {
    try {
      const committee = req.body.committeeId
        ? await prisma.committee.findUnique({
            where: { id: req.body.committeeId },
          })
        : await prisma.committee.findUnique({
            where: { code: req.body.committeeCode },
          });

      if (!committee) {
        return res.status(404).json({ message: "Committee not found" });
      }
      if (!committee.isActive) {
        return res.status(400).json({ message: "Committee is inactive." });
      }

      const existingPanels = await prisma.panel.findMany({
        where: { committeeId: committee.id },
        select: { name: true, code: true },
      });
      const highestPanelNumber = existingPanels.reduce((highest, panel) => {
        const panelNumber = parsePanelNumber(panel.name) ?? parsePanelNumber(panel.code) ?? 0;
        return Math.max(highest, panelNumber);
      }, 0);
      const nextPanelNumber = highestPanelNumber + 1;
      const name = req.body.name || `Panel ${nextPanelNumber}`;
      const code = req.body.code || `P${nextPanelNumber}`;

      const duplicate = await prisma.panel.findFirst({
        where: {
          committeeId: committee.id,
          OR: [
            { name: { equals: name, mode: "insensitive" } },
            { code: { equals: code, mode: "insensitive" } },
          ],
        },
      });
      if (duplicate) {
        return res.status(409).json({ message: "A panel with this name or code already exists." });
      }

      const panel = await prisma.panel.create({
        data: {
          committeeId: committee.id,
          name,
          code,
        },
        include: {
          committee: { select: { id: true, code: true, name: true } },
          members: {
            select: panelMemberSelect,
            orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
          },
        },
      });

      return res.status(201).json({ panel: serializePanel(panel) });
    } catch (error) {
      return next(error);
    }
  }
);

router.delete(
  "/admin/panels/:panelId",
  requireRole(RoleType.CHAIR),
  async (req, res, next) => {
    try {
      const panelId = Number(req.params.panelId);
      if (Number.isNaN(panelId)) {
        return res.status(400).json({ message: "Invalid panel id" });
      }

      const panel = await prisma.panel.findUnique({
        where: { id: panelId },
        select: {
          id: true,
          name: true,
          committeeId: true,
          _count: {
            select: {
              classifications: true,
              members: true,
            },
          },
        },
      });
      if (!panel) {
        return res.status(404).json({ message: "Panel not found" });
      }

      if (panel._count.classifications > 0) {
        return res.status(409).json({
          message:
            "This panel is assigned to existing protocol classifications and cannot be deleted.",
        });
      }

      const activePanelCount = await prisma.panel.count({
        where: {
          committeeId: panel.committeeId,
          isActive: true,
        },
      });
      if (activePanelCount <= 1) {
        return res.status(400).json({ message: "At least one active panel must remain." });
      }

      await prisma.$transaction([
        prisma.panelMember.deleteMany({ where: { panelId } }),
        prisma.panel.delete({ where: { id: panelId } }),
      ]);

      return res.json({
        message: `${panel.name} deleted.`,
        deletedMemberCount: panel._count.members,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/admin/panels/:panelId/members",
  requireRole(RoleType.CHAIR),
  validate(createPanelMemberSchema),
  async (req, res, next) => {
    try {
      const panelId = Number(req.params.panelId);
      if (Number.isNaN(panelId)) {
        return res.status(400).json({ message: "Invalid panel id" });
      }

      const panel = await prisma.panel.findUnique({ where: { id: panelId } });
      if (!panel) {
        return res.status(404).json({ message: "Panel not found" });
      }

      const user = req.body.userId
        ? await prisma.user.findUnique({ where: { id: req.body.userId } })
        : await prisma.user.findFirst({
            where: {
              email: {
                equals: String(req.body.email).trim(),
                mode: "insensitive",
              },
            },
          });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!user.isActive || user.status !== UserStatus.APPROVED) {
        return res.status(400).json({ message: "Panel member must be an active approved user." });
      }

      const existing = await prisma.panelMember.findUnique({
        where: { panelId_userId: { panelId, userId: user.id } },
      });
      if (existing) {
        return res.status(409).json({ message: "This user is already a member of the selected panel." });
      }

      const created = await prisma.panelMember.create({
        data: {
          panelId,
          userId: user.id,
          role: req.body.role,
        },
        select: panelMemberSelect,
      });

      return res.status(201).json({ member: serializePanelMember(created) });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/admin/panel-members/:memberId",
  requireRole(RoleType.CHAIR),
  validate(updatePanelMemberSchema),
  async (req, res, next) => {
    try {
      const memberId = Number(req.params.memberId);
      if (Number.isNaN(memberId)) {
        return res.status(400).json({ message: "Invalid panel member id" });
      }

      const updated = await prisma.panelMember.update({
        where: { id: memberId },
        data: {
          role: req.body.role,
          isActive: req.body.isActive,
        },
        select: panelMemberSelect,
      });

      return res.json({ member: serializePanelMember(updated) });
    } catch (error) {
      return next(error);
    }
  }
);

router.delete(
  "/admin/panel-members/:memberId",
  requireRole(RoleType.CHAIR),
  async (req, res, next) => {
    try {
      const memberId = Number(req.params.memberId);
      if (Number.isNaN(memberId)) {
        return res.status(400).json({ message: "Invalid panel member id" });
      }

      await prisma.panelMember.delete({ where: { id: memberId } });
      return res.json({ message: "Panel member deleted." });
    } catch (error) {
      return next(error);
    }
  }
);

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
