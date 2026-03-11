import { Router } from "express";
import { RoleType, UserStatus } from "../generated/prisma/client";
import prisma from "../config/prismaClient";
import { requireRole } from "../middleware/auth";
import { AuthError, sanitizeAssignedRoles } from "../services/auth/authService";
import { logAuditEvent } from "../services/audit/auditService";

const router = Router();

const parseRoles = (raw: unknown): RoleType[] => {
  if (!Array.isArray(raw)) return [];
  const result: RoleType[] = [];
  for (const item of raw) {
    const normalized = String(item).trim().toUpperCase();
    if (normalized in RoleType) {
      result.push(RoleType[normalized as keyof typeof RoleType]);
    }
  }
  return result;
};

router.get(
  "/admin/users/pending",
  requireRole(RoleType.CHAIR),
  async (_req, res, next) => {
    try {
      const users = await prisma.user.findMany({
        where: { status: UserStatus.PENDING },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fullName: true,
          email: true,
          createdAt: true,
          status: true,
          roles: true,
        },
      });
      res.json({ users });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/admin/users", requireRole(RoleType.CHAIR), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        statusNote: true,
        roles: true,
        isActive: true,
        createdAt: true,
      },
    });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/admin/users/:id/approve",
  requireRole(RoleType.CHAIR),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }
      const assignedRoles = sanitizeAssignedRoles(parseRoles(req.body?.roles));
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.ACTIVE,
          isActive: true,
          roles: assignedRoles,
          statusNote: null,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          roles: true,
          isActive: true,
        },
      });
      await logAuditEvent({
        actorId: req.user!.id,
        action: "USER_APPROVED",
        entityType: "User",
        entityId: userId,
        metadata: { roles: assignedRoles },
      });
      return res.json({ user: updated });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return next(error);
    }
  }
);

router.post(
  "/admin/users/:id/reject",
  requireRole(RoleType.CHAIR),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }
      const note =
        typeof req.body?.note === "string" && req.body.note.trim()
          ? req.body.note.trim()
          : "Application rejected";
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.REJECTED,
          isActive: false,
          roles: [],
          statusNote: note,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          roles: true,
          statusNote: true,
          isActive: true,
        },
      });
      await logAuditEvent({
        actorId: req.user!.id,
        action: "USER_REJECTED",
        entityType: "User",
        entityId: userId,
        metadata: { note },
      });
      return res.json({ user: updated });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/admin/users/:id",
  requireRole(RoleType.CHAIR),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }
      const payload: {
        fullName?: string;
        roles?: RoleType[];
        status?: UserStatus;
        statusNote?: string | null;
      } = {};

      if (typeof req.body?.fullName === "string" && req.body.fullName.trim()) {
        payload.fullName = req.body.fullName.trim();
      }
      if (req.body?.roles) {
        payload.roles = sanitizeAssignedRoles(parseRoles(req.body.roles));
      }
      if (typeof req.body?.status === "string") {
        const normalized = req.body.status.toUpperCase();
        if (normalized === "ACTIVE") {
          payload.status = UserStatus.ACTIVE;
        } else if (normalized === "INACTIVE") {
          payload.status = UserStatus.REJECTED;
        }
      }
      if (typeof req.body?.statusNote === "string") {
        payload.statusNote = req.body.statusNote.trim() || null;
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...payload,
          isActive: payload.status ? payload.status === UserStatus.ACTIVE : undefined,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          statusNote: true,
          roles: true,
          isActive: true,
        },
      });

      await logAuditEvent({
        actorId: req.user!.id,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: userId,
        metadata: payload,
      });
      res.json({ user: updated });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      next(error);
    }
  }
);

router.delete(
  "/admin/users/:id",
  requireRole(RoleType.CHAIR),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          status: UserStatus.REJECTED,
          statusNote: "Account inactive",
          roles: [],
        },
      });
      await logAuditEvent({
        actorId: req.user!.id,
        action: "USER_DEACTIVATED",
        entityType: "User",
        entityId: userId,
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
