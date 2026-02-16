/**
 * Project routes
 */
import { Router } from "express";
import prisma from "../config/prismaClient";
import { RoleType } from "../generated/prisma/client";
import { requireRoles } from "../middleware/auth";
import {
  createProjectWithInitialSubmission,
  DuplicateProjectCodeError,
  ProjectCreateValidationError,
} from "../services/projects/createProjectWithInitialSubmission";

const router = Router();

const asNullableString = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const asNullableInt = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const asNullableBoolean = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
};

const asNullableDate = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// Create project + initial submission via individual entry form
router.post(
  "/projects",
  requireRoles([RoleType.ADMIN, RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  async (req, res) => {
  try {
    const {
      projectCode,
      title,
      piName,
      fundingType,
      committeeCode,
      submissionType,
      receivedDate,
      notes,
      collegeOrUnit,
      department,
      proponent,
      researchTypePHREB,
      researchTypePHREBOther,
      proponentCategory,
      // Extra ProtocolProfile fields
      panel,
      scientistReviewer,
      layReviewer,
      independentConsultant,
      honorariumStatus,
      classificationDate,
      finishDate,
      status,
      monthOfSubmission,
      monthOfClearance,
    } = req.body;

    const created = await createProjectWithInitialSubmission(
      {
        projectCode,
        title,
        piName,
        committeeCode,
        submissionType,
        receivedDate,
        fundingType,
        notes,
        collegeOrUnit,
        department,
        proponent,
        researchTypePHREB,
        researchTypePHREBOther,
        proponentCategory,
        panel,
        scientistReviewer,
        layReviewer,
        independentConsultant,
        honorariumStatus,
        classificationDate,
        finishDate,
        status: status,
        monthOfSubmission,
        monthOfClearance,
      },
      req.user?.id
    );

    return res.status(201).json(created);
  } catch (error: any) {
    if (error instanceof ProjectCreateValidationError) {
      return res.status(400).json({
        message: "Validation failed.",
        errors: error.errors,
      });
    }

    if (error instanceof DuplicateProjectCodeError) {
      return res.status(409).json({
        message: "Project code already exists.",
        projectId: error.projectId,
      });
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

    console.error("Error creating project:", error);
    return res.status(500).json({ message: "Failed to create project" });
  }
}
);

// List all projects (with basic metadata)
router.get("/projects", async (_req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        committee: true, // which committee handles it
        createdBy: true, // which user encoded it
      },
    });

    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
});

// Search projects by code, title, PI, keywords, or historical titles
router.get("/projects/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) {
      return res.json({ items: [] });
    }

    const rawLimit = Number(req.query.limit || 8);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 20)
      : 8;
    const committeeCode = req.query.committeeCode
      ? String(req.query.committeeCode)
      : null;

    const tokens = query.split(/\s+/).filter(Boolean);

    const titleHistory = await prisma.projectChangeLog.findMany({
      where: {
        fieldName: "title",
        OR: [
          { oldValue: { contains: query, mode: "insensitive" } },
          { newValue: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        projectId: true,
      },
      take: 25,
    });

    const titleHistoryIds = titleHistory.map((row) => row.projectId);

    const projects = await prisma.project.findMany({
      where: {
        ...(committeeCode
          ? {
              committee: {
                code: committeeCode,
              },
            }
          : {}),
        OR: [
          { projectCode: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
          { piName: { contains: query, mode: "insensitive" } },
          { piSurname: { contains: query, mode: "insensitive" } },
          ...(tokens.length > 0
            ? [{ keywords: { hasSome: tokens } }]
            : []),
          ...(titleHistoryIds.length > 0
            ? [{ id: { in: titleHistoryIds } }]
            : []),
        ],
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        projectCode: true,
        title: true,
        piName: true,
        updatedAt: true,
      },
    });

    res.json({ items: projects });
  } catch (error) {
    console.error("Error searching projects:", error);
    res.status(500).json({ message: "Failed to search projects" });
  }
});

