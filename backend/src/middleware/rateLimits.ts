import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "../config/logger";

const DEFAULT_MESSAGE = { message: "Too many attempts, please try again later." };
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_EMAIL_MAX = 5;
const LOGIN_IP_MAX = 10;
const LOGIN_SUBNET_MAX = 30;
const LOGIN_LOCKOUT_MS = 15 * 60_000;
const PROGRESSIVE_BACKOFF_STEP_MS = 5_000;
const PROGRESSIVE_BACKOFF_CAP_MS = 60_000;

type AttemptEntry = {
  timestamps: number[];
  backoffUntil: number | null;
  lockUntil: number | null;
};

type SprayEntry = {
  timestamps: number[];
  emails: Map<string, number>;
};

const loginFailures = {
  email: new Map<string, AttemptEntry>(),
  ip: new Map<string, AttemptEntry>(),
  subnet: new Map<string, AttemptEntry>(),
};

const subnetSprayWindow = new Map<string, SprayEntry>();

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeIp(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getIpFromRequest(req: Request) {
  return normalizeIp(req.ip || req.socket?.remoteAddress || "");
}

function getSubnetKey(ip: string) {
  if (!ip) return "unknown";

  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
    return ip;
  }

  const segments = ip.split(":").filter(Boolean);
  return segments.slice(0, 4).join(":") || ip;
}

function pruneEntry(entry: AttemptEntry, now: number) {
  entry.timestamps = entry.timestamps.filter((timestamp) => now - timestamp < LOGIN_WINDOW_MS);
  if (entry.backoffUntil && entry.backoffUntil <= now) {
    entry.backoffUntil = null;
  }
  if (entry.lockUntil && entry.lockUntil <= now) {
    entry.lockUntil = null;
  }
}

function getEntry(store: Map<string, AttemptEntry>, key: string) {
  let entry = store.get(key);
  if (!entry) {
    entry = {
      timestamps: [],
      backoffUntil: null,
      lockUntil: null,
    };
    store.set(key, entry);
  }
  pruneEntry(entry, Date.now());
  return entry;
}

function clearEntry(store: Map<string, AttemptEntry>, key: string) {
  if (!key) return;
  store.delete(key);
}

function recordFailure(store: Map<string, AttemptEntry>, key: string, threshold: number) {
  if (!key) return getEntry(store, "__empty__");

  const now = Date.now();
  const entry = getEntry(store, key);
  entry.timestamps.push(now);

  if (entry.timestamps.length >= threshold) {
    entry.lockUntil = now + LOGIN_LOCKOUT_MS;
    entry.backoffUntil = null;
    return entry;
  }

  if (entry.timestamps.length >= 3) {
    const overflow = entry.timestamps.length - 2;
    const delayMs = Math.min(
      overflow * PROGRESSIVE_BACKOFF_STEP_MS,
      PROGRESSIVE_BACKOFF_CAP_MS
    );
    entry.backoffUntil = now + delayMs;
  }

  return entry;
}

function getRetryAfterSeconds(entry: AttemptEntry, now = Date.now()) {
  const waitUntil = Math.max(entry.lockUntil ?? 0, entry.backoffUntil ?? 0);
  if (waitUntil <= now) return 0;
  return Math.max(1, Math.ceil((waitUntil - now) / 1000));
}

function recordSpraySignal(subnet: string, email: string, req: Request) {
  if (!subnet || !email) return;

  const now = Date.now();
  const existing = subnetSprayWindow.get(subnet) ?? {
    timestamps: [],
    emails: new Map<string, number>(),
  };
  existing.timestamps = existing.timestamps.filter((timestamp) => now - timestamp < LOGIN_WINDOW_MS);
  for (const [knownEmail, timestamp] of Array.from(existing.emails.entries())) {
    if (now - timestamp >= LOGIN_WINDOW_MS) {
      existing.emails.delete(knownEmail);
    }
  }

  existing.timestamps.push(now);
  existing.emails.set(email, now);
  subnetSprayWindow.set(subnet, existing);

  if (existing.emails.size >= 8 || existing.timestamps.length >= LOGIN_SUBNET_MAX) {
    logger.warn({
      msg: "Potential password spraying detected",
      subnet,
      uniqueEmails: existing.emails.size,
      attempts: existing.timestamps.length,
      ip: req.ip,
      route: req.originalUrl,
    });
  }
}

