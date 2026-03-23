import type { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const reqId = (req as any).id || "unknown";

  if (err instanceof AppError) {
    logger.warn({ reqId, code: err.code, message: err.message });
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
      requestId: reqId,
    });
  }

  // Unexpected error — log full stack, return generic message
  logger.error({ reqId, err: err.message, stack: err.stack });

  const isProd = process.env.NODE_ENV === "production";
  return res.status(500).json({
    error: isProd ? "Internal server error" : err.message,
    code: "INTERNAL_ERROR",
    requestId: reqId,
  });
};
