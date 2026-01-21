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
// =============================================================================
// Middleware
// =============================================================================
// Enable CORS for React frontend
app.use((0, cors_1.default)({
    origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:3000",
    ],
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
