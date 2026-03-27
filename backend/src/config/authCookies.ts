const isProduction = process.env.NODE_ENV === "production";

export const AUTH_COOKIE_NAME = isProduction ? "__Host-authToken" : "authToken";
export const REFRESH_COOKIE_NAME = isProduction ? "__Host-refreshToken" : "refreshToken";
export const CSRF_COOKIE_NAME = isProduction ? "__Host-csrfToken" : "csrfToken";

export const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
};

export const readableCookieOptions = {
  httpOnly: false,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
};
