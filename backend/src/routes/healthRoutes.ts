/**
 * Health and status check routes
 */
import { Router } from "express";
import prisma from "../config/prismaClient";

const router = Router();

// Root route – just to check server status
router.get("/", (_req, res) => {
  res.json({ status: "ok", message: "RERC API skeleton running" });
});

// DB health route – checks Prisma/Postgres connection
router.get("/health", async (_req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({
      status: "ok",
      db: "connected",
      userCount,
    });
  } catch (error) {
    console.error("DB healthcheck failed:", error);
    res.status(500).json({
      status: "error",
      db: "unreachable",
    });
  }
});

export default router;
