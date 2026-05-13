import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../../config/prismaClient";
import { RoleType, UserStatus } from "../../generated/prisma/client";
import { logAuditEvent } from "../audit/auditService";
import {
  compareOpaqueToken,
  hashOpaqueToken,
} from "../../utils/secureTokens";
import {
  ACCESS_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_MAX_AGE_MS,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../utils/jwt";
import { getPasswordPolicyFailure } from "../../utils/passwordPolicy";
import { getSessionPolicy } from "./sessionPolicy";

const BCRYPT_ROUNDS = 12;

const SIGNUP_SUCCESS_MESSAGE = "Your account has been submitted for approval.";
const GENERIC_LOGIN_ERROR = "Invalid email or password.";
const PASSWORD_CHANGE_REQUIRED_MESSAGE =
  "You must change your password before continuing.";

const APPROVAL_ROLES: RoleType[] = [
  RoleType.CHAIR,
  RoleType.RESEARCH_ASSOCIATE,
  RoleType.RESEARCH_ASSISTANT,
];

type RequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type ManagedUserUpdateInput = {
  fullName?: string;
  role?: RoleType | null;
  statusNote?: string | null;
};

type AuthenticatedUser = {
  id: number;
  email: string;
  fullName: string;
  roles: RoleType[];
  status: UserStatus;
  forcePasswordChange: boolean;
  lastLoginAt?: Date | null;
  lastLoginIp?: string | null;
  approvedAt?: Date | null;
};

type AuthSessionTokens = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  absoluteExpiresAt: Date;
  idleExpiresAt: Date;
  accessCookieMaxAgeMs: number;
  refreshCookieMaxAgeMs: number;
};

export type AuthenticatedSessionResult = AuthSessionTokens & {
  user: ReturnType<typeof buildAuthUserResponse>;
};

export class AuthError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeFullName(fullName: string) {
  return fullName.trim().replace(/\s+/g, " ");
}

function composeFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim().replace(/\s+/g, " ");
}

function buildAuthUserResponse(user: AuthenticatedUser) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    committeeRoles: {},
    status: user.status,
    forcePasswordChange: user.forcePasswordChange,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    lastLoginIp: user.lastLoginIp ?? null,
    approvedAt: user.approvedAt?.toISOString() ?? null,
  };
}

function ensurePasswordsMatch(password: string, confirmPassword: string) {
  if (password !== confirmPassword) {
    throw new AuthError(400, "VALIDATION_ERROR", "Passwords do not match.");
  }
}

function ensurePasswordPolicy(password: string, email?: string | null) {
  const failure = getPasswordPolicyFailure(password, email);
  if (failure) {
    throw new AuthError(
      400,
      "VALIDATION_ERROR",
      failure
    );
  }
}

function getRemainingMs(expiresAt: Date) {
  return Math.max(0, expiresAt.getTime() - Date.now());
}

function buildSessionResponse(
  user: AuthenticatedUser,
  tokens: AuthSessionTokens
): AuthenticatedSessionResult {
  return {
    ...tokens,
    user: buildAuthUserResponse(user),
  };
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function createSession(
  user: { id: number; roles: RoleType[] },
  context: RequestContext
): Promise<AuthSessionTokens> {
  const sessionId = randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, sid: sessionId });
  const refreshTokenHash = hashOpaqueToken(refreshToken);
  const policy = getSessionPolicy(user.roles);
  const now = Date.now();
  const absoluteExpiresAt = new Date(now + policy.absoluteMs);
  const idleExpiresAt = new Date(
    Math.min(now + policy.idleMs, absoluteExpiresAt.getTime())
  );

  await prisma.authSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      refreshTokenHash,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      expiresAt: absoluteExpiresAt,
      absoluteExpiresAt,
      idleExpiresAt,
      lastSeenAt: new Date(now),
      lastReauthenticatedAt: new Date(now),
    },
  });

  const accessToken = signAccessToken({ sub: user.id, sid: sessionId });
  return {
    accessToken,
    refreshToken,
    sessionId,
    absoluteExpiresAt,
    idleExpiresAt,
    accessCookieMaxAgeMs: Math.min(
      ACCESS_COOKIE_MAX_AGE_MS,
      getRemainingMs(idleExpiresAt),
      getRemainingMs(absoluteExpiresAt)
    ),
    refreshCookieMaxAgeMs: Math.min(
      REFRESH_COOKIE_MAX_AGE_MS,
      getRemainingMs(absoluteExpiresAt)
    ),
  };
}

