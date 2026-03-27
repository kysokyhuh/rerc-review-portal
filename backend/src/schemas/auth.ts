import { z } from "zod";

const emailSchema = z.string().trim().max(254).email();
const passwordSchema = z.string().min(12, "Password must be at least 12 characters").max(200);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(200),
}).strict();

export const signupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().max(200),
}).strict();

export const changePasswordSchema = z.object({
  newPassword: passwordSchema,
  confirmPassword: z.string().max(200),
}).strict();
