import type { NextFunction, Request, Response } from "express";
import { generateOpaqueToken } from "../utils/secureTokens";
import { CSRF_COOKIE_NAME, readableCookieOptions } from "../config/authCookies";
import { getAllowedOrigins, getTrustedRequestOrigin } from "../config/requestOrigins";

const CSRF_HEADER_NAME = "x-csrf-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ALLOWED_ORIGINS = new Set(getAllowedOrigins());

export const csrfCookieOptions = readableCookieOptions;

function isProtectedMutation(req: Request) {
  return !SAFE_METHODS.has(req.method.toUpperCase());
}

export function issueCsrfToken() {
  return generateOpaqueToken(24);
}

export function setCsrfCookie(res: Response, token = issueCsrfToken()) {
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions);
  return token;
}

export function clearCsrfCookie(res: Response) {
  res.clearCookie(CSRF_COOKIE_NAME, csrfCookieOptions);
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (!isProtectedMutation(req)) {
    return next();
  }

  const trustedOrigin = getTrustedRequestOrigin({
    origin: req.get("origin"),
    referer: req.get("referer"),
  });
  if (!trustedOrigin || !ALLOWED_ORIGINS.has(trustedOrigin)) {
    return res.status(403).json({ message: "Invalid request origin" });
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.header(CSRF_HEADER_NAME);
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }

  return next();
}