async function revokeSessionsForUser(userId: number) {
  await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

async function revokeSessionById(sessionId: string) {
  await prisma.authSession.updateMany({
    where: {
      id: sessionId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

async function getAuthEligibleUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      roles: true,
      status: true,
      isActive: true,
      forcePasswordChange: true,
      lastLoginAt: true,
      lastLoginIp: true,
      approvedAt: true,
    },
  });

  if (!user || user.status !== UserStatus.APPROVED || !user.isActive) {
    throw new AuthError(401, "UNAUTHORIZED", "Not authenticated");
  }

  return user;
}

async function getManagedUserSummary(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
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
}

export async function signup(
  input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
  },
  context: RequestContext = {}
) {
  const normalizedEmail = normalizeEmail(input.email);
  const fullName = composeFullName(input.firstName, input.lastName);
  ensurePasswordsMatch(input.password, input.confirmPassword);
  ensurePasswordPolicy(input.password, normalizedEmail);

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) {
    await logAuditEvent({
      action: "ACCESS_REQUEST_SUBMITTED",
      entityType: "AccessRequest",
      entityId: normalizedEmail,
      metadata: {
        duplicate: true,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
    return { message: SIGNUP_SUCCESS_MESSAGE };
  }

  const passwordHash = await hashPassword(input.password);
  const created = await prisma.user.create({
    data: {
      fullName,
      email: normalizedEmail,
      passwordHash,
      forcePasswordChange: false,
      status: UserStatus.PENDING,
      roles: [],
      statusNote: null,
      approvedById: null,
      approvedAt: null,
      rejectedById: null,
      rejectedAt: null,
      isActive: false,
    },
    select: {
      id: true,
    },
  });

  await logAuditEvent({
    action: "ACCESS_REQUEST_SUBMITTED",
    entityType: "User",
    entityId: created.id,
    metadata: {
      email: normalizedEmail,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { message: SIGNUP_SUCCESS_MESSAGE };
}

export async function login(
  email: string,
  password: string,
  context: RequestContext = {}
): Promise<AuthenticatedSessionResult> {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      fullName: true,
      passwordHash: true,
      status: true,
      isActive: true,
      roles: true,
      forcePasswordChange: true,
      approvedAt: true,
    },
  });

  const logFailure = async (reason: string) => {
    await logAuditEvent({
      action: "AUTH_LOGIN_FAILED",
      entityType: "Auth",
      entityId: normalizedEmail,
      metadata: {
        reason,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
  };

  if (!user || !user.passwordHash) {
    await logFailure("missing-user-or-password");
    throw new AuthError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_ERROR);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await logFailure("invalid-password");
    throw new AuthError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_ERROR);
  }

  if (user.status === UserStatus.PENDING) {
    await logFailure("account-pending");
    throw new AuthError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_ERROR);
  }

  if (user.status === UserStatus.REJECTED) {
    await logFailure("account-rejected");
    throw new AuthError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_ERROR);
  }

  if (user.status === UserStatus.DISABLED) {
    await logFailure("account-disabled");
    throw new AuthError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_ERROR);
  }

  if (!user.isActive) {
    await logFailure("account-inactive");
    throw new AuthError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_ERROR);
  }

  if (user.status !== UserStatus.APPROVED) {
    await logFailure("unexpected-status");
    throw new AuthError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_ERROR);
  }

  const loginTimestamp = new Date();
  const tokens = await createSession(user, context);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: loginTimestamp,
      lastLoginIp: context.ipAddress ?? null,
    },
  });
  await logAuditEvent({
    actorId: user.id,
    action: "AUTH_LOGIN_SUCCEEDED",
    entityType: "AuthSession",
    entityId: tokens.sessionId,
    metadata: {
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return buildSessionResponse(
    {
      ...user,
      lastLoginAt: loginTimestamp,
      lastLoginIp: context.ipAddress ?? null,
    },
    tokens
  );
}

export async function refreshSession(
  refreshToken: string,
  context: RequestContext = {}
) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const session = await prisma.authSession.findUnique({
    where: { id: payload.sid },
    select: {
      id: true,
      userId: true,
      refreshTokenHash: true,
      revokedAt: true,
      expiresAt: true,
      absoluteExpiresAt: true,
      idleExpiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          roles: true,
          status: true,
          isActive: true,
          forcePasswordChange: true,
          lastLoginAt: true,
          lastLoginIp: true,
          approvedAt: true,
        },
      },
    },
  });

  const now = Date.now();
  if (
    !session ||
    session.userId !== payload.sub ||
    session.revokedAt ||
    session.expiresAt.getTime() <= now ||
    session.absoluteExpiresAt.getTime() <= now ||
    session.idleExpiresAt.getTime() <= now ||
    !compareOpaqueToken(refreshToken, session.refreshTokenHash)
  ) {
    if (session?.id) {
      await revokeSessionById(session.id);
    }
    throw new AuthError(401, "UNAUTHORIZED", "Unauthorized");
  }

  if (session.user.status !== UserStatus.APPROVED || !session.user.isActive) {
    await revokeSessionById(session.id);
    throw new AuthError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const nextRefreshToken = signRefreshToken({ sub: session.user.id, sid: session.id });
  const accessToken = signAccessToken({ sub: session.user.id, sid: session.id });
  const policy = getSessionPolicy(session.user.roles);
  const nextIdleExpiresAt = new Date(
    Math.min(now + policy.idleMs, session.absoluteExpiresAt.getTime())
  );

  await prisma.authSession.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: hashOpaqueToken(nextRefreshToken),
      expiresAt: session.absoluteExpiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
      idleExpiresAt: nextIdleExpiresAt,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      lastSeenAt: new Date(),
    },
  });

  return buildSessionResponse(session.user, {
    accessToken,
    refreshToken: nextRefreshToken,
    sessionId: session.id,
    absoluteExpiresAt: session.absoluteExpiresAt,
    idleExpiresAt: nextIdleExpiresAt,
    accessCookieMaxAgeMs: Math.min(
      ACCESS_COOKIE_MAX_AGE_MS,
      getRemainingMs(nextIdleExpiresAt),
      getRemainingMs(session.absoluteExpiresAt)
    ),
    refreshCookieMaxAgeMs: Math.min(
      REFRESH_COOKIE_MAX_AGE_MS,
      getRemainingMs(session.absoluteExpiresAt)
    ),
  });
}

