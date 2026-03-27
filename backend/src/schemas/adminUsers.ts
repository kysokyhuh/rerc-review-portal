import { z } from "zod";
import { RoleType } from "../generated/prisma/client";

const editableRoleSchema = z.enum([
  RoleType.CHAIR,
  RoleType.RESEARCH_ASSOCIATE,
  RoleType.RESEARCH_ASSISTANT,
]);

export const approveUserSchema = z.object({
  role: editableRoleSchema,
}).strict();

export const rejectUserSchema = z.object({
  note: z.string().trim().min(1).max(500).optional(),
}).strict();

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  role: editableRoleSchema.nullable().optional(),
  statusNote: z.string().trim().max(500).nullable().optional(),
}).strict();

export const disableUserSchema = z.object({
  note: z.string().trim().min(1).max(500).optional(),
}).strict();

export const enableUserSchema = z.object({
  note: z.string().trim().min(1).max(500).optional(),
}).strict();

export const adminResetPasswordSchema = z.object({
  temporaryPassword: z.string().min(12).max(200),
}).strict();
