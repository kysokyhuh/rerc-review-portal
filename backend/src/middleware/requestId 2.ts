import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = req.header("x-request-id") || crypto.randomUUID();
  (req as any).id = id;
  res.setHeader("x-request-id", id);
  next();
};
