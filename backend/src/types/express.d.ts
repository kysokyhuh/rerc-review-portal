import { RoleType } from "../generated/prisma/client";

declare global {
  namespace Express {
    interface User {
      id: number;
      sessionId?: string;
      sessionAbsoluteExpiresAt?: Date | null;
      sessionIdleExpiresAt?: Date | null;
      lastReauthenticatedAt?: Date | null;
      email?: string;
      fullName?: string;
      forcePasswordChange?: boolean;
      roles: RoleType[];
      committeeRoles?: Record<number, RoleType>;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
