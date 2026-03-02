import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "../../config/prismaClient";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type AccessTokenPayload,
} from "../../utils/jwt";
import type { RoleType } from "../../generated/prisma/client";

const BCRYPT_ROUNDS = 12;

export class AuthError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function buildAccessPayload(userId: number): Promise<AccessTokenPayload> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      committeeMemberships: {
        where: { isActive: true },
        select: { committeeId: true, role: true },
      },
    },
  });

  if (!user || !user.isActive) {
    throw new AuthError(401, "User not found or inactive");
  }

  // Collect unique roles from committee memberships
  const roles = Array.from(
    new Set(user.committeeMemberships.map((m) => m.role)),
  ) as RoleType[];

  // Build committee → role mapping
  const committeeRoles: Record<number, RoleType> = {};
  for (const m of user.committeeMemberships) {
    committeeRoles[m.committeeId] = m.role;
  }

  return {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    roles,
    committeeRoles,
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    throw new AuthError(401, "Invalid email or password");
  }

  if (!user.passwordHash) {
    throw new AuthError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthError(401, "Invalid email or password");
  }

  const payload = await buildAccessPayload(user.id);
  const accessToken = signAccessToken(payload);

  const tokenFamily = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, tokenFamily });

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: payload.roles,
      committeeRoles: payload.committeeRoles,
    },
  };
}

export async function refresh(refreshToken: string) {
  const decoded = verifyRefreshToken(refreshToken);

  const payload = await buildAccessPayload(decoded.sub);
  const newAccessToken = signAccessToken(payload);

  // Rotate refresh token
  const newRefreshToken = signRefreshToken({
    sub: decoded.sub,
    tokenFamily: decoded.tokenFamily,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
