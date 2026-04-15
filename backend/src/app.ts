/**
 * URERB Review Portal - Express App
 *
 * Configures middleware and mounts route modules.
 */
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { existsSync } from "fs";
import path from "path";
import helmet from "helmet";
import pinoHttp from "pino-http";
import "dotenv/config";

// Import route modules
import {
  healthRoutes,
  committeeRoutes,
  dashboardRoutes,
  exemptRoutes,
  projectRoutes,
  submissionRoutes,
  mailMergeRoutes,
  importRoutes,
  reportRoutes,
  holidayRoutes,
  academicTermRoutes,
  adminUserRoutes,
} from "./routes";
import authRoutes from "./routes/authRoutes";
import { authenticateUser } from "./middleware/auth";
import { csrfProtection } from "./middleware/csrf";
import { enforceForcedPasswordChange } from "./middleware/forcePasswordChange";
import { globalLimiter } from "./middleware/rateLimits";
import { requestId } from "./middleware/requestId";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./config/logger";
import { getAllowedOrigins } from "./config/requestOrigins";

const app = express();
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : "loopback");

const allowedOrigins = getAllowedOrigins();
const frontendDistDir = path.resolve(__dirname, "../../frontend/dist");
const frontendIndexPath = path.join(frontendDistDir, "index.html");
const frontendBundleAvailable = existsSync(frontendIndexPath);
const SPA_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/login$/,
  /^\/signup$/,
  /^\/change-password$/,
  /^\/not-authorized$/,
  /^\/dashboard$/,
  /^\/queues\/[^/]+$/,
  /^\/holidays$/,
  /^\/calendar$/,
  /^\/admin\/users$/,
  /^\/admin\/account-management$/,
  /^\/projects\/new$/,
  /^\/projects\/new-classic$/,
  /^\/projects\/[^/]+$/,
  /^\/imports\/projects$/,
  /^\/reports$/,
  /^\/archives$/,
  /^\/submissions\/[^/]+$/,
];

function isBrowserNavigationRequest(req: express.Request) {
  const secFetchDest = req.get("sec-fetch-dest");
  if (secFetchDest === "document") {
    return true;
  }
  return Boolean(req.accepts("html")) && !req.accepts("json");
}

function shouldServeFrontendApp(req: express.Request) {
  if (!frontendBundleAvailable || req.method !== "GET") {
    return false;
  }

  if (path.extname(req.path)) {
    return false;
  }

  if (!isBrowserNavigationRequest(req)) {
    return false;
  }

  return SPA_ROUTE_PATTERNS.some((pattern) => pattern.test(req.path));
}

// =============================================================================
// Middleware
// =============================================================================

// Enable CORS for React frontend
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
    hsts: process.env.NODE_ENV === "production",
  })
);

app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()"
  );
  next();
});

app.use(express.json());
app.use(cookieParser());

if (frontendBundleAvailable) {
  app.use(express.static(frontendDistDir, { index: false }));
}

// Request ID — attaches unique ID to every request
app.use(requestId);

// Structured request logging
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => {
        // Don't log health checks
        const url = (req as any).url || "";
        return url === "/health" || url === "/";
      },
    },
    customProps: (req) => ({
      reqId: (req as any).id,
    }),
  })
);

app.use(globalLimiter);

app.use((req, res, next) => {
  if (!shouldServeFrontendApp(req)) {
    return next();
  }
  return res.sendFile(frontendIndexPath);
});

// =============================================================================
// Routes
// =============================================================================

// Attach user from JWT/cookie (or explicit dev header adapter when enabled)
app.use(authenticateUser);
app.use(csrfProtection);

// Auth routes
app.use(authRoutes);

// Users flagged for forced password change may only use auth/session routes
app.use(enforceForcedPasswordChange);

// Health & status routes (/, /health)
app.use(healthRoutes);

// Committee & panel routes (/committees, /panels)
app.use(committeeRoutes);

// Dashboard routes (/dashboard/queues, /ra/dashboard, /ra/submissions/:id)
app.use(dashboardRoutes);

// Exempted queue routes (/queues/exempted)
app.use(exemptRoutes);

// Project routes (/projects, /projects/:id, /projects/:id/full, /projects/:projectId/submissions)
app.use(projectRoutes);

// Submission & review routes (/submissions/*, /reviews/*)
app.use(submissionRoutes);

// Mail merge & letter routes (/mail-merge/*, /letters/*)
app.use(mailMergeRoutes);

// Import routes (/api/imports/*)
app.use(importRoutes);

// Reports routes (/reports/*)
app.use(reportRoutes);

// Holiday routes (/holidays)
app.use(holidayRoutes);

// Academic term routes (/academic-terms)
app.use(academicTermRoutes);

// Chair-only admin user management routes
app.use(adminUserRoutes);

// =============================================================================
// Error handler — MUST be last
// =============================================================================
app.use(errorHandler);

export default app;
