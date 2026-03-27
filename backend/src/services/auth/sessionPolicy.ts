import { RoleType } from "../../generated/prisma/client";

export const PRIVILEGED_SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
export const PRIVILEGED_SESSION_IDLE_MS = 30 * 60 * 1000;
export const STANDARD_SESSION_ABSOLUTE_MS = 24 * 60 * 60 * 1000;
export const STANDARD_SESSION_IDLE_MS = 4 * 60 * 60 * 1000;
const PRIVILEGED_ROLES = new Set<RoleType>([RoleType.CHAIR, RoleType.ADMIN]);

export function getSessionPolicy(roles: RoleType[]) {
  if (roles.some((role) => PRIVILEGED_ROLES.has(role))) {
    return {
      absoluteMs: PRIVILEGED_SESSION_ABSOLUTE_MS,
      idleMs: PRIVILEGED_SESSION_IDLE_MS,
    };
  }

  return {
    absoluteMs: STANDARD_SESSION_ABSOLUTE_MS,
    idleMs: STANDARD_SESSION_IDLE_MS,
  };
}
