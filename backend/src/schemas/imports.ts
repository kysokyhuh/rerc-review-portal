import { z } from "zod";

const rowEditSchema = z
  .object({
    rowNumber: z.number().int().positive(),
    values: z.record(z.string(), z.string()),
  })
  .strict();

export const importCommitSchema = z
  .object({
    mapping: z
      .union([z.string().max(50_000), z.record(z.string(), z.unknown())])
      .optional(),
    rowEdits: z
      .union([z.string().max(500_000), z.array(rowEditSchema)])
      .optional(),
  })
  .strict();
