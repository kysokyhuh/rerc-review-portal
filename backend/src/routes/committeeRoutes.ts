/**
 * Committee and panel routes
 */
import { Router } from "express";
import prisma from "../config/prismaClient";

const router = Router();

// List committees with panels and members (including user info)
router.get("/committees", async (_req, res) => {
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
router.get("/panels/:id/members", async (req, res) => {
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
    console.error("Error fetching panel members:", error);
    res.status(500).json({ message: "Failed to fetch panel members" });
  }
});

// Get all panels for a committee including members
router.get("/committees/:code/panels", async (req, res) => {
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
    console.error("Error fetching committee panels:", error);
    res.status(500).json({ message: "Failed to fetch committee panels" });
  }
});

export default router;
