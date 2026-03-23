import { z } from "zod";

export const createHolidaySchema = z.object({
  date: z.string().min(1, "Date is required"),
  name: z.string().min(1, "Name is required"),
});

export const updateHolidaySchema = z.object({
  date: z.string().optional(),
  name: z.string().optional(),
}).refine(
  (data) => data.date !== undefined || data.name !== undefined,
  { message: "At least one of date or name is required" },
);
