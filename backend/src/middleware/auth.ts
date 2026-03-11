import type { NextFunction, Request, Response } from "express";
import { RoleType } from "../generated/prisma/client";
import { verifyAccessToken } from "../utils/jwt";

const AUTH_COOKIE_NAME = "authToken";

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
    process.env.NODE_ENV === "development" &&
    process.env.DEV_HEADER_AUTH === "true";
  if (!isDevHeaderEnabled) {
    return null;
  }
  const idRaw = req.header("x-user-id");
  const id = idRaw ? Number(idRaw) : Number.NaN;
  if (!Number.isFinite(id)) return null;

  return {
    id,
    email: req.header("x-user-email") || undefined,
    fullName: req.header("x-user-name") || undefined,
    roles: parseRoleList(req.header("x-user-roles")),
    committeeRoles: parseCommitteeRoles(req.header("x-user-committee-roles")),
  };
};

export const authenticateUser = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const devUser = tryDevHeaderUser(req);
  if (devUser) {
    req.user = devUser;
    return next();
  }

  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;
  const token = cookieToken;

  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      roles: payload.roles,
      committeeRoles: payload.committeeRoles,
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
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};

export const requireRole = (role: RoleType) =>
  requireAnyRole([role]);

export const requireAnyRole = (allowed: RoleType[]) => {
  const allowedSet = new Set(allowed);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const hasRole = (req.user.roles || []).some((role) => allowedSet.has(role));
    if (!hasRole) return res.status(403).json({ message: "Forbidden" });
    return next();
  };
};

// Backward-compatible aliases while routes are being migrated.
export const requireUser = requireAuth;
export const requireRoles = requireAnyRole;

export { AUTH_COOKIE_NAME };
