"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Project routes
 */
const express_1 = require("express");
const prismaClient_1 = __importDefault(require("../config/prismaClient"));
const client_1 = require("../generated/prisma/client");
const auth_1 = require("../middleware/auth");
const createProjectWithInitialSubmission_1 = require("../services/projects/createProjectWithInitialSubmission");
const router = (0, express_1.Router)();
// Create project + initial submission via individual entry form
router.post("/projects", (0, auth_1.requireRoles)([client_1.RoleType.ADMIN, client_1.RoleType.CHAIR, client_1.RoleType.RESEARCH_ASSOCIATE]), async (req, res) => {
    try {
        const { projectCode, title, piName, fundingType, committeeCode, submissionType, receivedDate, notes, collegeOrUnit, proponentCategory, } = req.body;
        const created = await (0, createProjectWithInitialSubmission_1.createProjectWithInitialSubmission)({
            projectCode,
            title,
            piName,
            committeeCode,
            submissionType,
            receivedDate,
            fundingType,
            notes,
            collegeOrUnit,
            proponentCategory,
        }, req.user?.id);
        return res.status(201).json(created);
    }
    catch (error) {
        if (error instanceof createProjectWithInitialSubmission_1.ProjectCreateValidationError) {
            return res.status(400).json({
                message: "Validation failed.",
                errors: error.errors,
            });
        }
        if (error instanceof createProjectWithInitialSubmission_1.DuplicateProjectCodeError) {
            return res.status(409).json({
                message: "Project code already exists.",
                projectId: error.projectId,
            });
        }
        if (error?.code === "P2002") {
            const normalizedCode = String(req.body?.projectCode ?? "").trim().toUpperCase();
            const existingProject = normalizedCode
                ? await prismaClient_1.default.project.findFirst({
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
});
// List all projects (with basic metadata)
router.get("/projects", async (_req, res) => {
    try {
        const projects = await prismaClient_1.default.project.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                committee: true, // which committee handles it
                createdBy: true, // which user encoded it
            },
        });
        res.json(projects);
    }
    catch (error) {
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
        const titleHistory = await prismaClient_1.default.projectChangeLog.findMany({
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
        const projects = await prismaClient_1.default.project.findMany({
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
    }
    catch (error) {
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
        // Find projects where the latest submission has a terminal status
        const terminalStatuses = ["CLOSED", "WITHDRAWN"];
        // Build the where clause
        const whereClause = {
            submissions: {
                some: {
                    status: { in: terminalStatuses },
                },
            },
        };
        if (committeeCode) {
            whereClause.committee = { code: committeeCode };
        }
        if (search) {
            whereClause.OR = [
                { projectCode: { contains: search, mode: "insensitive" } },
                { title: { contains: search, mode: "insensitive" } },
                { piName: { contains: search, mode: "insensitive" } },
            ];
        }
        // Get projects with their latest submission
        const projects = await prismaClient_1.default.project.findMany({
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
        const totalCount = await prismaClient_1.default.project.count({
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
    }
    catch (error) {
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
        const project = await prismaClient_1.default.project.findUnique({
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
    }
    catch (error) {
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
        const project = await prismaClient_1.default.project.findUnique({
            where: { id },
            include: {
                committee: true,
                createdBy: true,
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
    }
    catch (error) {
        console.error("Error fetching full project:", error);
        res.status(500).json({ message: "Failed to fetch project lifecycle" });
    }
});
// Create a submission for a project (initial, amendment, etc.)
router.post("/projects/:projectId/submissions", async (req, res) => {
    try {
        const projectId = Number(req.params.projectId);
        if (Number.isNaN(projectId)) {
            return res.status(400).json({ message: "Invalid projectId" });
        }
        const { submissionType, // e.g. "INITIAL", "AMENDMENT", ...
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
                message: `Invalid submissionType. Allowed: ${allowedSubmissionTypes.join(", ")}`,
            });
        }
        const allowedCompleteness = [
            "COMPLETE",
            "MINOR_MISSING",
            "MAJOR_MISSING",
            "MISSING_SIGNATURES",
            "OTHER",
        ];
        if (completenessStatus &&
            !allowedCompleteness.includes(completenessStatus)) {
            return res.status(400).json({
                message: `Invalid completenessStatus. Allowed: ${allowedCompleteness.join(", ")}`,
            });
        }
        const receivedAt = new Date(receivedDate);
        const submission = await prismaClient_1.default.$transaction(async (tx) => {
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
    }
    catch (error) {
        console.error("Error creating submission:", error);
        res.status(500).json({ message: "Failed to create submission" });
    }
});
exports.default = router;