function createLimiter(options: {
  windowMs: number;
  max: number;
  name: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator,
    skip: options.skip,
    message: DEFAULT_MESSAGE,
    handler: (req, res) => {
      logger.warn({
        msg: "Rate limit exceeded",
        limiter: options.name,
        ip: req.ip,
        route: req.originalUrl,
        email: normalizeEmail(req.body?.email),
      });
      res.status(429).json(DEFAULT_MESSAGE);
    },
  });
}

const emailKey = (prefix: string) => (req: Request) =>
  `${prefix}:${normalizeEmail(req.body?.email)}`;

const skipMissingEmail = (req: Request) => !normalizeEmail(req.body?.email);

export function assertLoginAttemptAllowed(req: Request, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const ip = getIpFromRequest(req);
  const subnet = getSubnetKey(ip);
  const now = Date.now();

  const entries = [
    getEntry(loginFailures.email, normalizedEmail),
    getEntry(loginFailures.ip, ip),
    getEntry(loginFailures.subnet, subnet),
  ];
  const retryAfterSeconds = Math.max(...entries.map((entry) => getRetryAfterSeconds(entry, now)));
  if (retryAfterSeconds > 0) {
    logger.warn({
      msg: "Blocked login attempt",
      ip,
      subnet,
      email: normalizedEmail,
      retryAfterSeconds,
      route: req.originalUrl,
    });
    return retryAfterSeconds;
  }

  return 0;
}

export function recordFailedLoginAttempt(req: Request, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const ip = getIpFromRequest(req);
  const subnet = getSubnetKey(ip);

  const emailEntry = recordFailure(loginFailures.email, normalizedEmail, LOGIN_EMAIL_MAX);
  const ipEntry = recordFailure(loginFailures.ip, ip, LOGIN_IP_MAX);
  const subnetEntry = recordFailure(loginFailures.subnet, subnet, LOGIN_SUBNET_MAX);
  recordSpraySignal(subnet, normalizedEmail, req);

  const retryAfterSeconds = Math.max(
    getRetryAfterSeconds(emailEntry),
    getRetryAfterSeconds(ipEntry),
    getRetryAfterSeconds(subnetEntry)
  );

  return retryAfterSeconds;
}

export function clearLoginAttemptTracking(req: Request, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const ip = getIpFromRequest(req);
  const subnet = getSubnetKey(ip);

  clearEntry(loginFailures.email, normalizedEmail);
  clearEntry(loginFailures.ip, ip);
  clearEntry(loginFailures.subnet, subnet);
}

export const globalLimiter = createLimiter({
  name: "global",
  windowMs: 60_000,
  max: 100,
});

export const signupIpLimiter = createLimiter({
  name: "signup-ip",
  windowMs: 15 * 60_000,
  max: 5,
});

export const signupEmailLimiter = createLimiter({
  name: "signup-email",
  windowMs: 15 * 60_000,
  max: 3,
  keyGenerator: emailKey("signup"),
  skip: skipMissingEmail,
});

export const loginIpLimiter = createLimiter({
  name: "login-ip",
  windowMs: 15 * 60_000,
  max: 10,
});

export const loginEmailLimiter = createLimiter({
  name: "login-email",
  windowMs: 15 * 60_000,
  max: 5,
  keyGenerator: emailKey("login"),
  skip: skipMissingEmail,
});


export const tokenCompletionIpLimiter = createLimiter({
  name: "token-complete-ip",
  windowMs: 60 * 60_000,
  max: 5,
});
