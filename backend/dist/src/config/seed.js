"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sync_1 = require("csv-parse/sync");
const prismaClient_1 = __importDefault(require("./prismaClient"));
const client_1 = require("../generated/prisma/client");
const CSV_FILENAME = "[Intern Copy] RERC Protocol Database 2024 - 2024 Submission.csv";
const safeTrim = (value) => String(value ?? "").trim();
const parseDate = (value) => {
    const raw = safeTrim(value);
    if (!raw)
        return null;
    const mdy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (mdy) {
        const month = Number(mdy[1]);
        const day = Number(mdy[2]);
        let year = Number(mdy[3]);
        if (year < 100)
            year += 2000;
        const date = new Date(Date.UTC(year, month - 1, day));
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymd) {
        const year = Number(ymd[1]);
        const month = Number(ymd[2]);
        const day = Number(ymd[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
};
const mapReviewType = (value) => {
    const normalized = safeTrim(value).toLowerCase();
    if (normalized.startsWith("exempt"))
        return client_1.ReviewType.EXEMPT;
    if (normalized.startsWith("expedit"))
        return client_1.ReviewType.EXPEDITED;
    if (normalized.startsWith("full"))
        return client_1.ReviewType.FULL_BOARD;
    return null;
};
const mapFundingType = (value) => {
    const normalized = safeTrim(value).toLowerCase();
    if (!normalized || normalized === "n/a")
        return client_1.FundingType.NO_FUNDING;
    if (normalized.includes("self"))
        return client_1.FundingType.SELF_FUNDED;
    if (normalized === "rgmo")
        return client_1.FundingType.INTERNAL;
    return client_1.FundingType.EXTERNAL;
};
const mapResearchType = (value, otherValue) => {
    const normalized = safeTrim(value).toLowerCase();
    if (!normalized)
        return { type: null, other: null };
    if (normalized.includes("social")) {
        return { type: client_1.ResearchTypePHREB.SOCIAL_BEHAVIORAL, other: null };
    }
    if (normalized.includes("biomedical")) {
        return { type: client_1.ResearchTypePHREB.BIOMEDICAL, other: null };
    }
    if (normalized.includes("epidemiologic")) {
        return { type: client_1.ResearchTypePHREB.EPIDEMIOLOGICAL, other: null };
    }
    if (normalized.includes("public health")) {
        return { type: client_1.ResearchTypePHREB.PUBLIC_HEALTH, other: null };
    }
    if (normalized.includes("clinical")) {
        return { type: client_1.ResearchTypePHREB.CLINICAL_TRIAL, other: null };
    }
    if (normalized.includes("other")) {
        return {
            type: client_1.ResearchTypePHREB.OTHER,
            other: safeTrim(otherValue) || safeTrim(value),
        };
    }
    return {
        type: client_1.ResearchTypePHREB.OTHER,
        other: safeTrim(otherValue) || safeTrim(value),
    };
};
const mapSubmissionStatus = (statusValue, reviewValue, finishDate, reviewType) => {
    const status = safeTrim(statusValue).toLowerCase();
    const review = safeTrim(reviewValue).toLowerCase();
    if (status === "withdrawn" || review === "withdrawn") {
        return client_1.SubmissionStatus.WITHDRAWN;
    }
    if (status === "cleared") {
        return client_1.SubmissionStatus.CLOSED;
    }
    if (status === "exempted") {
        return finishDate ? client_1.SubmissionStatus.CLOSED : client_1.SubmissionStatus.CLASSIFIED;
    }
    if (reviewType === client_1.ReviewType.EXEMPT) {
        return client_1.SubmissionStatus.CLASSIFIED;
    }
    return client_1.SubmissionStatus.RECEIVED;
};
const mapProjectStatus = (status) => {
    if (status === client_1.SubmissionStatus.WITHDRAWN)
        return client_1.ProjectStatus.WITHDRAWN;
    if (status === client_1.SubmissionStatus.CLOSED)
        return client_1.ProjectStatus.CLOSED;
    return client_1.ProjectStatus.ACTIVE;
};
const importLegacyCsv = async ({ committeeId, raUserId, panelId, }) => {
    const candidates = [
        process.env.LEGACY_CSV_PATH
            ? path_1.default.resolve(process.env.LEGACY_CSV_PATH)
            : null,
        path_1.default.resolve(process.cwd(), CSV_FILENAME),
        path_1.default.resolve(process.cwd(), "..", CSV_FILENAME),
    ].filter(Boolean);
    const csvPath = candidates.find((candidate) => fs_1.default.existsSync(candidate));
    if (!csvPath) {
        console.log(`CSV file not found. Checked: ${candidates.join(", ")}. Skipping legacy import.`);
        return { importedCount: 0 };
    }
    const raw = fs_1.default.readFileSync(csvPath, "utf-8");
    const records = (0, sync_1.parse)(raw, {
        relax_quotes: true,
        relax_column_count: true,
        skip_empty_lines: true,
    });
    if (records.length <= 1) {
        console.log("CSV file is empty. Skipping legacy import.");
        return { importedCount: 0 };
    }
    const rows = records.slice(1);
    let importedCount = 0;
    for (const row of rows) {
        const projectCode = safeTrim(row[0]);
        if (!projectCode)
            continue;
        const title = safeTrim(row[1]) || "Untitled project";
        const piName = safeTrim(row[2]) || "Unknown PI";
        const college = safeTrim(row[3]) || null;
        const department = safeTrim(row[4]) || null;
        const receivedDate = parseDate(row[5]);
        const reviewLabel = safeTrim(row[7]);
        const proponent = safeTrim(row[8]) || null;
        const fundingLabel = safeTrim(row[9]);
        const researchLabel = safeTrim(row[10]);
        const researchOther = safeTrim(row[11]) || null;
        const statusLabel = safeTrim(row[12]);
        const finishDate = parseDate(row[13]);
        const classificationDate = parseDate(row[22]);
        const clearanceExpiration = parseDate(row[64]);
        const progressTarget = parseDate(row[65]);
        const finalReportTarget = parseDate(row[70]);
        const reviewType = mapReviewType(reviewLabel);
        const fundingType = mapFundingType(fundingLabel);
        const researchType = mapResearchType(researchLabel, researchOther);
        const status = mapSubmissionStatus(statusLabel, reviewLabel, finishDate, reviewType);
        const finalDecision = statusLabel.toLowerCase() === "cleared" ||
            statusLabel.toLowerCase() === "exempted"
            ? client_1.ReviewDecision.APPROVED
            : null;
        const finalDecisionDate = finalDecision ? finishDate : null;
        const project = await prismaClient_1.default.project.upsert({
            where: { projectCode },
            update: {
                title,
                piName,
                piAffiliation: college,
                department,
                proponent,
                fundingType,
                researchTypePHREB: researchType.type,
                researchTypePHREBOther: researchType.other,
                initialSubmissionDate: receivedDate ?? finishDate ?? null,
                overallStatus: mapProjectStatus(status),
                approvalStartDate: finishDate ?? null,
                approvalEndDate: clearanceExpiration ?? null,
                committeeId,
            },
            create: {
                projectCode,
                title,
                piName,
                piAffiliation: college,
                department,
                proponent,
                fundingType,
                researchTypePHREB: researchType.type,
                researchTypePHREBOther: researchType.other,
                initialSubmissionDate: receivedDate ?? finishDate ?? null,
                overallStatus: mapProjectStatus(status),
                approvalStartDate: finishDate ?? null,
                approvalEndDate: clearanceExpiration ?? null,
                committeeId,
                createdById: raUserId,
            },
        });
        const baseReceivedDate = receivedDate ?? finishDate ?? classificationDate ?? new Date();
        const existingSubmission = await prismaClient_1.default.submission.findFirst({
            where: {
                projectId: project.id,
                submissionType: client_1.SubmissionType.INITIAL,
                sequenceNumber: 1,
            },
        });
        const submissionData = {
            projectId: project.id,
            submissionType: client_1.SubmissionType.INITIAL,
            sequenceNumber: 1,
            receivedDate: baseReceivedDate,
            status,
            finalDecision,
            finalDecisionDate,
            continuingReviewDueDate: progressTarget ?? null,
            finalReportDueDate: finalReportTarget ?? null,
            createdById: raUserId,
        };
        const submission = existingSubmission
            ? await prismaClient_1.default.submission.update({
                where: { id: existingSubmission.id },
                data: submissionData,
            })
            : await prismaClient_1.default.submission.create({ data: submissionData });
        if (reviewType && classificationDate) {
            await prismaClient_1.default.classification.upsert({
                where: { submissionId: submission.id },
                update: {
                    reviewType,
                    classificationDate,
                    panelId,
                    classifiedById: raUserId,
                    rationale: "Imported from legacy CSV",
                },
                create: {
                    submissionId: submission.id,
                    reviewType,
                    classificationDate,
                    panelId,
                    classifiedById: raUserId,
                    rationale: "Imported from legacy CSV",
                },
            });
        }
        const existingHistory = await prismaClient_1.default.submissionStatusHistory.findFirst({
            where: { submissionId: submission.id },
            select: { id: true },
        });
        if (!existingHistory) {
            await prismaClient_1.default.submissionStatusHistory.create({
                data: {
                    submissionId: submission.id,
                    oldStatus: null,
                    newStatus: status,
                    effectiveDate: finishDate ?? classificationDate ?? baseReceivedDate,
                    reason: "Imported from legacy CSV",
                    changedById: raUserId,
                },
            });
        }
        importedCount += 1;
    }
    console.log(`Imported ${importedCount} CSV submissions.`);
    return { importedCount };
};
async function main() {
    // 1) Ensure a Research Associate user exists
    const raUser = await prismaClient_1.default.user.upsert({
        where: { email: "ra@example.com" },
        update: {},
        create: {
            email: "ra@example.com",
            fullName: "Research Associate",
        },
    });
    // 2) Ensure the main RERC committee exists
    const committee = await prismaClient_1.default.committee.upsert({
        where: { code: "RERC-HUMAN" },
        update: {},
        create: {
            name: "Research Ethics Review Committee – Human Participants",
            code: "RERC-HUMAN",
            description: "Main human participants research ethics committee",
        },
    });
    // 3) Ensure Panel 1 exists under that committee
    let panel1 = await prismaClient_1.default.panel.findFirst({
        where: { code: "P1", committeeId: committee.id },
    });
    if (!panel1) {
        panel1 = await prismaClient_1.default.panel.create({
            data: {
                name: "Panel 1",
                code: "P1",
                committeeId: committee.id,
            },
        });
    }
    // 4) Ensure the RA is a member of this committee
    await prismaClient_1.default.committeeMember.upsert({
        where: {
            committeeId_userId_role: {
                committeeId: committee.id,
                userId: raUser.id,
                role: client_1.RoleType.RESEARCH_ASSOCIATE,
            },
        },
        update: {
            isPrimary: true,
        },
        create: {
            committeeId: committee.id,
            userId: raUser.id,
            role: client_1.RoleType.RESEARCH_ASSOCIATE,
            isPrimary: true,
        },
    });
    // 5) Seed Config SLA rows if none exist for this committee
    const existingSlaCount = await prismaClient_1.default.configSLA.count({
        where: { committeeId: committee.id },
    });
    if (existingSlaCount === 0) {
        await prismaClient_1.default.configSLA.createMany({
            data: [
                {
                    committeeId: committee.id,
                    stage: client_1.SLAStage.CLASSIFICATION,
                    reviewType: client_1.ReviewType.EXEMPT,
                    workingDays: 3,
                    description: "Exempt: classify within 3 working days",
                },
                {
                    committeeId: committee.id,
                    stage: client_1.SLAStage.CLASSIFICATION,
                    reviewType: client_1.ReviewType.EXPEDITED,
                    workingDays: 5,
                    description: "Expedited: classify within 5 working days",
                },
                {
                    committeeId: committee.id,
                    stage: client_1.SLAStage.CLASSIFICATION,
                    reviewType: client_1.ReviewType.FULL_BOARD,
                    workingDays: 7,
                    description: "Full board: classify within 7 working days",
                },
                {
                    committeeId: committee.id,
                    stage: client_1.SLAStage.REVIEW,
                    reviewType: client_1.ReviewType.EXPEDITED,
                    workingDays: 15,
                    description: "Expedited review within 15 working days",
                },
                {
                    committeeId: committee.id,
                    stage: client_1.SLAStage.REVIEW,
                    reviewType: client_1.ReviewType.FULL_BOARD,
                    workingDays: 30,
                    description: "Full board review within 30 working days",
                },
                {
                    committeeId: committee.id,
                    stage: client_1.SLAStage.REVISION_RESPONSE,
                    reviewType: null,
                    workingDays: 70,
                    description: "Researchers have up to 70 working days to respond to revisions",
                },
            ],
        });
        console.log("Seeded default classification/review SLA for RERC-HUMAN");
    }
    const membershipSlas = [
        {
            committeeId: committee.id,
            stage: client_1.SLAStage.MEMBERSHIP,
            reviewType: null,
            workingDays: 14,
            description: "SOP 1B Step 1: Request and receipt of recommendations",
        },
        {
            committeeId: committee.id,
            stage: client_1.SLAStage.MEMBERSHIP,
            reviewType: null,
            workingDays: 3,
            description: "SOP 1B Step 2: Nomination and endorsement of members for appointment",
        },
        {
            committeeId: committee.id,
            stage: client_1.SLAStage.MEMBERSHIP,
            reviewType: null,
            workingDays: 3,
            description: "SOP 1B Step 3: Receipt of appointment papers of new members",
        },
        {
            committeeId: committee.id,
            stage: client_1.SLAStage.MEMBERSHIP,
            reviewType: null,
            workingDays: 5,
            description: "SOP 1B Step 4: Forwarding of appointment papers to new members",
        },
        {
            committeeId: committee.id,
            stage: client_1.SLAStage.MEMBERSHIP,
            reviewType: null,
            workingDays: 5,
            description: "SOP 1B Step 5: Signing of conforme, confidentiality agreement, and COI declaration",
        },
        {
            committeeId: committee.id,
            stage: client_1.SLAStage.MEMBERSHIP,
            reviewType: null,
            workingDays: 1,
            description: "SOP 1B Step 6: Filing of appointment documents and CVs in membership file",
        },
    ];
    const meetingSlas = [
        {
            committeeId: committee.id,
            stage: client_1.SLAStage.MEETING,
            reviewType: null,
            workingDays: 1,
            description: "SOP 18B Step 1: Distribution of meeting materials for face-to-face meetings",
        },
        {
            committeeId: committee.id,
            stage: client_1.SLAStage.MEETING,
            reviewType: null,
            workingDays: 5,
            description: "SOP 18B Step 1: For online meetings, materials emailed at least 5 working days ahead of schedule",
        },
    ];
    const ensureSlaEntries = async (entries, label) => {
        let createdCount = 0;
        for (const sla of entries) {
            const exists = await prismaClient_1.default.configSLA.findFirst({
                where: {
                    committeeId: sla.committeeId,
                    stage: sla.stage,
                    description: sla.description,
                },
            });
            if (!exists) {
                await prismaClient_1.default.configSLA.create({ data: sla });
                createdCount += 1;
            }
        }
        if (createdCount > 0) {
            console.log(`Seeded ${createdCount} ${label} SLA entries`);
        }
    };
    await ensureSlaEntries(membershipSlas, "membership (SOP 1B)");
    await ensureSlaEntries(meetingSlas, "meeting (SOP 18B)");
    // Create panel member if missing
    await prismaClient_1.default.panelMember.upsert({
        where: {
            panelId_userId: {
                panelId: panel1.id,
                userId: raUser.id,
            },
        },
        update: {},
        create: {
            panelId: panel1.id,
            userId: raUser.id,
            role: "MEMBER",
        },
    });
    console.log("Seed ensured for RA user, committee, panel, membership:", {
        raUserId: raUser.id,
        committeeId: committee.id,
        panelId: panel1.id,
    });
    const { importedCount } = await importLegacyCsv({
        committeeId: committee.id,
        raUserId: raUser.id,
        panelId: panel1?.id ?? null,
    });
    const allowDemoData = process.env.SEED_DEMO_DATA === "true";
    // --- Optional demo data so the dashboard has something to display ---
    // Create a few sample projects/submissions if none exist yet.
    const existingSubmissionCount = await prismaClient_1.default.submission.count({
        where: {
            project: {
                committeeId: committee.id,
            },
        },
    });
    if (allowDemoData && importedCount === 0 && existingSubmissionCount === 0) {
        const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const sampleSpecs = [
            {
                projectCode: "2026-0001",
                title: "Sample Project (For Classification)",
                piName: "Sample PI",
                status: "RECEIVED",
            },
            {
                projectCode: "2026-0002",
                title: "Sample Project (Under Review)",
                piName: "Sample PI",
                status: "UNDER_REVIEW",
                reviewType: client_1.ReviewType.EXPEDITED,
            },
            {
                projectCode: "2026-0003",
                title: "Sample Project (Awaiting Revisions)",
                piName: "Sample PI",
                status: "AWAITING_REVISIONS",
                reviewType: client_1.ReviewType.FULL_BOARD,
            },
        ];
        for (const spec of sampleSpecs) {
            const project = await prismaClient_1.default.project.upsert({
                where: { projectCode: spec.projectCode },
                update: {
                    committeeId: committee.id,
                },
                create: {
                    projectCode: spec.projectCode,
                    title: spec.title,
                    piName: spec.piName,
                    piAffiliation: "DLSU Manila",
                    fundingType: "INTERNAL",
                    overallStatus: "ACTIVE",
                    initialSubmissionDate: daysAgo(10),
                    committeeId: committee.id,
                    createdById: raUser.id,
                },
            });
            const submission = await prismaClient_1.default.submission.create({
                data: {
                    projectId: project.id,
                    submissionType: "INITIAL",
                    sequenceNumber: 1,
                    receivedDate: spec.status === "RECEIVED" ? daysAgo(2) : daysAgo(20),
                    status: spec.status,
                    createdById: raUser.id,
                    revisionDueDate: spec.status === "AWAITING_REVISIONS" ? daysAgo(-10) : null,
                },
            });
            if (spec.reviewType) {
                await prismaClient_1.default.classification.create({
                    data: {
                        submissionId: submission.id,
                        reviewType: spec.reviewType,
                        classificationDate: daysAgo(18),
                        panelId: panel1.id,
                        classifiedById: raUser.id,
                        rationale: "Seeded demo classification",
                    },
                });
            }
        }
        console.log("Seeded demo projects/submissions for dashboard queues");
    }
    if (allowDemoData) {
        // --- Dashboard mock data (idempotent) ---
        const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const workingDaysAgo = (days) => {
            const date = new Date();
            let remaining = days;
            while (remaining > 0) {
                date.setDate(date.getDate() - 1);
                const day = date.getDay();
                if (day !== 0 && day !== 6) {
                    remaining -= 1;
                }
            }
            return date;
        };
        const staffUser = await prismaClient_1.default.user.upsert({
            where: { email: "staff@rerc.demo" },
            update: { fullName: "Dashboard Staff", isCommonReviewer: false },
            create: {
                email: "staff@rerc.demo",
                fullName: "Dashboard Staff",
            },
        });
        const reviewerScientist = await prismaClient_1.default.user.upsert({
            where: { email: "reviewer.scientist@rerc.demo" },
            update: { fullName: "Dr. Mira Cruz", isCommonReviewer: true },
            create: {
                email: "reviewer.scientist@rerc.demo",
                fullName: "Dr. Mira Cruz",
                isCommonReviewer: true,
                reviewerExpertise: ["biomedical", "clinical"],
            },
        });
        const reviewerLay = await prismaClient_1.default.user.upsert({
            where: { email: "reviewer.lay@rerc.demo" },
            update: { fullName: "Josefina Reyes", isCommonReviewer: true },
            create: {
                email: "reviewer.lay@rerc.demo",
                fullName: "Josefina Reyes",
                isCommonReviewer: true,
                reviewerExpertise: ["community", "qualitative"],
            },
        });
        const reviewerConsultant = await prismaClient_1.default.user.upsert({
            where: { email: "reviewer.consultant@rerc.demo" },
            update: { fullName: "Dr. Paulo Santos", isCommonReviewer: true },
            create: {
                email: "reviewer.consultant@rerc.demo",
                fullName: "Dr. Paulo Santos",
                isCommonReviewer: true,
                reviewerExpertise: ["statistics"],
            },
        });
        const ensureProponent = async (printedName) => {
            const existing = await prismaClient_1.default.proponent.findFirst({
                where: { printedName },
            });
            if (existing)
                return existing;
            return prismaClient_1.default.proponent.create({
                data: {
                    printedName,
                    signature: `Signed by ${printedName}`,
                    email: `${printedName.split(" ")[0].toLowerCase()}@example.com`,
                    affiliation: "DLSU Manila",
                },
            });
        };
        const demoProjects = [
            {
                projectCode: "DASH-1001",
                title: "Community Health Survey (Missing Affiliation)",
                piName: "Maria Santos",
                piSurname: "Santos",
                piAffiliation: null,
                keywords: ["survey", "ethics"],
                receivedDate: daysAgo(14),
                status: client_1.SubmissionStatus.RECEIVED,
                reviewType: null,
            },
            {
                projectCode: "DASH-1002",
                title: "Mobile Health Intervention",
                piName: "Luis Reyes",
                piSurname: "Reyes",
                piAffiliation: "DLSU Manila",
                keywords: ["clinical", "mobile"],
                receivedDate: daysAgo(30),
                status: client_1.SubmissionStatus.UNDER_REVIEW,
                reviewType: client_1.ReviewType.EXPEDITED,
            },
            {
                projectCode: "DASH-1003",
                title: "Urban Air Quality Monitoring",
                piName: "Ana Cruz",
                piSurname: "Cruz",
                piAffiliation: "DLSU Laguna",
                keywords: ["environment", "public-health"],
                receivedDate: daysAgo(40),
                status: client_1.SubmissionStatus.AWAITING_REVISIONS,
                reviewType: client_1.ReviewType.FULL_BOARD,
            },
        ];
        const dueSoonProjects = [
            {
                projectCode: "DASH-2001",
                title: "Due Soon Classification",
                piName: "Ivy Mendoza",
                piSurname: "Mendoza",
                piAffiliation: "DLSU Manila",
                keywords: ["classification"],
                receivedDate: workingDaysAgo(3),
                status: client_1.SubmissionStatus.RECEIVED,
                reviewType: null,
            },
            {
                projectCode: "DASH-2002",
                title: "Due Soon Review",
                piName: "Rafael Lim",
                piSurname: "Lim",
                piAffiliation: "DLSU Manila",
                keywords: ["review"],
                receivedDate: workingDaysAgo(9),
                status: client_1.SubmissionStatus.UNDER_REVIEW,
                reviewType: client_1.ReviewType.EXPEDITED,
            },
            {
                projectCode: "DASH-2003",
                title: "Due Soon Revision",
                piName: "Chloe Tan",
                piSurname: "Tan",
                piAffiliation: "DLSU Laguna",
                keywords: ["revision"],
                receivedDate: workingDaysAgo(5),
                status: client_1.SubmissionStatus.AWAITING_REVISIONS,
                reviewType: client_1.ReviewType.FULL_BOARD,
            },
        ];
        const ensureStatusHistory = async (submissionId, entries) => {
            for (const entry of entries) {
                const exists = await prismaClient_1.default.submissionStatusHistory.findFirst({
                    where: {
                        submissionId,
                        newStatus: entry.newStatus,
                    },
                });
                if (!exists) {
                    await prismaClient_1.default.submissionStatusHistory.create({
                        data: {
                            submissionId,
                            oldStatus: entry.oldStatus ?? undefined,
                            newStatus: entry.newStatus,
                            effectiveDate: entry.effectiveDate,
                            reason: entry.reason,
                            changedById: raUser.id,
                        },
                    });
                }
            }
        };
        for (const spec of [...demoProjects, ...dueSoonProjects]) {
            const project = await prismaClient_1.default.project.upsert({
                where: { projectCode: spec.projectCode },
                update: {
                    title: spec.title,
                    piName: spec.piName,
                    piSurname: spec.piSurname,
                    piAffiliation: spec.piAffiliation,
                    keywords: spec.keywords,
                    proposedStartDate: daysFromNow(15),
                    proposedEndDate: daysFromNow(120),
                    committeeId: committee.id,
                    createdById: raUser.id,
                },
                create: {
                    projectCode: spec.projectCode,
                    title: spec.title,
                    piName: spec.piName,
                    piSurname: spec.piSurname,
                    piAffiliation: spec.piAffiliation,
                    keywords: spec.keywords,
                    fundingType: "INTERNAL",
                    overallStatus: "ACTIVE",
                    initialSubmissionDate: daysAgo(45),
                    proposedStartDate: daysFromNow(15),
                    proposedEndDate: daysFromNow(120),
                    committeeId: committee.id,
                    createdById: raUser.id,
                },
            });
            const proponent = await ensureProponent(`${spec.piName} (Proponent)`);
            const existingProponentLink = await prismaClient_1.default.projectProponent.findFirst({
                where: { projectId: project.id, proponentId: proponent.id },
            });
            if (!existingProponentLink) {
                await prismaClient_1.default.projectProponent.create({
                    data: {
                        projectId: project.id,
                        proponentId: proponent.id,
                        role: "Primary",
                    },
                });
            }
            const existingMember = await prismaClient_1.default.projectMember.findFirst({
                where: { projectId: project.id, fullName: spec.piName },
            });
            if (!existingMember) {
                await prismaClient_1.default.projectMember.create({
                    data: {
                        projectId: project.id,
                        fullName: spec.piName,
                        role: client_1.ProjectMemberRole.PI,
                        email: `${spec.piSurname.toLowerCase()}@example.com`,
                        affiliation: spec.piAffiliation ?? "DLSU Manila",
                    },
                });
            }
            const existingChange = await prismaClient_1.default.projectChangeLog.findFirst({
                where: { projectId: project.id, fieldName: "title" },
            });
            if (!existingChange) {
                await prismaClient_1.default.projectChangeLog.create({
                    data: {
                        projectId: project.id,
                        fieldName: "title",
                        oldValue: `${spec.title} (Draft)`,
                        newValue: spec.title,
                        reason: "Amendment update for demo",
                        changedById: raUser.id,
                    },
                });
            }
            let submission = await prismaClient_1.default.submission.findFirst({
                where: {
                    projectId: project.id,
                    submissionType: client_1.SubmissionType.INITIAL,
                    sequenceNumber: 1,
                },
            });
            if (!submission) {
                submission = await prismaClient_1.default.submission.create({
                    data: {
                        projectId: project.id,
                        submissionType: client_1.SubmissionType.INITIAL,
                        sequenceNumber: 1,
                        receivedDate: spec.receivedDate,
                        status: spec.status,
                        createdById: raUser.id,
                        staffInChargeId: staffUser.id,
                        revisionDueDate: spec.status === client_1.SubmissionStatus.AWAITING_REVISIONS
                            ? daysFromNow(5)
                            : null,
                    },
                });
            }
            else {
                await prismaClient_1.default.submission.update({
                    where: { id: submission.id },
                    data: {
                        receivedDate: spec.receivedDate,
                        status: spec.status,
                        staffInChargeId: staffUser.id,
                        revisionDueDate: spec.status === client_1.SubmissionStatus.AWAITING_REVISIONS
                            ? daysFromNow(5)
                            : null,
                    },
                });
            }
            if (spec.reviewType) {
                const existingClassification = await prismaClient_1.default.classification.findUnique({
                    where: { submissionId: submission.id },
                });
                if (!existingClassification) {
                    await prismaClient_1.default.classification.create({
                        data: {
                            submissionId: submission.id,
                            reviewType: spec.reviewType,
                            classificationDate: daysAgo(25),
                            panelId: panel1.id,
                            classifiedById: raUser.id,
                            rationale: "Seeded demo classification",
                            missingDocuments: ["Updated protocol form"],
                            clarificationsNeeded: ["Clarify recruitment procedure"],
                        },
                    });
                }
            }
            await ensureStatusHistory(submission.id, [
                {
                    oldStatus: null,
                    newStatus: client_1.SubmissionStatus.RECEIVED,
                    effectiveDate: daysAgo(40),
                    reason: "Submission received",
                },
                {
                    oldStatus: client_1.SubmissionStatus.RECEIVED,
                    newStatus: spec.status,
                    effectiveDate: spec.receivedDate,
                    reason: "Moved to current stage",
                },
            ]);
            const docExists = await prismaClient_1.default.submissionDocument.findFirst({
                where: { submissionId: submission.id, type: client_1.SubmissionDocumentType.INFORMED_CONSENT },
            });
            if (!docExists) {
                await prismaClient_1.default.submissionDocument.create({
                    data: {
                        submissionId: submission.id,
                        type: client_1.SubmissionDocumentType.INFORMED_CONSENT,
                        title: "Informed Consent Form",
                        status: client_1.SubmissionDocumentStatus.RECEIVED,
                        receivedAt: daysAgo(10),
                    },
                });
            }
            const letterDraftExists = await prismaClient_1.default.letterDraft.findFirst({
                where: { submissionId: submission.id, templateCode: "6B" },
            });
            if (!letterDraftExists) {
                await prismaClient_1.default.letterDraft.create({
                    data: {
                        submissionId: submission.id,
                        templateCode: "6B",
                        status: client_1.LetterDraftStatus.DRAFT,
                        generatedById: raUser.id,
                        notes: "Seeded draft for demo",
                    },
                });
            }
            if (spec.status === client_1.SubmissionStatus.UNDER_REVIEW) {
                await prismaClient_1.default.review.upsert({
                    where: {
                        submissionId_reviewerId: {
                            submissionId: submission.id,
                            reviewerId: reviewerScientist.id,
                        },
                    },
                    update: {
                        reviewerRole: client_1.ReviewerRoleType.SCIENTIST,
                        assignedAt: daysAgo(12),
                        dueDate: daysAgo(7),
                        respondedAt: null,
                    },
                    create: {
                        submissionId: submission.id,
                        reviewerId: reviewerScientist.id,
                        reviewerRole: client_1.ReviewerRoleType.SCIENTIST,
                        assignedAt: daysAgo(12),
                        dueDate: daysAgo(7),
                    },
                });
                await prismaClient_1.default.review.upsert({
                    where: {
                        submissionId_reviewerId: {
                            submissionId: submission.id,
                            reviewerId: reviewerLay.id,
                        },
                    },
                    update: {
                        reviewerRole: client_1.ReviewerRoleType.LAY,
                        assignedAt: daysAgo(12),
                        dueDate: daysAgo(6),
                        respondedAt: null,
                    },
                    create: {
                        submissionId: submission.id,
                        reviewerId: reviewerLay.id,
                        reviewerRole: client_1.ReviewerRoleType.LAY,
                        assignedAt: daysAgo(12),
                        dueDate: daysAgo(6),
                    },
                });
                await prismaClient_1.default.review.upsert({
                    where: {
                        submissionId_reviewerId: {
                            submissionId: submission.id,
                            reviewerId: reviewerConsultant.id,
                        },
                    },
                    update: {
                        reviewerRole: client_1.ReviewerRoleType.INDEPENDENT_CONSULTANT,
                        assignedAt: daysAgo(10),
                        dueDate: daysAgo(5),
                        endorsementStatus: client_1.EndorsementStatus.PENDING,
                    },
                    create: {
                        submissionId: submission.id,
                        reviewerId: reviewerConsultant.id,
                        reviewerRole: client_1.ReviewerRoleType.INDEPENDENT_CONSULTANT,
                        assignedAt: daysAgo(10),
                        dueDate: daysAgo(5),
                        endorsementStatus: client_1.EndorsementStatus.PENDING,
                    },
                });
            }
        }
        console.log("Seeded dashboard mock data (projects, submissions, reviews)");
    }
}
main()
    .catch((e) => {
    console.error("Seed error", e);
    process.exit(1);
})
    .finally(async () => {
    await prismaClient_1.default.$disconnect();
});
