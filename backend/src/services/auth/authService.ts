import bcrypt from "bcryptjs";
import prisma from "../../config/prismaClient";
import { RoleType, UserStatus } from "../../generated/prisma/client";
import { signAccessToken, verifyAccessToken, type AccessTokenPayload } from "../../utils/jwt";

const BCRYPT_ROUNDS = 12;

const APPROVAL_ROLES: RoleType[] = [
  RoleType.CHAIR,
  RoleType.RESEARCH_ASSOCIATE,
  RoleType.RESEARCH_ASSISTANT,
];

export class AuthError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function signup(input: {
  fullName: string;
  email: string;
  password: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, status: true },
  });

  if (existing) {
    throw new AuthError(409, "Email already registered");
  }

  const passwordHash = await hashPassword(input.password);
  await prisma.user.create({
    data: {
      fullName: input.fullName.trim(),
      email: normalizedEmail,
      passwordHash,
      status: UserStatus.PENDING,
      roles: [],
      isActive: false,
    },
  });
}

async function buildAccessPayload(userId: number): Promise<AccessTokenPayload> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
      isActive: true,
      roles: true,
    },
  });

  if (!user || user.status !== UserStatus.ACTIVE || !user.isActive) {
    throw new AuthError(401, "User is not active");
  }

  return {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    committeeRoles: {},
  };
}

export async function login(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || !user.passwordHash) {
    throw new AuthError(401, "Invalid email or password");
  }
  if (user.status !== UserStatus.ACTIVE || !user.isActive) {
    throw new AuthError(403, "Account is pending or inactive");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthError(401, "Invalid email or password");
  }

  const payload = await buildAccessPayload(user.id);
  const accessToken = signAccessToken(payload);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: payload.roles,
      committeeRoles: payload.committeeRoles,
      status: user.status,
    },
  };
}

export async function getMeFromToken(token: string) {
  const payload = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      fullName: true,
      roles: true,
      status: true,
      isActive: true,
    },
  });
  if (!user || user.status !== UserStatus.ACTIVE || !user.isActive) {
    throw new AuthError(401, "Not authenticated");
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    status: user.status,
  };
}

export async function getMeById(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      roles: true,
      status: true,
      isActive: true,
    },
  });
  if (!user || user.status !== UserStatus.ACTIVE || !user.isActive) {
    throw new AuthError(401, "Not authenticated");
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    status: user.status,
  };
}

export function sanitizeAssignedRoles(inputRoles: RoleType[]) {
  const clean = Array.from(new Set(inputRoles)).filter((role) =>
    APPROVAL_ROLES.includes(role)
  );
  if (clean.length === 0) {
    throw new AuthError(400, "At least one role must be assigned");
  }
  return clean;
}