/**
 * GET /projects/archived
 * 
 * Fetch archived projects - those with latest submission in CLOSED or WITHDRAWN status.
 * These are terminal states that don't appear in the active dashboard queues.
 * 
 * Query params:
 *   - committeeCode (optional): filter by committee
 *   - limit (optional): max results, default 100
 *   - offset (optional): pagination offset, default 0
 *   - search (optional): search by projectCode, title, or piName
 * 
 * WHY CSV IMPORTS DON'T SHOW IN DASHBOARD:
 * The dashboard queues only display submissions with active workflow statuses:
 *   - RECEIVED, UNDER_CLASSIFICATION (Classification queue)
 *   - UNDER_REVIEW (Review queue)
 *   - AWAITING_REVISIONS (Revision queue)
 * 
 * CSV imports typically set submissions to CLOSED (for approved protocols) or
 * WITHDRAWN (for withdrawn ones) because the imported data represents historical
 * completed protocols. These terminal statuses are intentionally excluded from
 * active queues since they require no further action.
 * 
 * To view imported historical data, use this /projects/archived endpoint or
 * the Archives page in the frontend.
 */
router.get("/projects/archived", async (req, res) => {
  try {
    const committeeCode = req.query.committeeCode
      ? String(req.query.committeeCode)
      : null;
    const rawLimit = Number(req.query.limit || 100);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 500)
      : 100;
    const offset = Number(req.query.offset || 0);
    const search = req.query.search ? String(req.query.search).trim() : null;
    const statusFilter = req.query.status ? String(req.query.status).trim() : null;
    const reviewTypeFilter = req.query.reviewType ? String(req.query.reviewType).trim() : null;
    const collegeFilter = req.query.college ? String(req.query.college).trim() : null;

    // Find projects where the latest submission has a terminal status
    const terminalStatuses = statusFilter
      ? [statusFilter]
      : ["CLOSED", "WITHDRAWN"];

    // Build the where clause
    const whereClause: any = {
      submissions: {
        some: {
          status: { in: terminalStatuses },
        },
      },
    };

    if (committeeCode) {
      whereClause.committee = { code: committeeCode };
    }

    if (collegeFilter) {
      whereClause.piAffiliation = { equals: collegeFilter, mode: "insensitive" };
    }

    if (reviewTypeFilter) {
      whereClause.submissions = {
        some: {
          status: { in: terminalStatuses },
          classification: { reviewType: reviewTypeFilter },
        },
      };
    }

    if (search) {
      whereClause.OR = [
        { projectCode: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { piName: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get projects with their latest submission
    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        submissions: {
          orderBy: { sequenceNumber: "desc" },
          take: 1,
          include: {
            classification: {
              select: { reviewType: true },
            },
          },
        },
        committee: {
          select: { code: true, name: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Filter to only include projects where *latest* submission is terminal
    // (not just any submission)
    const archivedProjects = projects.filter((project) => {
      const latestSubmission = project.submissions[0];
      return latestSubmission && terminalStatuses.includes(latestSubmission.status);
    });

    // Get total count for pagination
    const totalCount = await prisma.project.count({
      where: whereClause,
    });

    // Format the response with lightweight payload
    const items = archivedProjects.map((project) => {
      const latestSubmission = project.submissions[0];
      return {
        projectId: project.id,
        projectCode: project.projectCode,
        title: project.title,
        piName: project.piName,
        latestSubmissionId: latestSubmission?.id ?? null,
        latestSubmissionStatus: latestSubmission?.status ?? null,
        receivedDate: latestSubmission?.receivedDate ?? project.initialSubmissionDate,
        reviewType: latestSubmission?.classification?.reviewType ?? null,
        committeeCode: project.committee?.code ?? null,
        overallStatus: project.overallStatus,
      };
    });

    res.json({
      items,
      total: totalCount,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching archived projects:", error);
    res.status(500).json({ message: "Failed to fetch archived projects" });
  }
});

// Get a single project by id
router.get("/projects/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid project id" });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        committee: true,
        createdBy: true,
        submissions: {
          orderBy: { sequenceNumber: "asc" },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ message: "Failed to fetch project" });
  }
});

// Get full project lifecycle (all submissions, classifications, reviews, status history)
router.get("/projects/:id/full", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid project id" });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        committee: true,
        createdBy: true,
        protocolProfile: true,
        protocolMilestones: {
          orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
        },
        changeLog: {
          orderBy: { createdAt: "desc" },
          include: {
            changedBy: true,
          },
        },
        submissions: {
          orderBy: [{ receivedDate: "asc" }, { id: "asc" }],
          include: {
            classification: true,
            reviews: {
              include: {
                reviewer: true,
              },
            },
            statusHistory: {
              orderBy: { effectiveDate: "asc" },
              include: {
                changedBy: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json(project);
  } catch (error) {
    console.error("Error fetching full project:", error);
    res.status(500).json({ message: "Failed to fetch project lifecycle" });
  }
});

router.get("/projects/:id/profile", async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project id" });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        protocolProfile: true,
        protocolMilestones: {
          orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.json({
      profile: project.protocolProfile,
      milestones: project.protocolMilestones,
    });
  } catch (error) {
    console.error("Error fetching protocol profile:", error);
    return res.status(500).json({ message: "Failed to fetch protocol profile" });
  }
});

router.put(
  "/projects/:id/profile",
  requireRoles([RoleType.ADMIN, RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      if (Number.isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project id" });
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const payload = req.body ?? {};

      // Extract audit metadata (not profile fields)
      const changeReason = asNullableString(payload._meta?.changeReason);
      const sourceSubmissionId = payload._meta?.sourceSubmissionId
        ? Number(payload._meta.sourceSubmissionId)
        : null;
      const changedById = req.user?.id ?? null;

      const data = {
        title: asNullableString(payload.title),
        projectLeader: asNullableString(payload.projectLeader),
        college: asNullableString(payload.college),
        department: asNullableString(payload.department),
        dateOfSubmission: asNullableDate(payload.dateOfSubmission),
        monthOfSubmission: asNullableString(payload.monthOfSubmission),
        typeOfReview: asNullableString(payload.typeOfReview),
        proponent: asNullableString(payload.proponent),
        funding: asNullableString(payload.funding),
        typeOfResearchPhreb: asNullableString(payload.typeOfResearchPhreb),
        typeOfResearchPhrebOther: asNullableString(payload.typeOfResearchPhrebOther),
        status: asNullableString(payload.status),
        finishDate: asNullableDate(payload.finishDate),
        monthOfClearance: asNullableString(payload.monthOfClearance),
        reviewDurationDays: asNullableInt(payload.reviewDurationDays),
        remarks: asNullableString(payload.remarks),
        panel: asNullableString(payload.panel),
        scientistReviewer: asNullableString(payload.scientistReviewer),
        layReviewer: asNullableString(payload.layReviewer),
        independentConsultant: asNullableString(payload.independentConsultant),
        honorariumStatus: asNullableString(payload.honorariumStatus),
        classificationOfProposalRerc: asNullableString(payload.classificationOfProposalRerc),
        totalDays: asNullableInt(payload.totalDays),
        submissionCount: asNullableInt(payload.submissionCount),
        withdrawn: asNullableBoolean(payload.withdrawn),
        projectEndDate6A: asNullableDate(payload.projectEndDate6A),
        clearanceExpiration: asNullableDate(payload.clearanceExpiration),
        progressReportTargetDate: asNullableDate(payload.progressReportTargetDate),
        progressReportSubmission: asNullableDate(payload.progressReportSubmission),
        progressReportApprovalDate: asNullableDate(payload.progressReportApprovalDate),
        progressReportStatus: asNullableString(payload.progressReportStatus),
        progressReportDays: asNullableInt(payload.progressReportDays),
        finalReportTargetDate: asNullableDate(payload.finalReportTargetDate),
        finalReportSubmission: asNullableDate(payload.finalReportSubmission),
        finalReportCompletionDate: asNullableDate(payload.finalReportCompletionDate),
        finalReportStatus: asNullableString(payload.finalReportStatus),
        finalReportDays: asNullableInt(payload.finalReportDays),
        amendmentSubmission: asNullableDate(payload.amendmentSubmission),
        amendmentStatusOfRequest: asNullableString(payload.amendmentStatusOfRequest),
        amendmentApprovalDate: asNullableDate(payload.amendmentApprovalDate),
        amendmentDays: asNullableInt(payload.amendmentDays),
        continuingSubmission: asNullableDate(payload.continuingSubmission),
        continuingStatusOfRequest: asNullableString(payload.continuingStatusOfRequest),
        continuingApprovalDate: asNullableDate(payload.continuingApprovalDate),
        continuingDays: asNullableInt(payload.continuingDays),
        primaryReviewer: asNullableString(payload.primaryReviewer),
        finalLayReviewer: asNullableString(payload.finalLayReviewer),
      };

      // Fetch existing profile to diff changes
      const existing = await prisma.protocolProfile.findUnique({
        where: { projectId },
      });

      // Build change log entries by comparing old vs new values
      const changeLogs: Array<{
        projectId: number;
        fieldName: string;
        oldValue: string | null;
        newValue: string | null;
        reason: string | null;
        sourceSubmissionId: number | null;
        changedById: number | null;
      }> = [];

      const serializeValue = (val: unknown): string | null => {
        if (val === null || val === undefined) return null;
        if (val instanceof Date) return val.toISOString();
        return String(val);
      };

      for (const [fieldName, newVal] of Object.entries(data)) {
        const oldRaw = existing ? (existing as Record<string, unknown>)[fieldName] : undefined;
        const oldSerialized = serializeValue(oldRaw);
        const newSerialized = serializeValue(newVal);
        if (oldSerialized !== newSerialized) {
          changeLogs.push({
            projectId,
            fieldName,
            oldValue: oldSerialized,
            newValue: newSerialized,
            reason: changeReason,
            sourceSubmissionId:
              sourceSubmissionId && Number.isFinite(sourceSubmissionId)
                ? sourceSubmissionId
                : null,
            changedById,
          });
        }
      }

      // Atomically upsert the profile and persist change logs
      const profile = await prisma.$transaction(async (tx) => {
        const upserted = await tx.protocolProfile.upsert({
          where: { projectId },
          update: data,
          create: { projectId, ...data },
        });

        if (changeLogs.length > 0) {
          await tx.projectChangeLog.createMany({ data: changeLogs });
        }

        return upserted;
      });

      return res.json(profile);
    } catch (error) {
      console.error("Error upserting protocol profile:", error);
      return res.status(500).json({ message: "Failed to save protocol profile" });
    }
  }
);

router.post(
  "/projects/:id/profile/milestones",
  requireRoles([RoleType.ADMIN, RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      if (Number.isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project id" });
      }

      const label = asNullableString(req.body?.label);
      if (!label) {
        return res.status(400).json({ message: "label is required" });
      }

      const created = await prisma.protocolMilestone.create({
        data: {
          projectId,
          label,
          orderIndex: asNullableInt(req.body?.orderIndex) ?? 0,
          days: asNullableInt(req.body?.days),
          dateOccurred: asNullableDate(req.body?.dateOccurred),
          ownerRole: asNullableString(req.body?.ownerRole),
          notes: asNullableString(req.body?.notes),
        },
      });
      return res.status(201).json(created);
    } catch (error) {
      console.error("Error creating protocol milestone:", error);
      return res.status(500).json({ message: "Failed to create milestone" });
    }
  }
);

router.patch(
  "/projects/:id/profile/milestones/:milestoneId",
  requireRoles([RoleType.ADMIN, RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const milestoneId = Number(req.params.milestoneId);
      if (Number.isNaN(projectId) || Number.isNaN(milestoneId)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const existing = await prisma.protocolMilestone.findUnique({
        where: { id: milestoneId },
        select: { id: true, projectId: true },
      });
      if (!existing || existing.projectId !== projectId) {
        return res.status(404).json({ message: "Milestone not found" });
      }

      const updated = await prisma.protocolMilestone.update({
        where: { id: milestoneId },
        data: {
          label: asNullableString(req.body?.label) ?? undefined,
          orderIndex: asNullableInt(req.body?.orderIndex) ?? undefined,
          days: req.body?.days === undefined ? undefined : asNullableInt(req.body?.days),
          dateOccurred:
            req.body?.dateOccurred === undefined
              ? undefined
              : asNullableDate(req.body?.dateOccurred),
          ownerRole:
            req.body?.ownerRole === undefined
              ? undefined
              : asNullableString(req.body?.ownerRole),
          notes:
            req.body?.notes === undefined
              ? undefined
              : asNullableString(req.body?.notes),
        },
      });

      return res.json(updated);
    } catch (error) {
      console.error("Error updating protocol milestone:", error);
      return res.status(500).json({ message: "Failed to update milestone" });
    }
  }
);

router.delete(
  "/projects/:id/profile/milestones/:milestoneId",
  requireRoles([RoleType.ADMIN, RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const milestoneId = Number(req.params.milestoneId);
      if (Number.isNaN(projectId) || Number.isNaN(milestoneId)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const existing = await prisma.protocolMilestone.findUnique({
        where: { id: milestoneId },
        select: { id: true, projectId: true },
      });
      if (!existing || existing.projectId !== projectId) {
        return res.status(404).json({ message: "Milestone not found" });
      }

      await prisma.protocolMilestone.delete({
        where: { id: milestoneId },
      });
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting protocol milestone:", error);
      return res.status(500).json({ message: "Failed to delete milestone" });
    }
  }
);

// Create a submission for a project (initial, amendment, etc.)
router.post("/projects/:projectId/submissions", async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid projectId" });
    }

    const {
      submissionType, // e.g. "INITIAL", "AMENDMENT", ...
      receivedDate, // ISO string
      documentLink, // optional string
      completenessStatus, // e.g. "COMPLETE", "MINOR_MISSING", ...
      completenessRemarks, // optional string
    } = req.body;

    // Basic required fields
    if (!submissionType || !receivedDate) {
      return res.status(400).json({
        message: "submissionType and receivedDate are required",
      });
    }

    const allowedSubmissionTypes = [
      "INITIAL",
      "AMENDMENT",
      "CONTINUING_REVIEW",
      "FINAL_REPORT",
      "WITHDRAWAL",
      "SAFETY_REPORT",
      "PROTOCOL_DEVIATION",
    ];
    if (!allowedSubmissionTypes.includes(submissionType)) {
      return res.status(400).json({
        message: `Invalid submissionType. Allowed: ${allowedSubmissionTypes.join(
          ", "
        )}`,
      });
    }

    const allowedCompleteness = [
      "COMPLETE",
      "MINOR_MISSING",
      "MAJOR_MISSING",
      "MISSING_SIGNATURES",
      "OTHER",
    ];
    if (
      completenessStatus &&
      !allowedCompleteness.includes(completenessStatus)
    ) {
      return res.status(400).json({
        message: `Invalid completenessStatus. Allowed: ${allowedCompleteness.join(
          ", "
        )}`,
      });
    }

    const receivedAt = new Date(receivedDate);

    const submission = await prisma.$transaction(async (tx) => {
      const lastSubmission = await tx.submission.findFirst({
        where: { projectId },
        orderBy: { sequenceNumber: "desc" },
        select: { sequenceNumber: true },
      });
      const sequenceNumber = (lastSubmission?.sequenceNumber ?? 0) + 1;

      return tx.submission.create({
        data: {
          projectId,
          submissionType,
          sequenceNumber,
          receivedDate: receivedAt,
          documentLink,
          completenessStatus: completenessStatus || "COMPLETE",
          completenessRemarks,
          createdById: req.user?.id,
        },
      });
    });

    res.status(201).json(submission);
  } catch (error) {
    console.error("Error creating submission:", error);
    res.status(500).json({ message: "Failed to create submission" });
  }
});

export default router;
