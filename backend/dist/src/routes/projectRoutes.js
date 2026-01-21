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
const router = (0, express_1.Router)();
// Create a new project (RA / Chair encoding a protocol)
router.post("/projects", async (req, res) => {
    try {
        const { projectCode, title, piName, piAffiliation, fundingType, committeeId, initialSubmissionDate, } = req.body;
        // Basic required field checks
        if (!projectCode || !title || !piName || !fundingType || !committeeId) {
            return res.status(400).json({
                message: "projectCode, title, piName, fundingType, and committeeId are required",
            });
        }
        // Very light fundingType validation – ties to Prisma enum FundingType
        const allowedFundingTypes = [
            "INTERNAL",
            "EXTERNAL",
            "SELF_FUNDED",
            "NO_FUNDING",
        ];
        if (!allowedFundingTypes.includes(fundingType)) {
            return res.status(400).json({
                message: `Invalid fundingType. Allowed: ${allowedFundingTypes.join(", ")}`,
            });
        }
        // Parse date if provided
        const initialDate = initialSubmissionDate
            ? new Date(initialSubmissionDate)
            : null;
        const project = await prismaClient_1.default.project.create({
            data: {
                projectCode,
                title,
                piName,
                piAffiliation,
                fundingType, // Prisma will enforce the enum
                committeeId,
                initialSubmissionDate: initialDate,
                // TODO: replace with real logged-in user later
                createdById: 1, // RA user from seed
            },
        });
        res.status(201).json(project);
    }
    catch (error) {
        console.error("Error creating project:", error);
        // Unique constraint on projectCode
        if (error.code === "P2002") {
            return res.status(409).json({
                message: "Project code already exists",
            });
        }
        res.status(500).json({ message: "Failed to create project" });
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
        // Compute next sequenceNumber for this project
        const existingCount = await prismaClient_1.default.submission.count({
            where: { projectId },
        });
        const sequenceNumber = existingCount + 1;
        const submission = await prismaClient_1.default.submission.create({
            data: {
                projectId,
                submissionType,
                sequenceNumber,
                receivedDate: receivedAt,
                documentLink,
                completenessStatus: completenessStatus || "COMPLETE",
                completenessRemarks,
                createdById: 1, // RA for now - later: logged-in user
            },
        });
        res.status(201).json(submission);
    }
    catch (error) {
        console.error("Error creating submission:", error);
        res.status(500).json({ message: "Failed to create submission" });
    }
});
exports.default = router;
