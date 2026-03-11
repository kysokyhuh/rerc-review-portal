import { Router } from "express";
import { validate } from "../middleware/validate";
import { requireAuth, AUTH_COOKIE_NAME } from "../middleware/auth";
import { loginSchema, signupSchema } from "../schemas/auth";
import { AuthError, getMeById, login, signup } from "../services/auth/authService";

const router = Router();

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 24 * 60 * 60 * 1000,
  path: "/",
};

router.post("/auth/signup", validate(signupSchema), async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;
    await signup({ fullName, email, password });
    return res.status(201).json({
      ok: true,
      message: "Signup submitted for approval.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
});

router.post("/auth/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await login(email, password);
    res.cookie(AUTH_COOKIE_NAME, result.accessToken, cookieOptions);
    return res.json({ user: result.user });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
});

router.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await getMeById(req.user!.id);
    return res.json({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return res.json({ ok: true });
});

export default router;
