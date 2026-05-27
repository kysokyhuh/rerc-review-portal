import { z } from "zod";
import { PanelMemberRole } from "../generated/prisma/client";

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
