import type { NextFunction, Request, Response } from "express";
import { RoleType } from "../generated/prisma/client";

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

const parseCommitteeRoles = (value?: string | null): Record<number, RoleType> => {
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

const buildUserFromHeaders = (req: Request) => {
  const idRaw = req.header("x-user-id");
  const id = idRaw ? Number(idRaw) : Number.NaN;
  if (!Number.isFinite(id)) return null;
  const email = req.header("x-user-email") || undefined;
  const fullName = req.header("x-user-name") || undefined;
  const roles = parseRoleList(req.header("x-user-roles"));
  const committeeRoles = parseCommitteeRoles(
    req.header("x-user-committee-roles")
  );

  return {
    id,
    email,
    fullName,
    roles,
    committeeRoles,
  };
};

const buildUserFromEnv = () => {
  const idRaw = process.env.DEV_USER_ID;
  const id = idRaw ? Number(idRaw) : Number.NaN;
  if (!Number.isFinite(id)) return null;
  const email = process.env.DEV_USER_EMAIL || undefined;
  const fullName = process.env.DEV_USER_NAME || undefined;
  const roles = parseRoleList(process.env.DEV_USER_ROLES);
  return {
    id,
    email,
    fullName,
    roles,
    committeeRoles: {},
  };
};

export const authenticateUser = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const headerUser = buildUserFromHeaders(req);
  if (headerUser) {
    req.user = headerUser;
    return next();
  }

  const envUser = buildUserFromEnv();
  if (envUser) {
    req.user = envUser;
  }

  return next();
};

export const requireUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};

export const requireRoles = (allowed: RoleType[]) => {
  const allowedSet = new Set(allowed);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const roles = req.user.roles || [];
    const hasRole = roles.some((role) => allowedSet.has(role));
    if (!hasRole) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
};
