import jwt from "jsonwebtoken";

function getSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET", fallback: string) {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "development") {
    return fallback;
  }
  throw new Error(`${name} must be set outside development`);
}

const ACCESS_SECRET = getSecret("JWT_ACCESS_SECRET", "dev-access-secret");
const REFRESH_SECRET = getSecret("JWT_REFRESH_SECRET", "dev-refresh-secret");
const JWT_ISSUER = process.env.JWT_ISSUER || "urerb-review-portal";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "urerb-review-portal-users";

export const ACCESS_EXPIRES_IN = "15m";
export const REFRESH_EXPIRES_IN = "7d";
export const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type BasePayload = {
  sub: number;
  sid: string;
};

export interface AccessTokenPayload extends BasePayload {
  typ: "access";
}

export interface RefreshTokenPayload extends BasePayload {
  typ: "refresh";
}

export function signAccessToken(payload: BasePayload): string {
  return jwt.sign(
    { ...payload, typ: "access" },
    ACCESS_SECRET,
    {
      expiresIn: ACCESS_EXPIRES_IN,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
}

export function signRefreshToken(payload: BasePayload): string {
  return jwt.sign(
    { ...payload, typ: "refresh" },
    REFRESH_SECRET,
    {
      expiresIn: REFRESH_EXPIRES_IN,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as unknown as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, REFRESH_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as unknown as RefreshTokenPayload;
}
