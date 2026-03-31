import type { Request, Response } from "express";
import { Router } from "express";
import { validate } from "../middleware/validate";
import {
  requireAuth,
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from "../middleware/auth";
import {
  clearCsrfCookie,
  setCsrfCookie,
} from "../middleware/csrf";
import { baseCookieOptions } from "../config/authCookies";
import {
  changePasswordSchema,
  loginSchema,
  signupSchema,
  updateProfileSchema,
} from "../schemas/auth";
import {
  AuthError,
  changePassword,
  getMeById,
  login,
  logoutSession,
  refreshSession,
  signup,
  updateOwnProfile,
} from "../services/auth/authService";
import {
  assertLoginAttemptAllowed,
  clearLoginAttemptTracking,
  loginEmailLimiter,
  loginIpLimiter,
  recordFailedLoginAttempt,
  signupEmailLimiter,
  signupIpLimiter,
} from "../middleware/rateLimits";

const router = Router();

const accessCookieClearOptions = {
  ...baseCookieOptions,
  path: "/",
};

const refreshCookieClearOptions = {
  ...baseCookieOptions,
  path: "/",
};

const getRequestContext = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") ?? null,
});

function setAuthCookies(
  res: Response,
  result: {
    accessToken: string;
    refreshToken: string;
    accessCookieMaxAgeMs: number;
    refreshCookieMaxAgeMs: number;
  }
) {
  res.cookie(AUTH_COOKIE_NAME, result.accessToken, {
    ...baseCookieOptions,
    maxAge: result.accessCookieMaxAgeMs,
  });
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
    ...baseCookieOptions,
    maxAge: result.refreshCookieMaxAgeMs,
  });
  setCsrfCookie(res);
}

function clearAuthCookies(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, accessCookieClearOptions);
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieClearOptions);
  clearCsrfCookie(res);
}

function sendAuthError(res: Response, error: AuthError) {
  return res.status(error.statusCode).json({
    code: error.code,
    message: error.message,
  });
}

router.get("/auth/csrf", (_req, res) => {
  const csrfToken = setCsrfCookie(res);
  return res.json({ ok: true, csrfToken });
});

router.post(
  "/auth/signup",
  signupIpLimiter,
  signupEmailLimiter,
  validate(signupSchema),
  async (req, res, next) => {
    try {
      const { firstName, lastName, email, password, confirmPassword } = req.body;
      const result = await signup(
        { firstName, lastName, email, password, confirmPassword },
        getRequestContext(req)
      );
      return res.status(201).json({
        ok: true,
        message: result.message,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return sendAuthError(res, error);
      }
      return next(error);
    }
  }
);

router.post(
  "/auth/login",
  loginIpLimiter,
  loginEmailLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    const { email, password } = req.body;
    const retryAfterSeconds = assertLoginAttemptAllowed(req, email);
    if (retryAfterSeconds > 0) {
      return res
        .status(429)
        .set("Retry-After", String(retryAfterSeconds))
        .json({ message: "Too many attempts, please try again later." });
    }

    try {
      const result = await login(email, password, getRequestContext(req));
      clearLoginAttemptTracking(req, email);
      setAuthCookies(res, result);
      return res.json({
        user: result.user,
        mustChangePassword: result.user.forcePasswordChange,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.statusCode === 401) {
          const backoffRetryAfter = recordFailedLoginAttempt(req, email);
          clearAuthCookies(res);
          if (backoffRetryAfter > 0) {
            return res
              .status(429)
              .set("Retry-After", String(backoffRetryAfter))
              .json({ message: "Too many attempts, please try again later." });
          }
        }
        clearAuthCookies(res);
        return sendAuthError(res, error);
      }
      return next(error);
    }
  }
);

router.post("/auth/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!refreshToken) {
      throw new AuthError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const result = await refreshSession(refreshToken, getRequestContext(req));
    setAuthCookies(res, result);
    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      clearAuthCookies(res);
      return sendAuthError(res, error);
    }
    return next(error);
  }
});

router.post(
  "/auth/change-password",
  requireAuth,
  validate(changePasswordSchema),
  async (req, res, next) => {
    try {
      const result = await changePassword(
        req.user!.id,
        req.user!.sessionId || "",
        req.body,
        getRequestContext(req)
      );
      setAuthCookies(res, result);
      return res.json({
        ok: true,
        user: result.user,
        mustChangePassword: false,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.statusCode === 401) {
          clearAuthCookies(res);
        }
        return sendAuthError(res, error);
      }
      return next(error);
    }
  }
);

router.get("/auth/profile", requireAuth, async (req, res, next) => {
  try {
    const user = await getMeById(req.user!.id);
    return res.json({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return sendAuthError(res, error);
    }
    return next(error);
  }
});

router.patch(
  "/auth/profile",
  requireAuth,
  validate(updateProfileSchema),
  async (req, res, next) => {
    try {
      const user = await updateOwnProfile(
        req.user!.id,
        req.body,
        getRequestContext(req)
      );
      return res.json({
        ok: true,
        user,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return sendAuthError(res, error);
      }
      return next(error);
    }
  }
);

router.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await getMeById(req.user!.id);
    return res.json({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return sendAuthError(res, error);
    }
    return next(error);
  }
});

router.post("/auth/logout", async (req, res, next) => {
  try {
    const accessToken = req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await logoutSession({ accessToken, refreshToken }, getRequestContext(req));
    clearAuthCookies(res);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
