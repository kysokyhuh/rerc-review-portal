/**
 * RERC Review Portal - Express App
 *
 * Configures middleware and mounts route modules.
 */
import express from "express";
import cors from "cors";
import path from "path";
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
} from "./routes";
import { authenticateUser } from "./middleware/auth";

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
app.use(express.static(path.join(__dirname, "../public")));
app.use(authenticateUser);

// =============================================================================
// Routes
// =============================================================================

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

export default app;