export async function logoutSession(
  input: {
    accessToken?: string;
    refreshToken?: string;
  },
  context: RequestContext = {}
) {
  const candidates = [input.refreshToken, input.accessToken].filter(Boolean) as string[];

  for (const token of candidates) {
    try {
      const payload =
        token === input.refreshToken ? verifyRefreshToken(token) : verifyAccessToken(token);
      const session = await prisma.authSession.findUnique({
        where: { id: payload.sid },
        select: {
          id: true,
          userId: true,
        },
      });
      await revokeSessionById(payload.sid);
      if (session) {
        await logAuditEvent({
          actorId: session.userId,
          action: "AUTH_LOGOUT_SUCCEEDED",
          entityType: "AuthSession",
          entityId: session.id,
          metadata: {
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null,
          },
        });
      }
      return;
    } catch {
      // Keep trying available tokens.
    }
  }
}

export async function changePassword(
  userId: number,
  sessionId: string,
  input: {
    currentPassword?: string;
    newPassword: string;
    confirmPassword: string;
  },
  context: RequestContext = {}
): Promise<AuthenticatedSessionResult> {
  ensurePasswordsMatch(input.newPassword, input.confirmPassword);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      roles: true,
      status: true,
      isActive: true,
      forcePasswordChange: true,
      lastLoginAt: true,
      lastLoginIp: true,
      approvedAt: true,
      passwordHash: true,
    },
  });

  if (!user || user.status !== UserStatus.APPROVED || !user.isActive) {
    throw new AuthError(401, "UNAUTHORIZED", "Unauthorized");
  }
  if (!user.forcePasswordChange) {
    const currentPassword = input.currentPassword?.trim();
    if (!currentPassword) {
      throw new AuthError(
        400,
        "VALIDATION_ERROR",
        "Enter your current password to update it."
      );
    }
    const existingPasswordHash = user.passwordHash;
    const passwordMatches = existingPasswordHash
      ? await bcrypt.compare(currentPassword, existingPasswordHash)
      : false;
    if (!passwordMatches) {
      throw new AuthError(
        400,
        "VALIDATION_ERROR",
        "Current password is incorrect."
      );
    }
  }

  ensurePasswordPolicy(input.newPassword, user.email);
  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        forcePasswordChange: false,
      },
    }),
    prisma.authSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  const refreshedUser: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    status: user.status,
    forcePasswordChange: false,
    lastLoginAt: user.lastLoginAt,
    lastLoginIp: user.lastLoginIp,
    approvedAt: user.approvedAt,
  };
  const tokens = await createSession(refreshedUser, context);

  await logAuditEvent({
    actorId: user.id,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user.id,
    metadata: {
      previousSessionId: sessionId,
      newSessionId: tokens.sessionId,
      mode: user.forcePasswordChange ? "FORCED" : "SELF_SERVICE",
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return buildSessionResponse(refreshedUser, tokens);
}

export async function getMeFromToken(token: string) {
  const payload = verifyAccessToken(token);
  const session = await prisma.authSession.findUnique({
    where: { id: payload.sid },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
      absoluteExpiresAt: true,
      idleExpiresAt: true,
    },
  });
  const now = Date.now();
  if (
    !session ||
    session.userId !== payload.sub ||
    session.revokedAt ||
    session.expiresAt.getTime() <= now ||
    session.absoluteExpiresAt.getTime() <= now ||
    session.idleExpiresAt.getTime() <= now
  ) {
    throw new AuthError(401, "UNAUTHORIZED", "Not authenticated");
  }

  const user = await getAuthEligibleUser(payload.sub);
  return buildAuthUserResponse(user);
}

export async function getMeById(userId: number) {
  const user = await getAuthEligibleUser(userId);
  return buildAuthUserResponse(user);
}

export async function updateOwnProfile(
  userId: number,
  input: {
    fullName?: string;
    email?: string;
    currentPassword?: string;
  },
  context: RequestContext = {}
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      roles: true,
      status: true,
      isActive: true,
      forcePasswordChange: true,
      lastLoginAt: true,
      lastLoginIp: true,
      approvedAt: true,
      passwordHash: true,
    },
  });

  if (!user || user.status !== UserStatus.APPROVED || !user.isActive) {
    throw new AuthError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const nextFullName =
    input.fullName !== undefined ? normalizeFullName(input.fullName) : user.fullName;
  const nextEmail =
    input.email !== undefined ? normalizeEmail(input.email) : user.email;

  const fullNameChanged = nextFullName !== user.fullName;
  const emailChanged = nextEmail !== user.email;

  if (!fullNameChanged && !emailChanged) {
    return buildAuthUserResponse(user);
  }

  if (emailChanged) {
    const currentPassword = input.currentPassword?.trim();
    if (!currentPassword) {
      throw new AuthError(
        400,
        "VALIDATION_ERROR",
        "Enter your current password to update your email."
      );
    }

    const existingPasswordHash = user.passwordHash;
    const passwordMatches = existingPasswordHash
      ? await bcrypt.compare(currentPassword, existingPasswordHash)
      : false;
    if (!passwordMatches) {
      throw new AuthError(
        400,
        "VALIDATION_ERROR",
        "Current password is incorrect."
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: nextEmail },
      select: { id: true },
    });
    if (existing && existing.id !== user.id) {
      throw new AuthError(
        409,
        "EMAIL_ALREADY_IN_USE",
        "That email address is already in use."
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(fullNameChanged ? { fullName: nextFullName } : {}),
      ...(emailChanged ? { email: nextEmail } : {}),
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      roles: true,
      status: true,
      forcePasswordChange: true,
      lastLoginAt: true,
      lastLoginIp: true,
      approvedAt: true,
    },
  });

  if (fullNameChanged) {
    await logAuditEvent({
      actorId: user.id,
      action: "USER_PROFILE_UPDATED",
      entityType: "User",
      entityId: user.id,
      metadata: {
        fields: ["fullName"],
        previousFullName: user.fullName,
        nextFullName,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
  }

  if (emailChanged) {
    await logAuditEvent({
      actorId: user.id,
      action: "USER_EMAIL_CHANGED",
      entityType: "User",
      entityId: user.id,
      metadata: {
        previousEmail: user.email,
        nextEmail,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
  }

  return buildAuthUserResponse(updated);
}

export function sanitizeAssignedRole(inputRole: RoleType) {
  if (!APPROVAL_ROLES.includes(inputRole)) {
    throw new AuthError(400, "VALIDATION_ERROR", "Role is not allowed.");
  }
  return inputRole;
}

export async function approveAccessRequest(
  userId: number,
  role: RoleType,
  actorId: number
) {
  const assignedRole = sanitizeAssignedRole(role);
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!current) {
    throw new AuthError(404, "NOT_FOUND", "User not found.");
  }
  if (current.status !== UserStatus.PENDING) {
    throw new AuthError(
      400,
      "VALIDATION_ERROR",
      "Only pending accounts can be approved."
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: UserStatus.APPROVED,
      roles: [assignedRole],
      forcePasswordChange: false,
      statusNote: null,
      approvedById: actorId,
      approvedAt: new Date(),
      rejectedById: null,
      rejectedAt: null,
      isActive: true,
    },
  });

  await revokeSessionsForUser(userId);

  await logAuditEvent({
    actorId,
    action: "ACCESS_REQUEST_APPROVED",
    entityType: "User",
    entityId: userId,
    metadata: { role: assignedRole },
  });
  await logAuditEvent({
    actorId,
    action: "USER_ROLE_ASSIGNED",
    entityType: "User",
    entityId: userId,
    metadata: { role: assignedRole },
  });

  const updated = await getManagedUserSummary(userId);
  if (!updated) {
    throw new AuthError(404, "NOT_FOUND", "User not found.");
  }
  return updated;
}

export async function rejectAccessRequest(userId: number, note: string, actorId: number) {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!current) {
    throw new AuthError(404, "NOT_FOUND", "User not found.");
  }
  if (current.status !== UserStatus.PENDING) {
    throw new AuthError(
      400,
      "VALIDATION_ERROR",
      "Only pending accounts can be rejected."
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: UserStatus.REJECTED,
      roles: [],
      forcePasswordChange: false,
      statusNote: note,
      rejectedById: actorId,
      rejectedAt: new Date(),
      approvedById: null,
      approvedAt: null,
      isActive: false,
    },
  });

  await revokeSessionsForUser(userId);
  await logAuditEvent({
    actorId,
    action: "ACCESS_REQUEST_REJECTED",
    entityType: "User",
    entityId: userId,
    metadata: { note },
  });

  const updated = await getManagedUserSummary(userId);
  if (!updated) {
    throw new AuthError(404, "NOT_FOUND", "User not found.");
  }
  return updated;
}

export async function updateManagedUser(
  userId: number,
  input: ManagedUserUpdateInput,
  actorId: number
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      status: true,
      roles: true,
      statusNote: true,
    },
  });

  if (!user) {
    throw new AuthError(404, "NOT_FOUND", "User not found.");
  }

  const payload: {
    fullName?: string;
    roles?: RoleType[];
    statusNote?: string | null;
  } = {};

  if (typeof input.fullName === "string" && input.fullName.trim()) {
    payload.fullName = input.fullName.trim();
  }

  if (input.role) {
    if (user.status !== UserStatus.APPROVED) {
      throw new AuthError(
        400,
        "VALIDATION_ERROR",
        "Roles can only be edited for approved accounts."
      );
    }

    const assignedRole = sanitizeAssignedRole(input.role);
    if (
      userId === actorId &&
      user.roles.includes(RoleType.CHAIR) &&
      assignedRole !== RoleType.CHAIR
    ) {
      throw new AuthError(
        400,
        "VALIDATION_ERROR",
        "You cannot remove Chair access from your own active session."
      );
    }

    payload.roles = [assignedRole];
    await logAuditEvent({
      actorId,
      action: "USER_ROLE_ASSIGNED",
      entityType: "User",
      entityId: userId,
      metadata: { role: assignedRole },
    });
  }

  if (input.statusNote !== undefined) {
    payload.statusNote = input.statusNote?.trim() || null;
  }

  await prisma.user.update({
    where: { id: userId },
    data: payload,
  });

  await logAuditEvent({
    actorId,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: userId,
    metadata: payload,
  });

  const updated = await getManagedUserSummary(userId);
  if (!updated) {
    throw new AuthError(404, "NOT_FOUND", "User not found.");
  }
  return updated;
}

