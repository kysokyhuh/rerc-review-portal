import type { NextFunction, Request, Response } from "express";
import prisma from "../config/prismaClient";
import { RoleType, UserStatus } from "../generated/prisma/client";
import { logAuditEvent } from "../services/audit/auditService";
import { verifyAccessToken } from "../utils/jwt";
import { AUTH_COOKIE_NAME, REFRESH_COOKIE_NAME } from "../config/authCookies";

if (
  process.env.DEV_HEADER_AUTH === "true" &&
  process.env.NODE_ENV !== "development" &&
  process.env.NODE_ENV !== "test"
) {
  throw new Error("DEV_HEADER_AUTH may only be enabled in local development or test.");
}

const parseRoleList = (value?: string | null): RoleType[] => {
  if (!value) return [];
  const roles = value
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
  const roleSet = new Set<RoleType>();
  for (const role of roles) {
    const normalized = role.toUpperCase();
    if (normalized in RoleType) {
      roleSet.add(RoleType[normalized as keyof typeof RoleType]);
    }
  }
  return Array.from(roleSet);
};

const parseCommitteeRoles = (
  value?: string | null
): Record<number, RoleType> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    const result: Record<number, RoleType> = {};
    for (const [key, role] of Object.entries(parsed)) {
      const committeeId = Number(key);
      if (!Number.isFinite(committeeId)) continue;
      const normalized = String(role).trim().toUpperCase();
      if (normalized in RoleType) {
        result[committeeId] = RoleType[normalized as keyof typeof RoleType];
      }
    }
    return result;
  } catch {
    return {};
  }
};

const tryDevHeaderUser = (req: Request) => {
  const isDevHeaderEnabled =
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") &&
    process.env.DEV_HEADER_AUTH === "true";
  if (!isDevHeaderEnabled) {
    return null;
  }
  const idRaw = req.header("x-user-id");
  const id = idRaw ? Number(idRaw) : Number.NaN;
  if (!Number.isFinite(id)) return null;

  return {
    id,
    sessionId: "dev-header-session",
    email: req.header("x-user-email") || undefined,
    fullName: req.header("x-user-name") || undefined,
    forcePasswordChange: false,
    roles: parseRoleList(req.header("x-user-roles")),
    committeeRoles: parseCommitteeRoles(req.header("x-user-committee-roles")),
  };
};

async function loadSessionUser(sessionId: string, userId: number) {
  const now = Date.now();
  const session = await prisma.authSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      absoluteExpiresAt: true,
      idleExpiresAt: true,
      expiresAt: true,
      lastReauthenticatedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          roles: true,
          status: true,
          isActive: true,
          forcePasswordChange: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.userId !== userId) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= now) return null;
  if (session.absoluteExpiresAt.getTime() <= now) return null;
  if (session.idleExpiresAt.getTime() <= now) return null;
  if (session.user.status !== UserStatus.APPROVED) return null;
  if (!session.user.isActive) return null;

  return session;
}

function logAccessDenied(req: Request, reason: "unauthenticated" | "forbidden", requiredRoles?: RoleType[]) {
  void logAuditEvent({
    actorId: req.user?.id ?? null,
    action: "ACCESS_DENIED",
    entityType: "Route",
    entityId: req.originalUrl,
    metadata: {
      reason,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
      requiredRoles: requiredRoles ?? [],
    },
  }).catch(() => {});
}

export const authenticateUser = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const devUser = tryDevHeaderUser(req);
  if (devUser) {
    req.user = devUser;
    return next();
  }

  const token = req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const session = await loadSessionUser(payload.sid, payload.sub);
    if (!session) {
      return next();
    }

    req.user = {
      id: session.user.id,
      sessionId: session.id,
      sessionAbsoluteExpiresAt: session.absoluteExpiresAt,
      sessionIdleExpiresAt: session.idleExpiresAt,
      lastReauthenticatedAt: session.lastReauthenticatedAt ?? null,
      email: session.user.email,
      fullName: session.user.fullName,
      forcePasswordChange: session.user.forcePasswordChange,
      roles: session.user.roles,
      committeeRoles: {},
    };
  } catch {
    // Keep req.user undefined for guards to handle.
  }

  return next();
};

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    logAccessDenied(req, "unauthenticated");
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};

export const requireRole = (role: RoleType) => requireAnyRole([role]);

export const requireAnyRole = (allowed: RoleType[]) => {
  const allowedSet = new Set(allowed);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      logAccessDenied(req, "unauthenticated", allowed);
      return res.status(401).json({ message: "Unauthorized" });
    }
    const hasRole = (req.user.roles || []).some((role) => allowedSet.has(role));
    if (!hasRole) {
      logAccessDenied(req, "forbidden", allowed);
      return res.status(403).json({
        message: "Forbidden",
        requiredRoles: allowed,
        userRoles: req.user.roles || [],
      });
    }
    return next();
  };
};

export const requireUser = requireAuth;
export const requireRoles = requireAnyRole;

export { AUTH_COOKIE_NAME, REFRESH_COOKIE_NAME };
