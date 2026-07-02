import { z } from "zod";
import { PanelMemberRole } from "../generated/prisma/client";

export const createPanelSchema = z
  .object({
    committeeId: z.number().int().positive().optional(),
    committeeCode: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    code: z.string().trim().min(1).max(32).optional(),
  })
  .refine((value) => value.committeeId || value.committeeCode, {
    message: "Provide a committeeId or committeeCode.",
    path: ["committeeId"],
  })
  .strict();

export const createPanelMemberSchema = z
  .object({
    userId: z.number().int().positive().optional(),
    email: z.string().trim().email().optional(),
    role: z.enum([
      PanelMemberRole.CHAIR,
      PanelMemberRole.MEMBER,
      PanelMemberRole.SECRETARIAT,
    ]),
  })
  .refine((value) => value.userId || value.email, {
    message: "Provide a userId or email.",
    path: ["email"],
  })
  .strict();

export const updatePanelMemberSchema = z
  .object({
    role: z
      .enum([
        PanelMemberRole.CHAIR,
        PanelMemberRole.MEMBER,
        PanelMemberRole.SECRETARIAT,
      ])
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.isActive !== undefined, {
    message: "Provide at least one field to update.",
  })
  .strict();
