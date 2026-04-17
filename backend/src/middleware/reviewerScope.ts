import type { NextFunction, Request, Response } from "express";
import { RoleType } from "../generated/prisma/client";
import prisma from "../config/prismaClient";

const rejectIfProjectDeleted = (
  project: { deletedAt: Date | null; purgedAt: Date | null } | null,
  res: Response
) => {
  if (!project || project.purgedAt) {
    res.status(404).json({ message: "Project not found" });
    return true;
  }
  if (project.deletedAt) {
    res.status(409).json({
      message: "Project is in Recently Deleted. Restore it before making changes.",
      code: "PROJECT_DELETED",
    });
    return true;
  }
  return false;
};

export const requireAssignedReviewerByReviewId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (!req.user.roles.includes(RoleType.RESEARCH_ASSISTANT)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const reviewId = Number(req.params.reviewId);
  if (!Number.isFinite(reviewId)) {
    return res.status(400).json({ message: "Invalid reviewId" });
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { reviewerId: true, submissionId: true },
  });
  if (!review) return res.status(404).json({ message: "Review not found" });
  if (review.reviewerId !== req.user.id) {
    return res.status(403).json({ message: "Not assigned to this review" });
  }

  return next();
};

export const requireSubmissionAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  const submissionId = Number(req.params.id || req.params.submissionId);
  if (!Number.isFinite(submissionId)) {
    return res.status(400).json({ message: "Invalid submission id" });
  }

  if (
    req.user.roles.includes(RoleType.CHAIR) ||
    req.user.roles.includes(RoleType.RESEARCH_ASSOCIATE) ||
    req.user.roles.includes(RoleType.ADMIN)
  ) {
    return next();
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      createdById: true,
      project: {
        select: {
          createdById: true,
        },
      },
    },
  });
  if (!submission) {
    return res.status(404).json({ message: "Submission not found" });
  }

  if (
    submission.createdById === req.user.id ||
    submission.project?.createdById === req.user.id
  ) {
    return next();
  }

  if (
    !req.user.roles.includes(RoleType.RESEARCH_ASSISTANT) &&
    !req.user.roles.includes(RoleType.REVIEWER)
  ) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const assignment = await prisma.review.findFirst({
    where: { submissionId, reviewerId: req.user.id },
    select: { id: true },
  });
  if (!assignment) {
    return res.status(403).json({ message: "Not assigned to this submission" });
  }
  return next();
};

export const requireProjectAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  const projectId = Number(req.params.id || req.params.projectId);
  if (!Number.isFinite(projectId)) {
    return res.status(400).json({ message: "Invalid project id" });
  }

  if (
    req.user.roles.includes(RoleType.CHAIR) ||
    req.user.roles.includes(RoleType.RESEARCH_ASSOCIATE) ||
    req.user.roles.includes(RoleType.ADMIN)
  ) {
    return next();
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { createdById: true },
  });
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  if (project.createdById === req.user.id) {
    return next();
  }

  if (
    !req.user.roles.includes(RoleType.RESEARCH_ASSISTANT) &&
    !req.user.roles.includes(RoleType.REVIEWER)
  ) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const assignment = await prisma.review.findFirst({
    where: {
      reviewerId: req.user.id,
      submission: { projectId },
    },
    select: { id: true },
  });
  if (!assignment) {
    return res.status(403).json({ message: "Not assigned to this project" });
  }

  return next();
};

export const requireMutableProjectByProjectId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const projectId = Number(req.params.id || req.params.projectId);
  if (!Number.isFinite(projectId)) {
    return res.status(400).json({ message: "Invalid project id" });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      deletedAt: true,
      purgedAt: true,
    },
  });

  if (rejectIfProjectDeleted(project, res)) {
    return;
  }

  return next();
};

export const requireMutableProjectBySubmissionId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const submissionId = Number(req.params.id || req.params.submissionId);
  if (!Number.isFinite(submissionId)) {
    return res.status(400).json({ message: "Invalid submission id" });
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      project: {
        select: {
          deletedAt: true,
          purgedAt: true,
        },
      },
    },
  });

  if (!submission) {
    return res.status(404).json({ message: "Submission not found" });
  }

  if (rejectIfProjectDeleted(submission.project, res)) {
    return;
  }

  return next();
};

export const requireMutableProjectByReviewId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const reviewId = Number(req.params.reviewId);
  if (!Number.isFinite(reviewId)) {
    return res.status(400).json({ message: "Invalid reviewId" });
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      submission: {
        select: {
          project: {
            select: {
              deletedAt: true,
              purgedAt: true,
            },
          },
        },
      },
    },
  });

  if (!review?.submission) {
    return res.status(404).json({ message: "Review not found" });
  }

  if (rejectIfProjectDeleted(review.submission.project, res)) {
    return;
  }

  return next();
};
