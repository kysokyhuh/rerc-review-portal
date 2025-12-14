"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prisma_1 = __importDefault(require("./prisma"));
const client_1 = require("./generated/prisma/client");
async function main() {
    // 1) Ensure a Research Associate user exists
    const raUser = await prisma_1.default.user.upsert({
        where: { email: "ra@example.com" },
        update: {},
        create: {
            email: "ra@example.com",
            fullName: "Research Associate",
        },
    });
    // 2) Ensure the main RERC committee exists
    const committee = await prisma_1.default.committee.upsert({
        where: { code: "RERC-HUMAN" },
        update: {},
        create: {
            name: "Research Ethics Review Committee – Human Participants",
            code: "RERC-HUMAN",
            description: "Main human participants research ethics committee",
        },
    });
    // 3) Ensure Panel 1 exists under that committee
    let panel1 = await prisma_1.default.panel.findFirst({
        where: { code: "P1", committeeId: committee.id },
    });
    if (!panel1) {
        panel1 = await prisma_1.default.panel.create({
            data: {
                name: "Panel 1",
                code: "P1",
                committeeId: committee.id,
            },
        });
    }
    // 4) Ensure the RA is a member of this committee
    await prisma_1.default.committeeMember.upsert({
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
    const existingSlaCount = await prisma_1.default.configSLA.count({
        where: { committeeId: committee.id },
    });
    if (existingSlaCount === 0) {
        await prisma_1.default.configSLA.createMany({
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
            const exists = await prisma_1.default.configSLA.findFirst({
                where: {
                    committeeId: sla.committeeId,
                    stage: sla.stage,
                    description: sla.description,
                },
            });
            if (!exists) {
                await prisma_1.default.configSLA.create({ data: sla });
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
    await prisma_1.default.panelMember.upsert({
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
}
main()
    .catch((e) => {
    console.error("Seed error", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.default.$disconnect();
});
