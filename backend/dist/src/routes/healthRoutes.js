"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Health and status check routes
 */
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../config/prismaClient"));
const branding_1 = require("../config/branding");
const router = (0, express_1.Router)();
// Root route – just to check server status
router.get("/", (_req, res) => {
    res.json({ status: "ok", message: `${branding_1.BRAND.name} API running` });
});
// DB health route – checks Prisma/Postgres connection
router.get("/health", async (_req, res) => {
    try {
        const userCount = await prismaClient_1.default.user.count();
        res.json({
            status: "ok",
            db: "connected",
            userCount,
        });
    }
    catch (error) {
        console.error("DB healthcheck failed:", error);
        res.status(500).json({
            status: "error",
            db: "unreachable",
        });
    }
});
exports.default = router;
