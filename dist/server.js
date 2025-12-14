"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
require("dotenv/config");
const prisma_1 = __importDefault(require("./prisma"));
const slaUtils_1 = require("./slaUtils");
const client_1 = require("./generated/prisma/client");
const letters_1 = require("./letters");
function csvEscape(value) {
    if (value === null || value === undefined) {
        return "";
    }
    let str;
    if (value instanceof Date) {
        str = value.toISOString().slice(0, 10);
    }
    else {
        str = String(value);
    }
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, "../public")));
// Root route – just to check server status
app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "RERC API skeleton running" });
});
// DB health route – checks Prisma/Postgres connection
app.get("/health", async (_req, res) => {
    try {
        const userCount = await prisma_1.default.user.count();
        res.json({
            status: "ok",
            db: "connected",
            userCount,
        });
    }
    catch (error) {
        console.error("DB healthcheck failed:", error);
        res.status(500).json({
            status: "error",
            db: "unreachable",
        });
    }
});
// List committees with panels and members (including user info)
app.get("/committees", async (_req, res) => {
    try {
        const committees = await prisma_1.default.committee.findMany({
            include: {
                panels: true,
                members: {
                    include: {
                        user: true,
                    },
                },
            },
        });
        res.json(committees);
    }
    catch (error) {
        console.error("Error fetching committees:", error);
        res.status(500).json({ message: "Failed to fetch committees" });
    }
});
// Get a panel with its members
app.get("/panels/:id/members", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ message: "Invalid panel id" });
        }
        const panel = await prisma_1.default.panel.findUnique({
            where: { id },
            include: {
                committee: true,
                members: {
                    include: {
                        user: true,
                    },
                },
            },
        });
        if (!panel) {
            return res.status(404).json({ message: "Panel not found" });
        }
        res.json({
            id: panel.id,
            name: panel.name,
            code: panel.code,
            committee: {
                id: panel.committee.id,
                code: panel.committee.code,
                name: panel.committee.name,
            },
            members: panel.members.map((member) => ({
                id: member.id,
                role: member.role,
                isActive: member.isActive,
                createdAt: member.createdAt,
                user: {
                    id: member.user.id,
                    fullName: member.user.fullName,
                    email: member.user.email,
                    isActive: member.user.isActive,
                },
            })),
        });
    }
    catch (error) {
        console.error("Error fetching panel members:", error);
        res.status(500).json({ message: "Failed to fetch panel members" });
    }
});
// Get all panels for a committee including members
app.get("/committees/:code/panels", async (req, res) => {
    try {
        const committee = await prisma_1.default.committee.findUnique({
            where: { code: req.params.code },
            include: {
                panels: {
                    include: {
                        members: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
            },
        });
        if (!committee) {
            return res.status(404).json({ message: "Committee not found" });
        }
        res.json({
            id: committee.id,
            code: committee.code,
            name: committee.name,
            panels: committee.panels.map((panel) => ({
                id: panel.id,
                name: panel.name,
                code: panel.code,
                isActive: panel.isActive,
                members: panel.members.map((member) => ({
                    id: member.id,
                    role: member.role,
                    isActive: member.isActive,
                    user: {
                        id: member.user.id,
                        fullName: member.user.fullName,
                        email: member.user.email,
                        isActive: member.user.isActive,
                    },
                })),
            })),
        });
    }
    catch (error) {
        console.error("Error fetching committee panels:", error);
        res.status(500).json({ message: "Failed to fetch committee panels" });
    }
});
// Dashboard queues for classification, review, revision
app.get("/dashboard/queues", async (req, res) => {
    try {
        const committeeCode = String(req.query.committeeCode || "RERC-HUMAN");
        const classificationQueue = await prisma_1.default.submission.findMany({
            where: {
                status: { in: ["RECEIVED", "UNDER_CLASSIFICATION"] },
                project: {
                    committee: {
                        code: committeeCode,
                    },
                },
            },
            include: {
                project: true,
                classification: true,
            },
            orderBy: {
                receivedDate: "asc",
            },
        });
        const reviewQueue = await prisma_1.default.submission.findMany({
            where: {
                status: "UNDER_REVIEW",
                project: {
                    committee: {
                        code: committeeCode,
                    },
                },
            },
            include: {
                project: true,
                classification: true,
            },
            orderBy: {
                receivedDate: "asc",
            },
        });
        const revisionQueue = await prisma_1.default.submission.findMany({
            where: {
                status: "AWAITING_REVISIONS",
                project: {
                    committee: {
                        code: committeeCode,
                    },
                },
            },
            include: {
                project: true,
                classification: true,
            },
            orderBy: {
                receivedDate: "asc",
            },
        });
        res.json({
            committeeCode,
            counts: {
                classification: classificationQueue.length,
                review: reviewQueue.length,
                revision: revisionQueue.length,
            },
            classificationQueue,
            reviewQueue,
            revisionQueue,
        });
    }
    catch (error) {
        console.error("Error generating dashboard queues:", error);
        res.status(500).json({ message: "Failed to load dashboard queues" });
    }
});
// Mail-merge CSV export for initial submission acknowledgment letters
app.get("/mail-merge/initial-ack.csv", async (req, res) => {
    try {
        const committeeCode = req.query.committeeCode
            ? String(req.query.committeeCode)
            : "RERC-HUMAN";
        const fromParam = req.query.from;
        const toParam = req.query.to;
        const letterDateParam = req.query.letterDate;
        let fromDate;
        let toDate;
        let letterDate = new Date();
        if (fromParam) {
            const parsed = new Date(fromParam);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ message: "Invalid from date" });
            }
            fromDate = parsed;
        }
        if (toParam) {
            const parsed = new Date(toParam);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ message: "Invalid to date" });
            }
            toDate = parsed;
        }
        if (letterDateParam) {
            const parsed = new Date(letterDateParam);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ message: "Invalid letterDate" });
            }
            letterDate = parsed;
        }
        const where = {
            submissionType: "INITIAL",
            project: {
                committee: {
                    code: committeeCode,
                },
            },
        };
        if (fromDate || toDate) {
            where.receivedDate = {};
            if (fromDate) {
                where.receivedDate.gte = fromDate;
            }
            if (toDate) {
                where.receivedDate.lte = toDate;
            }
        }
        const submissions = await prisma_1.default.submission.findMany({
            where,
            include: {
                project: {
                    include: {
                        committee: true,
                    },
                },
                classification: true,
                createdBy: true,
            },
            orderBy: {
                receivedDate: "asc",
            },
        });
        const headers = [
            "project_code",
            "project_title",
            "pi_name",
            "pi_affiliation",
            "committee_code",
            "committee_name",
            "submission_type",
            "review_type",
            "received_date",
            "classification_date",
            "letter_date",
            "ra_full_name",
            "ra_email",
        ];
        const rows = [headers.join(",")];
        for (const submission of submissions) {
            const project = submission.project;
            const committee = project.committee;
            const classification = submission.classification;
            const ra = submission.createdBy;
            rows.push([
                csvEscape(project.projectCode),
                csvEscape(project.title),
                csvEscape(project.piName),
                csvEscape(project.piAffiliation),
                csvEscape(committee?.code ?? ""),
                csvEscape(committee?.name ?? ""),
                csvEscape(submission.submissionType),
                csvEscape(classification?.reviewType ?? ""),
                csvEscape(submission.receivedDate),
                csvEscape(classification?.classificationDate ?? ""),
                csvEscape(letterDate),
                csvEscape(ra?.fullName ?? ""),
                csvEscape(ra?.email ?? ""),
            ].join(","));
        }
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="initial_ack_mail_merge.csv"');
        res.send(rows.join("\r\n"));
    }
    catch (error) {
        console.error("Error generating mail merge CSV:", error);
        res.status(500).json({ message: "Failed to generate CSV" });
    }
});
// Mail-merge CSV export for initial approval letters
app.get("/mail-merge/initial-approval.csv", async (req, res) => {
    try {
        const committeeCode = req.query.committeeCode
            ? String(req.query.committeeCode)
            : "RERC-HUMAN";
        const fromParam = req.query.from;
        const toParam = req.query.to;
        const letterDateParam = req.query.letterDate;
        let fromDate;
        let toDate;
        let letterDate = new Date();
        if (fromParam) {
            const parsed = new Date(fromParam);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ message: "Invalid from date" });
            }
            fromDate = parsed;
        }
        if (toParam) {
            const parsed = new Date(toParam);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ message: "Invalid to date" });
            }
            toDate = parsed;
        }
        if (letterDateParam) {
            const parsed = new Date(letterDateParam);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ message: "Invalid letterDate" });
            }
            letterDate = parsed;
        }
        const where = {
            submissionType: "INITIAL",
            finalDecision: "APPROVED",
            project: {
                committee: {
                    code: committeeCode,
                },
            },
        };
        if (fromDate || toDate) {
            where.finalDecisionDate = {};
            if (fromDate) {
                where.finalDecisionDate.gte = fromDate;
            }
            if (toDate) {
                where.finalDecisionDate.lte = toDate;
            }
        }
        const submissions = await prisma_1.default.submission.findMany({
            where,
            include: {
                project: {
                    include: {
                        committee: true,
                    },
                },
                classification: true,
                createdBy: true,
            },
            orderBy: {
                finalDecisionDate: "asc",
            },
        });
        const headers = [
            "project_code",
            "project_title",
            "pi_name",
            "pi_affiliation",
            "committee_code",
            "committee_name",
            "submission_type",
            "review_type",
            "final_decision",
            "final_decision_date",
            "approval_start_date",
            "approval_end_date",
            "letter_date",
            "ra_full_name",
            "ra_email",
        ];
        const rows = [headers.join(",")];
        for (const submission of submissions) {
            const project = submission.project;
            const committee = project.committee;
            const classification = submission.classification;
            const ra = submission.createdBy;
            rows.push([
                csvEscape(project.projectCode),
                csvEscape(project.title),
                csvEscape(project.piName),
                csvEscape(project.piAffiliation),
                csvEscape(committee?.code ?? ""),
                csvEscape(committee?.name ?? ""),
                csvEscape(submission.submissionType),
                csvEscape(classification?.reviewType ?? ""),
                csvEscape(submission.finalDecision ?? ""),
                csvEscape(submission.finalDecisionDate ?? ""),
                csvEscape(project.approvalStartDate ?? ""),
                csvEscape(project.approvalEndDate ?? ""),
                csvEscape(letterDate),
                csvEscape(ra?.fullName ?? ""),
                csvEscape(ra?.email ?? ""),
            ].join(","));
        }
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="initial_approval_mail_merge.csv"');
        res.send(rows.join("\r\n"));
    }
    catch (error) {
        console.error("Error generating approval mail merge CSV:", error);
        res.status(500).json({ message: "Failed to generate approval CSV" });
    }
});
// Mail merge payload for a single submission's initial acknowledgement letter
app.get("/mail-merge/initial-ack/:submissionId", async (req, res) => {
    try {
        const submissionId = Number(req.params.submissionId);
        if (Number.isNaN(submissionId)) {
            return res.status(400).json({ message: "Invalid submission id" });
        }
        const submission = await prisma_1.default.submission.findUnique({
            where: { id: submissionId },
            include: {
                project: {
                    include: {
                        committee: true,
                        createdBy: true,
                    },
                },
                classification: true,
            },
        });
        if (!submission || !submission.project || !submission.project.committee) {
            return res.status(404).json({ message: "Submission not found" });
        }
        const project = submission.project;
        const committee = project.committee;
        const classification = submission.classification;
        const letterDate = submission.receivedDate ?? new Date();
        res.json({
            project_code: project.projectCode,
            project_title: project.title,
            pi_name: project.piName,
            pi_affiliation: project.piAffiliation,
            committee_code: committee.code,
            committee_name: committee.name,
            submission_type: submission.submissionType,
            review_type: classification?.reviewType ?? null,
            received_date: submission.receivedDate,
            classification_date: classification?.classificationDate ?? null,
            letter_date: letterDate.toISOString().slice(0, 10),
            ra_full_name: project.createdBy?.fullName ?? null,
            ra_email: project.createdBy?.email ?? null,
        });
    }
    catch (error) {
        console.error("Error building initial ack payload:", error);
        res.status(500).json({ message: "Failed to build initial ack payload" });
    }
});
// Mail merge payload for a single submission's initial approval letter
app.get("/mail-merge/initial-approval/:submissionId", async (req, res) => {
    try {
        const submissionId = Number(req.params.submissionId);
        if (Number.isNaN(submissionId)) {
            return res.status(400).json({ message: "Invalid submission id" });
        }
        const submission = await prisma_1.default.submission.findUnique({
            where: { id: submissionId },
            include: {
                project: {
                    include: {
                        committee: true,
                        createdBy: true,
                    },
                },
                classification: true,
            },
        });
        if (!submission || !submission.project || !submission.project.committee) {
            return res.status(404).json({ message: "Submission not found" });
        }
        const project = submission.project;
        const committee = project.committee;
        const classification = submission.classification;
        const letterDate = submission.finalDecisionDate ??
            project.approvalStartDate ??
            new Date();
        res.json({
            project_code: project.projectCode,
            project_title: project.title,
            pi_name: project.piName,
            pi_affiliation: project.piAffiliation,
            committee_code: committee.code,
            committee_name: committee.name,
            submission_type: submission.submissionType,
            review_type: classification?.reviewType ?? null,
            final_decision: submission.finalDecision,
            final_decision_date: submission.finalDecisionDate,
            approval_start_date: project.approvalStartDate,
            approval_end_date: project.approvalEndDate,
            letter_date: letterDate.toISOString().slice(0, 10),
            ra_full_name: project.createdBy?.fullName ?? null,
            ra_email: project.createdBy?.email ?? null,
        });
    }
    catch (error) {
        console.error("Error building initial approval payload:", error);
        res.status(500).json({ message: "Failed to build initial approval payload" });
    }
});
app.get("/letters/initial-ack/:submissionId.docx", async (req, res) => {
    try {
        const submissionId = Number(req.params.submissionId);
        if (Number.isNaN(submissionId)) {
            return res.status(400).json({ message: "Invalid submission id" });
        }
        const buffer = await (0, letters_1.buildInitialAckLetter)(submissionId);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename=initial_ack_${submissionId}.docx`);
        res.send(buffer);
    }
    catch (error) {
        console.error("Error generating initial ack letter:", error);
        res.status(500).json({ message: "Failed to generate letter" });
    }
});
app.get("/letters/initial-approval/:submissionId.docx", async (req, res) => {
    try {
        const submissionId = Number(req.params.submissionId);
        if (Number.isNaN(submissionId)) {
            return res.status(400).json({ message: "Invalid submission id" });
        }
        const buffer = await (0, letters_1.buildInitialApprovalLetter)(submissionId);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename=initial_approval_${submissionId}.docx`);
        res.send(buffer);
    }
    catch (error) {
        console.error("Error generating initial approval letter:", error);
        res.status(500).json({ message: "Failed to generate letter" });
    }
});
// Get SLA configuration (optionally filter by committee, reviewType, or stage)
app.get("/config/sla", async (req, res) => {
    try {
        const { committeeCode, reviewType, stage } = req.query;
        const where = {};
        if (committeeCode) {
            where.committee = { code: String(committeeCode) };
        }
        if (reviewType) {
            where.reviewType = String(reviewType);
        }
        if (stage) {
            where.stage = String(stage);
        }
        const slas = await prisma_1.default.configSLA.findMany({
            where,
            include: {
                committee: true,
            },
            orderBy: [
                { committeeId: "asc" },
                { stage: "asc" },
                { reviewType: "asc" },
            ],
        });
        res.json(slas);
    }
    catch (error) {
        console.error("Error fetching ConfigSLA:", error);
        res.status(500).json({ message: "Failed to fetch SLA config" });
    }
});
// Create a new project (RA / Chair encoding a protocol)
app.post("/projects", async (req, res) => {
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
        const project = await prisma_1.default.project.create({
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
app.get("/projects", async (_req, res) => {
    try {
        const projects = await prisma_1.default.project.findMany({
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
// Get a single project by id
app.get("/projects/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ message: "Invalid project id" });
        }
        const project = await prisma_1.default.project.findUnique({
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
app.get("/projects/:id/full", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ message: "Invalid project id" });
        }
        const project = await prisma_1.default.project.findUnique({
            where: { id },
            include: {
                committee: true,
                createdBy: true,
                submissions: {
                    orderBy: [
                        { receivedDate: "asc" },
                        { id: "asc" },
                    ],
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
app.post("/projects/:projectId/submissions", async (req, res) => {
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
        const existingCount = await prisma_1.default.submission.count({
            where: { projectId },
        });
        const sequenceNumber = existingCount + 1;
        const submission = await prisma_1.default.submission.create({
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
// Classify a submission (EXEMPT / EXPEDITED / FULL_BOARD)
app.post("/submissions/:submissionId/classifications", async (req, res) => {
    try {
        const submissionId = Number(req.params.submissionId);
        if (Number.isNaN(submissionId)) {
            return res.status(400).json({ message: "Invalid submissionId" });
        }
        const { reviewType, classificationDate, panelId, rationale } = req.body;
        if (!reviewType || !classificationDate) {
            return res.status(400).json({
                message: "reviewType and classificationDate are required",
            });
        }
        const allowedReviewTypes = ["EXEMPT", "EXPEDITED", "FULL_BOARD"];
        if (!allowedReviewTypes.includes(reviewType)) {
            return res.status(400).json({
                message: `Invalid reviewType. Allowed: ${allowedReviewTypes.join(", ")}`,
            });
        }
        const classifiedAt = new Date(classificationDate);
        // Optional: verify the submission exists
        const submission = await prisma_1.default.submission.findUnique({
            where: { id: submissionId },
        });
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }
        // For FULL_BOARD, panelId should be provided; for EXEMPT/EXPEDITED, it's optional
        const classification = await prisma_1.default.classification.upsert({
            where: { submissionId }, // there should be max 1 per submission
            update: {
                reviewType,
                classificationDate: classifiedAt,
                panelId: panelId ?? null,
                rationale,
                classifiedById: 1, // RA/Chair for now
            },
            create: {
                submissionId,
                reviewType,
                classificationDate: classifiedAt,
                panelId: panelId ?? null,
                rationale,
                classifiedById: 1,
            },
        });
        res.status(201).json(classification);
    }
    catch (error) {
        console.error("Error classifying submission:", error);
        res.status(500).json({ message: "Failed to classify submission" });
    }
});
// Get a submission with its classification
app.get("/submissions/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ message: "Invalid submission id" });
        }
        const submission = await prisma_1.default.submission.findUnique({
            where: { id },
            include: {
                project: true,
                classification: {
                    include: {
                        panel: true,
                        classifiedBy: true,
                    },
                },
                reviews: {
                    include: {
                        reviewer: true,
                    },
                    orderBy: { assignedAt: "asc" },
                },
                statusHistory: {
                    include: {
                        changedBy: true,
                    },
                    orderBy: { effectiveDate: "asc" },
                },
            },
        });
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }
        res.json(submission);
    }
    catch (error) {
        console.error("Error fetching submission:", error);
        res.status(500).json({ message: "Failed to fetch submission" });
    }
});
// Change submission status and log history
app.patch("/submissions/:id/status", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ message: "Invalid submission id" });
        }
        const { newStatus, reason } = req.body;
        const allowedStatuses = [
            "RECEIVED",
            "UNDER_COMPLETENESS_CHECK",
            "AWAITING_CLASSIFICATION",
            "UNDER_CLASSIFICATION",
            "CLASSIFIED",
            "UNDER_REVIEW",
            "AWAITING_REVISIONS",
            "REVISION_SUBMITTED",
            "CLOSED",
            "WITHDRAWN",
        ];
        if (!newStatus || !allowedStatuses.includes(newStatus)) {
            return res.status(400).json({
                message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
            });
        }
        const submission = await prisma_1.default.submission.findUnique({
            where: { id },
            select: {
                status: true,
            },
        });
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }
        const changedById = 1; // TODO: replace with authenticated user later
        const [history, updated] = await prisma_1.default.$transaction([
            prisma_1.default.submissionStatusHistory.create({
                data: {
                    submissionId: id,
                    oldStatus: submission.status,
                    newStatus,
                    reason,
                    changedById,
                },
            }),
            prisma_1.default.submission.update({
                where: { id },
                data: { status: newStatus },
            }),
        ]);
        res.json({ submission: updated, history });
    }
    catch (error) {
        console.error("Error updating submission status:", error);
        res.status(500).json({ message: "Failed to update submission status" });
    }
});
// Assign a reviewer to a submission
app.post("/submissions/:submissionId/reviews", async (req, res) => {
    try {
        const submissionId = Number(req.params.submissionId);
        if (Number.isNaN(submissionId)) {
            return res.status(400).json({ message: "Invalid submissionId" });
        }
        const reviewerId = Number(req.body.reviewerId);
        if (Number.isNaN(reviewerId)) {
            return res.status(400).json({ message: "Invalid reviewerId" });
        }
        const isPrimary = Boolean(req.body.isPrimary);
        const submission = await prisma_1.default.submission.findUnique({
            where: { id: submissionId },
        });
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }
        const reviewer = await prisma_1.default.user.findUnique({
            where: { id: reviewerId },
        });
        if (!reviewer) {
            return res.status(404).json({ message: "Reviewer not found" });
        }
        const review = await prisma_1.default.review.create({
            data: {
                submissionId,
                reviewerId,
                isPrimary,
            },
        });
        res.status(201).json(review);
    }
    catch (error) {
        console.error("Error assigning reviewer:", error);
        res.status(500).json({ message: "Failed to assign reviewer" });
    }
});
// Record a decision for a review
app.post("/reviews/:reviewId/decision", async (req, res) => {
    try {
        const reviewId = Number(req.params.reviewId);
        if (Number.isNaN(reviewId)) {
            return res.status(400).json({ message: "Invalid reviewId" });
        }
        const { decision, remarks } = req.body;
        if (!decision) {
            return res.status(400).json({ message: "decision is required" });
        }
        const allowedDecisions = [
            "APPROVED",
            "MINOR_REVISIONS",
            "MAJOR_REVISIONS",
            "DISAPPROVED",
            "INFO_ONLY",
        ];
        if (!allowedDecisions.includes(decision)) {
            return res.status(400).json({
                message: `Invalid decision. Allowed: ${allowedDecisions.join(", ")}`,
            });
        }
        const existingReview = await prisma_1.default.review.findUnique({
            where: { id: reviewId },
        });
        if (!existingReview) {
            return res.status(404).json({ message: "Review not found" });
        }
        const updatedReview = await prisma_1.default.review.update({
            where: { id: reviewId },
            data: {
                decision,
                remarks,
                respondedAt: new Date(),
            },
        });
        res.json(updatedReview);
    }
    catch (error) {
        console.error("Error recording review decision:", error);
        res.status(500).json({ message: "Failed to record decision" });
    }
});
// Record final decision for a submission and update project approvals
app.post("/submissions/:id/final-decision", async (req, res) => {
    try {
        const submissionId = Number(req.params.id);
        if (Number.isNaN(submissionId)) {
            return res.status(400).json({ message: "Invalid submission id" });
        }
        const { finalDecision, finalDecisionDate, approvalStartDate, approvalEndDate, } = req.body;
        if (!finalDecision) {
            return res.status(400).json({ message: "finalDecision is required" });
        }
        const allowedDecisions = [
            "APPROVED",
            "MINOR_REVISIONS",
            "MAJOR_REVISIONS",
            "DISAPPROVED",
            "WITHDRAWN",
        ];
        if (!allowedDecisions.includes(finalDecision)) {
            return res.status(400).json({
                message: `Invalid finalDecision. Allowed: ${allowedDecisions.join(", ")}`,
            });
        }
        let decisionDate = finalDecisionDate ? new Date(finalDecisionDate) : new Date();
        if (Number.isNaN(decisionDate.getTime())) {
            return res.status(400).json({ message: "Invalid finalDecisionDate" });
        }
        let approvalStart = approvalStartDate ? new Date(approvalStartDate) : null;
        if (approvalStart && Number.isNaN(approvalStart.getTime())) {
            return res.status(400).json({ message: "Invalid approvalStartDate" });
        }
        let approvalEnd = approvalEndDate ? new Date(approvalEndDate) : null;
        if (approvalEnd && Number.isNaN(approvalEnd.getTime())) {
            return res.status(400).json({ message: "Invalid approvalEndDate" });
        }
        const submission = await prisma_1.default.submission.update({
            where: { id: submissionId },
            data: {
                finalDecision,
                finalDecisionDate: decisionDate,
                project: approvalStart || approvalEnd
                    ? {
                        update: {
                            approvalStartDate: approvalStart ?? undefined,
                            approvalEndDate: approvalEnd ?? undefined,
                        },
                    }
                    : undefined,
            },
            include: {
                project: true,
            },
        });
        res.json(submission);
    }
    catch (error) {
        console.error("Error recording final decision:", error);
        res.status(500).json({ message: "Failed to record final decision" });
    }
});
// Summarize SLA compliance for a submission (currently classification SLA)
app.get("/submissions/:id/sla-summary", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ message: "Invalid submission id" });
        }
        const submission = await prisma_1.default.submission.findUnique({
            where: { id },
            include: {
                project: {
                    include: { committee: true },
                },
                classification: true,
                statusHistory: {
                    orderBy: { effectiveDate: "asc" },
                },
                reviews: true,
            },
        });
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }
        if (!submission.project?.committee) {
            return res.status(400).json({ message: "Submission has no committee" });
        }
        if (!submission.classification) {
            return res
                .status(400)
                .json({ message: "Submission has not been classified yet" });
        }
        const committeeId = submission.project.committeeId;
        const reviewType = submission.classification.reviewType; // EXEMPT / EXPEDITED / FULL_BOARD
        const classificationSlaConfig = await prisma_1.default.configSLA.findFirst({
            where: {
                committeeId,
                stage: "CLASSIFICATION",
                reviewType,
                isActive: true,
            },
        });
        const classificationStartHistory = submission.statusHistory.find((history) => history.newStatus === client_1.SubmissionStatus.UNDER_CLASSIFICATION);
        const classificationStart = classificationStartHistory?.effectiveDate ?? submission.receivedDate;
        const classificationEnd = submission.classification.classificationDate ?? new Date();
        const classificationActual = (0, slaUtils_1.workingDaysBetween)(new Date(classificationStart), new Date(classificationEnd));
        const classificationConfigured = classificationSlaConfig?.workingDays ?? null;
        const classificationWithin = classificationConfigured === null
            ? null
            : classificationActual <= classificationConfigured;
        const reviewSlaConfig = await prisma_1.default.configSLA.findFirst({
            where: {
                committeeId,
                stage: "REVIEW",
                reviewType,
                isActive: true,
            },
        });
        const reviewStartHistory = submission.statusHistory.find((history) => history.newStatus === client_1.SubmissionStatus.UNDER_REVIEW);
        const reviewStart = reviewStartHistory?.effectiveDate ?? null;
        const reviewEndHistory = submission.statusHistory.find((history) => {
            const status = history.newStatus;
            if (!status) {
                return false;
            }
            return (status === client_1.SubmissionStatus.AWAITING_REVISIONS ||
                status === client_1.SubmissionStatus.REVISION_SUBMITTED ||
                status === client_1.SubmissionStatus.CLOSED ||
                status === client_1.SubmissionStatus.WITHDRAWN);
        });
        const reviewEnd = reviewEndHistory?.effectiveDate ?? null;
        let reviewActual = null;
        let reviewWithin = null;
        if (reviewStart && reviewEnd && reviewSlaConfig) {
            reviewActual = (0, slaUtils_1.workingDaysBetween)(new Date(reviewStart), new Date(reviewEnd));
            reviewWithin = reviewActual <= reviewSlaConfig.workingDays;
        }
        const revisionSlaConfig = await prisma_1.default.configSLA.findFirst({
            where: {
                committeeId,
                stage: "REVISION_RESPONSE",
                reviewType: null,
                isActive: true,
            },
        });
        const revisionStartHistory = submission.statusHistory.find((history) => history.newStatus === client_1.SubmissionStatus.AWAITING_REVISIONS);
        const revisionEndHistory = submission.statusHistory.find((history) => history.newStatus === client_1.SubmissionStatus.REVISION_SUBMITTED);
        const revisionStart = revisionStartHistory?.effectiveDate ?? null;
        const revisionEnd = revisionEndHistory?.effectiveDate ?? null;
        let revisionActual = null;
        let revisionWithin = null;
        if (revisionStart && revisionEnd && revisionSlaConfig) {
            revisionActual = (0, slaUtils_1.workingDaysBetween)(new Date(revisionStart), new Date(revisionEnd));
            revisionWithin = revisionActual <= revisionSlaConfig.workingDays;
        }
        res.json({
            submissionId: submission.id,
            committeeCode: submission.project.committee.code,
            reviewType,
            classification: {
                start: classificationStart,
                end: classificationEnd,
                configuredWorkingDays: classificationConfigured,
                actualWorkingDays: classificationActual,
                withinSla: classificationWithin,
                description: classificationSlaConfig?.description ?? null,
            },
            review: {
                start: reviewStart,
                end: reviewEnd,
                configuredWorkingDays: reviewSlaConfig?.workingDays ?? null,
                actualWorkingDays: reviewActual,
                withinSla: reviewWithin,
                description: reviewSlaConfig?.description ?? null,
            },
            revisionResponse: {
                start: revisionStart,
                end: revisionEnd,
                configuredWorkingDays: revisionSlaConfig?.workingDays ?? null,
                actualWorkingDays: revisionActual,
                withinSla: revisionWithin,
                description: revisionSlaConfig?.description ?? null,
            },
        });
    }
    catch (error) {
        console.error("Error building SLA summary:", error);
        res.status(500).json({ message: "Failed to build SLA summary" });
    }
});
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