export async function disableManagedUser(
  userId: number,
  note: string | null,
  actorId: number
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!user) {
    throw new AuthError(404, "NOT_FOUND", "User not found.");
  }
  if (user.status !== UserStatus.APPROVED) {
    throw new AuthError(
      400,
      "VALIDATION_ERROR",
      "Only approved accounts can be disabled."
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: UserStatus.DISABLED,
      statusNote: note?.trim() || "Account disabled",
      isActive: false,
    },
  });

  await revokeSessionsForUser(userId);
  await logAuditEvent({
    actorId,
    action: "USER_DISABLED",
    entityType: "User",
    entityId: userId,
    metadata: {
      note: note?.trim() || null,
    },
  });

  const updated = await getManagedUserSummary(userId);
  if (!updated) {
    throw new AuthError(404, "NOT_FOUND", "User not found.");
  }
  return updated;
}

export async function enableManagedUser(
  userId: number,
  note: string | null,
  actorId: number
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      roles: true,
    },
  });

  if (!user) {
    throw new AuthError(404, "NOT_FOUND", "User not found.");
  }
  if (user.status !== UserStatus.DISABLED) {
    throw new AuthError(
      400,
      "VALIDATION_ERROR",
      "Only disabled accounts can be enabled."
    );
  }
  if (user.roles.length === 0) {
    throw new AuthError(
      400,
      "VALIDATION_ERROR",
      "Disabled account must have an assigned role before it can be enabled."
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: UserStatus.APPROVED,
      isActive: true,
      statusNote: note?.trim() || null,
    },
  });

  await logAuditEvent({
    actorId,
    action: "USER_ENABLED",
    entityType: "User",
    entityId: userId,
    metadata: {
      note: note?.trim() || null,
    },
  });

  const updated = await getManagedUserSummary(userId);
  if (!updated) {
    throw new AuthError(404, "NOT_FOUND", "User not found.");
  }
  return updated;
}

export async function resetManagedUserPassword(
  userId: number,
  temporaryPassword: string,
  actorId: number
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      status: true,
      isActive: true,
    },
  });

  if (!user) {
    throw new AuthError(404, "NOT_FOUND", "User not found.");
  }
  if (user.status !== UserStatus.APPROVED || !user.isActive) {
    throw new AuthError(
      400,
      "VALIDATION_ERROR",
      "Only approved active accounts can receive a manual password reset."
    );
  }

  ensurePasswordPolicy(temporaryPassword, user.email);
  const passwordHash = await hashPassword(temporaryPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        forcePasswordChange: true,
      },
    }),
    prisma.authSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await logAuditEvent({
    actorId,
    action: "PASSWORD_RESET_ADMINISTERED",
    entityType: "User",
    entityId: user.id,
    metadata: {
      forcePasswordChange: true,
    },
  });

  const updated = await getManagedUserSummary(userId);
  if (!updated) {
    throw new AuthError(404, "NOT_FOUND", "User not found.");
  }
  return updated;
}
