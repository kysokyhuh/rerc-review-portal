import type { NextFunction, Request, Response } from "express";

export function enforceForcedPasswordChange(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (
    !req.user?.forcePasswordChange ||
    req.path === "/" ||
    req.path === "/health"
  ) {
    return next();
  }

  return res.status(403).json({
    code: "PASSWORD_CHANGE_REQUIRED",
    message: "You must change your password before continuing.",
  });
}
