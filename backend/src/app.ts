/**
 * URERB Review Portal - Express App
 *
 * Configures middleware and mounts route modules.
 */
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import "dotenv/config";

// Import route modules
import {
  healthRoutes,
  committeeRoutes,
  dashboardRoutes,
  projectRoutes,
  submissionRoutes,
  mailMergeRoutes,
  importRoutes,
  reportRoutes,
  holidayRoutes,
} from "./routes";
import authRoutes from "./routes/authRoutes";
import { authenticateUser } from "./middleware/auth";
import { requestId } from "./middleware/requestId";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./config/logger";

const app = express();
const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

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

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "../public")));

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

// Rate limiting — strict on auth, relaxed globally
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later" },
});

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// =============================================================================
// Routes
// =============================================================================

// Auth routes — BEFORE authenticateUser middleware (login doesn't need auth)
app.use("/auth", authLimiter);
app.use(authRoutes);

// Attach user from JWT (or dev fallback) for all subsequent routes
app.use(authenticateUser);

// Health & status routes (/, /health)
app.use(healthRoutes);

// Committee & panel routes (/committees, /panels)
app.use(committeeRoutes);

// Dashboard routes (/dashboard/queues, /ra/dashboard, /ra/submissions/:id)
app.use(dashboardRoutes);

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

// =============================================================================
// Error handler — MUST be last
// =============================================================================
app.use(errorHandler);

export default app;
