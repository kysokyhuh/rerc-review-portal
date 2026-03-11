/**
 * Project routes — thin controller layer
 */
import { Router } from "express";
import prisma from "../config/prismaClient";
import { RoleType } from "../generated/prisma/client";
import { requireAnyRole, requireUser } from "../middleware/auth";
import { requireProjectAccess } from "../middleware/reviewerScope";
import {
  createProjectWithInitialSubmission,
  DuplicateProjectCodeError,
  ProjectCreateValidationError,
} from "../services/projects/createProjectWithInitialSubmission";
import {
  listProjects,
  searchProjects,
  getArchivedProjects,
  getProjectById,
  getProjectFull,
  getProjectProfile,
  upsertProjectProfile,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  createSubmissionForProject,
} from "../services/projects/projectService";

const router = Router();

// Create project + initial submission via individual entry form
router.post(
  "/projects",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  async (req, res, next) => {
    try {
      const created = await createProjectWithInitialSubmission(req.body, req.user!.id);
      return res.status(201).json(created);
    } catch (error: any) {
      if (error instanceof ProjectCreateValidationError) {
        return res.status(400).json({ message: "Validation failed.", errors: error.errors });
      }
      if (error instanceof DuplicateProjectCodeError) {
        return res.status(409).json({ message: "Project code already exists.", projectId: error.projectId });
      }
      if (error?.code === "P2002") {
        const normalizedCode = String(req.body?.projectCode ?? "").trim().toUpperCase();
        const existingProject = normalizedCode
          ? await prisma.project.findFirst({
              where: { projectCode: normalizedCode },
              select: { id: true },
            })
          : null;
        return res.status(409).json({
          message: "Project code already exists.",
          projectId: existingProject?.id,
        });
      }
      next(error);
    }
  }
);

// List all projects
router.get("/projects", requireUser, async (_req, res, next) => {
  try {
    const projects = await listProjects();
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// Search projects
router.get("/projects/search", requireUser, async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();
    const rawLimit = Number(req.query.limit || 8);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 20) : 8;
    const committeeCode = req.query.committeeCode ? String(req.query.committeeCode) : null;
    const result = await searchProjects(query, limit, committeeCode);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Archived projects
router.get("/projects/archived", requireUser, async (req, res, next) => {
  try {
    const rawLimit = Number(req.query.limit || 100);
    const result = await getArchivedProjects({
      committeeCode: req.query.committeeCode ? String(req.query.committeeCode) : null,
      limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 100,
      offset: Number(req.query.offset || 0),
      search: req.query.search ? String(req.query.search).trim() : null,
      statusFilter: req.query.status ? String(req.query.status).trim() : null,
      reviewTypeFilter: req.query.reviewType ? String(req.query.reviewType).trim() : null,
      collegeFilter: req.query.college ? String(req.query.college).trim() : null,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get a single project
router.get("/projects/:id", requireUser, requireProjectAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid project id" });
    const project = await getProjectById(id);
    res.json(project);
  } catch (error) {
    next(error);
  }
});

// Full project lifecycle
router.get("/projects/:id/full", requireUser, requireProjectAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid project id" });
    const project = await getProjectFull(id);
    res.json(project);
  } catch (error) {
    next(error);
  }
});

// Protocol profile + milestones
router.get("/projects/:id/profile", requireUser, requireProjectAccess, async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return res.status(400).json({ message: "Invalid project id" });
    const result = await getProjectProfile(projectId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Upsert profile
router.put(
  "/projects/:id/profile",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  async (req, res, next) => {
    try {
      const projectId = Number(req.params.id);
      if (Number.isNaN(projectId)) return res.status(400).json({ message: "Invalid project id" });
      const profile = await upsertProjectProfile(projectId, req.body ?? {}, req.user!.id);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  }
);

// Create milestone
router.post(
  "/projects/:id/profile/milestones",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  async (req, res, next) => {
    try {
      const projectId = Number(req.params.id);
      if (Number.isNaN(projectId)) return res.status(400).json({ message: "Invalid project id" });
      const result = await createMilestone(projectId, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Update milestone
router.patch(
  "/projects/:id/profile/milestones/:milestoneId",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  async (req, res, next) => {
    try {
      const projectId = Number(req.params.id);
      const milestoneId = Number(req.params.milestoneId);
      if (Number.isNaN(projectId) || Number.isNaN(milestoneId)) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const result = await updateMilestone(projectId, milestoneId, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Delete milestone
router.delete(
  "/projects/:id/profile/milestones/:milestoneId",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  async (req, res, next) => {
    try {
      const projectId = Number(req.params.id);
      const milestoneId = Number(req.params.milestoneId);
      if (Number.isNaN(projectId) || Number.isNaN(milestoneId)) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const result = await deleteMilestone(projectId, milestoneId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Create a submission for a project
router.post(
  "/projects/:projectId/submissions",
  requireAnyRole([RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  async (req, res, next) => {
    try {
      const projectId = Number(req.params.projectId);
      if (Number.isNaN(projectId)) return res.status(400).json({ message: "Invalid projectId" });
      const result = await createSubmissionForProject(projectId, req.body, req.user!.id);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
