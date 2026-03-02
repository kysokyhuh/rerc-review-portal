import { Router } from "express";
import { login, refresh, AuthError } from "../services/auth/authService";

const router = Router();

// POST /auth/login
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const result = await login(email, password);

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/auth/refresh",
    });

    return res.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /auth/refresh
router.post("/auth/refresh", async (req, res) => {
  try {
    const token =
      req.cookies?.refreshToken || req.body.refreshToken;

    if (!token) {
      return res.status(401).json({ message: "Refresh token required" });
    }

    const result = await refresh(token);

    // Rotate the cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/auth/refresh",
    });

    return res.json({ accessToken: result.accessToken });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    // Invalid/expired refresh token
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
});

// POST /auth/logout
router.post("/auth/logout", (_req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/auth/refresh",
  });
  return res.json({ message: "Logged out" });
});

// GET /auth/me — returns current user from JWT (requires auth middleware)
router.get("/auth/me", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  return res.json({ user: req.user });
});

export default router;
