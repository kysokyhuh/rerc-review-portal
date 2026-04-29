/**
 * Health and status check routes
 */
import { Router } from "express";
import type { Response } from "express";
import prisma from "../config/prismaClient";
import { BRAND } from "../config/branding";

const router = Router();

function sendLiveness(res: Response) {
  res.json({
    status: "ok",
    service: BRAND.name,
    timestamp: new Date().toISOString(),
  });
}

// Lightweight liveness routes. These intentionally avoid the database so
// Render and external keep-alive pings do not wake Neon unnecessarily.
router.get("/", (_req, res) => {
  sendLiveness(res);
});

router.get("/live", (_req, res) => {
  sendLiveness(res);
});

router.get("/health", (_req, res) => {
  sendLiveness(res);
});

// Readiness route – checks Prisma/Postgres connection when DB health matters.
router.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      db: "connected",
    });
  } catch (error) {
    console.error("DB readiness check failed:", error);
    res.status(500).json({
      status: "error",
      db: "unreachable",
    });
  }
});

export default router;
