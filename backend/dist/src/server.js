"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * RERC Review Portal - Express Server
 *
 * Main entry point that configures middleware and mounts route modules.
 */
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
require("dotenv/config");
// Import route modules
const routes_1 = require("./routes");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
// =============================================================================
// Middleware
// =============================================================================
// Enable CORS for React frontend
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, "../public")));
// =============================================================================
// Routes
// =============================================================================
// Health & status routes (/, /health)
app.use(routes_1.healthRoutes);
// Committee & panel routes (/committees, /panels)
app.use(routes_1.committeeRoutes);
// Dashboard routes (/dashboard/queues, /ra/dashboard, /ra/submissions/:id)
app.use(routes_1.dashboardRoutes);
// Project routes (/projects, /projects/:id, /projects/:id/full, /projects/:projectId/submissions)
app.use(routes_1.projectRoutes);
// Submission & review routes (/submissions/*, /reviews/*)
app.use(routes_1.submissionRoutes);
// Mail merge & letter routes (/mail-merge/*, /letters/*)
app.use(routes_1.mailMergeRoutes);
// =============================================================================
// Start Server
// =============================================================================
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
