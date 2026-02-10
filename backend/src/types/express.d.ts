import { RoleType } from "../generated/prisma/client";

declare global {
  namespace Express {
    interface User {
      id: number;
      email?: string;
      fullName?: string;
      roles: RoleType[];
      committeeRoles?: Record<number, RoleType>;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
