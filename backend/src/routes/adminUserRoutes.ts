import { Router } from "express";
import { RoleType, UserStatus } from "../generated/prisma/client";
import prisma from "../config/prismaClient";
import { requireAnyRole, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  adminResetPasswordSchema,
  approveUserSchema,
  disableUserSchema,
  enableUserSchema,
  rejectUserSchema,
  updateUserSchema,
} from "../schemas/adminUsers";
import {
  approveAccessRequest,
  AuthError,
  disableManagedUser,
  enableManagedUser,
  rejectAccessRequest,
  resetManagedUserPassword,
  updateManagedUser,
} from "../services/auth/authService";

const router = Router();

function sendAuthError(res: any, error: AuthError) {
  return res.status(error.statusCode).json({
    code: error.code,
    message: error.message,
  });
}

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
          statusNote: true,
          roles: true,
          approvedAt: true,
        },
      });
      res.json({ users });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/admin/users", requireAnyRole([RoleType.CHAIR, RoleType.ADMIN]), async (req, res, next) => {
  try {
    const isChair = req.user?.roles.includes(RoleType.CHAIR);
    const users = await prisma.user.findMany({
      where: isChair ? undefined : { status: UserStatus.APPROVED },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        isActive: true,
        forcePasswordChange: true,
        statusNote: true,
        roles: true,
        approvedAt: true,
        rejectedAt: true,
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
  validate(approveUserSchema),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid user id",
        });
      }

      const updated = await approveAccessRequest(userId, req.body.role, req.user!.id);
      return res.json({ user: updated });
    } catch (error) {
      if (error instanceof AuthError) {
        return sendAuthError(res, error);
      }
      return next(error);
    }
  }
);

router.post(
  "/admin/users/:id/reject",
  requireRole(RoleType.CHAIR),
  validate(rejectUserSchema),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid user id",
        });
      }
      const note = req.body.note?.trim() || "Application rejected";
      const updated = await rejectAccessRequest(userId, note, req.user!.id);
      return res.json({ user: updated });
    } catch (error) {
      if (error instanceof AuthError) {
        return sendAuthError(res, error);
      }
      return next(error);
    }
  }
);

router.post(
  "/admin/users/:id/disable",
  requireRole(RoleType.CHAIR),
  validate(disableUserSchema),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid user id",
        });
      }

      const user = await disableManagedUser(
        userId,
        req.body.note?.trim() || null,
        req.user!.id
      );
      return res.json({ ok: true, user });
    } catch (error) {
      if (error instanceof AuthError) {
        return sendAuthError(res, error);
      }
      return next(error);
    }
  }
);

router.post(
  "/admin/users/:id/enable",
  requireRole(RoleType.CHAIR),
  validate(enableUserSchema),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid user id",
        });
      }

      const user = await enableManagedUser(
        userId,
        req.body.note?.trim() || null,
        req.user!.id
      );
      return res.json({ ok: true, user });
    } catch (error) {
      if (error instanceof AuthError) {
        return sendAuthError(res, error);
      }
      return next(error);
    }
  }
);

router.post(
  "/admin/users/:id/reset-password",
  requireAnyRole([RoleType.CHAIR, RoleType.ADMIN]),
  validate(adminResetPasswordSchema),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid user id",
        });
      }

      const user = await resetManagedUserPassword(
        userId,
        req.body.temporaryPassword,
        req.user!.id
      );
      return res.json({ ok: true, user });
    } catch (error) {
      if (error instanceof AuthError) {
        return sendAuthError(res, error);
      }
      return next(error);
    }
  }
);

router.patch(
  "/admin/users/:id",
  requireRole(RoleType.CHAIR),
  validate(updateUserSchema),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid user id",
        });
      }

      const updated = await updateManagedUser(userId, req.body, req.user!.id);
      res.json({ user: updated });
    } catch (error) {
      if (error instanceof AuthError) {
        return sendAuthError(res, error);
      }
      next(error);
    }
  }
);

export default router;
