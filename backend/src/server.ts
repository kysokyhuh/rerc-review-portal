/**
 * RERC Review Portal - Express Server
 * 
 * Main entry point that configures middleware and mounts route modules.
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
} from "./routes";

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// Middleware
// =============================================================================

// Enable CORS for React frontend
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

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

// =============================================================================
// Start Server
// =============================================================================

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
