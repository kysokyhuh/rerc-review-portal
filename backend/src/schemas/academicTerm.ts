import { z } from "zod";

export const createAcademicTermSchema = z
  .object({
    academicYear: z
      .string()
      .regex(/^\d{4}-\d{4}$/, "Format must be YYYY-YYYY (e.g. 2025-2026)"),
    term: z
      .number({ required_error: "term is required", invalid_type_error: "term must be a number" })
      .int("term must be an integer")
      .min(1, "term must be at least 1")
      .max(3, "term must be at most 3"),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
  })
  .superRefine((data, ctx) => {
    // endDate must not precede startDate
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date cannot be before start date",
        path: ["endDate"],
      });
    }
    // academicYear must span exactly one year
    const [y1, y2] = data.academicYear.split("-").map(Number);
    if (y2 !== y1 + 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Academic year must span exactly one year (e.g. 2025-2026)",
        path: ["academicYear"],
      });
    }
  });

export const updateAcademicTermSchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD")
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD")
      .optional(),
  })
  .refine(
    (data) => data.startDate !== undefined || data.endDate !== undefined,
    { message: "At least one of startDate or endDate is required" }
  );
