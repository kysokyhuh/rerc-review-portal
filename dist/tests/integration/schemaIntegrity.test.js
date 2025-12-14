"use strict";
/**
 * Integration tests: Prisma schema constraints and relational integrity
 * Tests uniqueness, foreign keys, cascades, and transaction guarantees
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prismaClient_1 = __importDefault(require("../../src/config/prismaClient"));
const prismaCleanup_1 = require("../helpers/prismaCleanup");
describe("Prisma Schema Integrity", () => {
    beforeEach(async () => {
        await (0, prismaCleanup_1.cleanupDatabase)();
    });
    afterAll(async () => {
        await (0, prismaCleanup_1.cleanupDatabase)();
        await prismaClient_1.default.$disconnect();
    });
    describe("Project.projectCode uniqueness", () => {
        test("Create project with unique projectCode succeeds", async () => {
            const project = await prismaClient_1.default.project.create({
                data: {
                    projectCode: "2025-001",
                    title: "Test Project",
                    piName: "Dr. Test",
                    fundingType: "INTERNAL",
                    committeeId: 1,
                },
            });
            expect(project.projectCode).toBe("2025-001");
        });
        test("Duplicate projectCode violates unique constraint", async () => {
            await prismaClient_1.default.project.create({
                data: {
                    projectCode: "2025-001",
                    title: "Test Project 1",
                    piName: "Dr. Test",
                    fundingType: "INTERNAL",
                    committeeId: 1,
                },
            });
            // Setup: create committee first
            await prismaClient_1.default.committee.create({
                data: {
                    name: "Test Committee",
                    code: "TEST-COMM",
                },
            });
            await expect(prismaClient_1.default.project.create({
                data: {
                    projectCode: "2025-001", // duplicate
                    title: "Test Project 2",
                    piName: "Dr. Another",
                    fundingType: "EXTERNAL",
                    committeeId: 1,
                },
            })).rejects.toThrow();
        });
    });
    describe("Classification.submissionId uniqueness", () => {
        let submission;
        beforeEach(async () => {
            const committee = await prismaClient_1.default.committee.create({
                data: { name: "Test Committee", code: "TEST" },
            });
            const project = await prismaClient_1.default.project.create({
                data: {
                    projectCode: "2025-TEST",
                    title: "Test",
                    piName: "Dr. Test",
                    fundingType: "INTERNAL",
                    committeeId: committee.id,
                },
            });
            submission = await prismaClient_1.default.submission.create({
                data: {
                    projectId: project.id,
                    submissionType: "INITIAL",
                    receivedDate: new Date(),
                },
            });
        });
        test("Create classification succeeds", async () => {
            const classification = await prismaClient_1.default.classification.create({
                data: {
                    submissionId: submission.id,
                    reviewType: "EXPEDITED",
                    classificationDate: new Date(),
                },
            });
            expect(classification.submissionId).toBe(submission.id);
        });
        test("Duplicate classification for same submission fails", async () => {
            await prismaClient_1.default.classification.create({
                data: {
                    submissionId: submission.id,
                    reviewType: "EXPEDITED",
                    classificationDate: new Date(),
                },
            });
            await expect(prismaClient_1.default.classification.create({
                data: {
                    submissionId: submission.id,
                    reviewType: "FULL_BOARD",
                    classificationDate: new Date(),
                },
            })).rejects.toThrow(); // unique constraint on submissionId
        });
    });
    describe("Review (submissionId, reviewerId) uniqueness", () => {
        let submission;
        let reviewer;
        beforeEach(async () => {
            const committee = await prismaClient_1.default.committee.create({
                data: { name: "Test Committee", code: "TEST" },
            });
            const project = await prismaClient_1.default.project.create({
                data: {
                    projectCode: "2025-TEST",
                    title: "Test",
                    piName: "Dr. Test",
                    fundingType: "INTERNAL",
                    committeeId: committee.id,
                },
            });
            submission = await prismaClient_1.default.submission.create({
                data: {
                    projectId: project.id,
                    submissionType: "INITIAL",
                    receivedDate: new Date(),
                },
            });
            reviewer = await prismaClient_1.default.user.create({
                data: {
                    email: "reviewer@test.com",
                    fullName: "Reviewer Name",
                },
            });
        });
        test("Assign reviewer succeeds", async () => {
            const review = await prismaClient_1.default.review.create({
                data: {
                    submissionId: submission.id,
                    reviewerId: reviewer.id,
                },
            });
            expect(review.submissionId).toBe(submission.id);
            expect(review.reviewerId).toBe(reviewer.id);
        });
        test("Duplicate reviewer assignment fails", async () => {
            await prismaClient_1.default.review.create({
                data: {
                    submissionId: submission.id,
                    reviewerId: reviewer.id,
                },
            });
            await expect(prismaClient_1.default.review.create({
                data: {
                    submissionId: submission.id,
                    reviewerId: reviewer.id,
                },
            })).rejects.toThrow(); // unique constraint
        });
        test("Different reviewers for same submission allowed", async () => {
            const reviewer2 = await prismaClient_1.default.user.create({
                data: {
                    email: "reviewer2@test.com",
                    fullName: "Reviewer 2",
                },
            });
            const review1 = await prismaClient_1.default.review.create({
                data: {
                    submissionId: submission.id,
                    reviewerId: reviewer.id,
                },
            });
            const review2 = await prismaClient_1.default.review.create({
                data: {
                    submissionId: submission.id,
                    reviewerId: reviewer2.id,
                },
            });
            expect(review1.reviewerId).toBe(reviewer.id);
            expect(review2.reviewerId).toBe(reviewer2.id);
        });
    });
    describe("CommitteeMember (committeeId, userId, role) uniqueness", () => {
        let committee;
        let user;
        beforeEach(async () => {
            committee = await prismaClient_1.default.committee.create({
                data: { name: "Test Committee", code: "TEST" },
            });
            user = await prismaClient_1.default.user.create({
                data: {
                    email: "member@test.com",
                    fullName: "Member Name",
                },
            });
        });
        test("Add committee member succeeds", async () => {
            const member = await prismaClient_1.default.committeeMember.create({
                data: {
                    committeeId: committee.id,
                    userId: user.id,
                    role: "CHAIR",
                },
            });
            expect(member.role).toBe("CHAIR");
        });
        test("Duplicate committee member with same role fails", async () => {
            await prismaClient_1.default.committeeMember.create({
                data: {
                    committeeId: committee.id,
                    userId: user.id,
                    role: "CHAIR",
                },
            });
            await expect(prismaClient_1.default.committeeMember.create({
                data: {
                    committeeId: committee.id,
                    userId: user.id,
                    role: "CHAIR",
                },
            })).rejects.toThrow(); // unique constraint
        });
        test("Same user with different role in same committee allowed", async () => {
            const member1 = await prismaClient_1.default.committeeMember.create({
                data: {
                    committeeId: committee.id,
                    userId: user.id,
                    role: "CHAIR",
                },
            });
            // Same user, different role in same committee - should be allowed per schema
            // OR blocked if your policy says one role per user per committee
            // This test documents current behavior; adjust based on your SOP
            // For now, assume it's allowed (user can be CHAIR and MEMBER)
            const member2 = await prismaClient_1.default.committeeMember.create({
                data: {
                    committeeId: committee.id,
                    userId: user.id,
                    role: "MEMBER",
                },
            });
            expect(member2.role).toBe("MEMBER");
        });
    });
    describe("Foreign key integrity", () => {
        test("Submission requires valid projectId", async () => {
            await expect(prismaClient_1.default.submission.create({
                data: {
                    projectId: 999, // invalid
                    submissionType: "INITIAL",
                    receivedDate: new Date(),
                },
            })).rejects.toThrow(); // foreign key constraint
        });
        test("Classification requires valid submissionId", async () => {
            await expect(prismaClient_1.default.classification.create({
                data: {
                    submissionId: 999, // invalid
                    reviewType: "EXPEDITED",
                    classificationDate: new Date(),
                },
            })).rejects.toThrow();
        });
        test("Review requires valid submissionId and reviewerId", async () => {
            await expect(prismaClient_1.default.review.create({
                data: {
                    submissionId: 999, // invalid
                    reviewerId: 999, // invalid
                },
            })).rejects.toThrow();
        });
    });
    describe("Transaction integrity", () => {
        test("Multiple writes succeed atomically", async () => {
            const committee = await prismaClient_1.default.committee.create({
                data: { name: "Test Committee", code: "TEST" },
            });
            const project = await prismaClient_1.default.project.create({
                data: {
                    projectCode: "2025-TX",
                    title: "Transaction Test",
                    piName: "Dr. Test",
                    fundingType: "INTERNAL",
                    committeeId: committee.id,
                },
            });
            const [submission, history] = await prismaClient_1.default.$transaction([
                prismaClient_1.default.submission.create({
                    data: {
                        projectId: project.id,
                        submissionType: "INITIAL",
                        receivedDate: new Date(),
                    },
                }),
                prismaClient_1.default.submissionStatusHistory.create({
                    data: {
                        submissionId: 1, // Will fail if submission doesn't exist
                        newStatus: "RECEIVED",
                    },
                }),
            ]);
            expect(submission).toBeDefined();
            expect(history).toBeDefined();
            expect(history.newStatus).toBe("RECEIVED");
        });
    });
    describe("StatusHistory ordering", () => {
        let submission;
        beforeEach(async () => {
            const committee = await prismaClient_1.default.committee.create({
                data: { name: "Test Committee", code: "TEST" },
            });
            const project = await prismaClient_1.default.project.create({
                data: {
                    projectCode: "2025-SH",
                    title: "Status History Test",
                    piName: "Dr. Test",
                    fundingType: "INTERNAL",
                    committeeId: committee.id,
                },
            });
            submission = await prismaClient_1.default.submission.create({
                data: {
                    projectId: project.id,
                    submissionType: "INITIAL",
                    receivedDate: new Date(),
                },
            });
        });
        test("Multiple status changes maintain order", async () => {
            const date1 = new Date("2025-12-01T10:00:00Z");
            const date2 = new Date("2025-12-02T10:00:00Z");
            const date3 = new Date("2025-12-03T10:00:00Z");
            await prismaClient_1.default.submissionStatusHistory.create({
                data: {
                    submissionId: submission.id,
                    oldStatus: "RECEIVED",
                    newStatus: "UNDER_COMPLETENESS_CHECK",
                    effectiveDate: date1,
                },
            });
            await prismaClient_1.default.submissionStatusHistory.create({
                data: {
                    submissionId: submission.id,
                    oldStatus: "UNDER_COMPLETENESS_CHECK",
                    newStatus: "AWAITING_CLASSIFICATION",
                    effectiveDate: date2,
                },
            });
            await prismaClient_1.default.submissionStatusHistory.create({
                data: {
                    submissionId: submission.id,
                    oldStatus: "AWAITING_CLASSIFICATION",
                    newStatus: "UNDER_CLASSIFICATION",
                    effectiveDate: date3,
                },
            });
            const history = await prismaClient_1.default.submissionStatusHistory.findMany({
                where: { submissionId: submission.id },
                orderBy: { effectiveDate: "asc" },
            });
            expect(history.length).toBe(3);
            expect(history[0].newStatus).toBe("UNDER_COMPLETENESS_CHECK");
            expect(history[1].newStatus).toBe("AWAITING_CLASSIFICATION");
            expect(history[2].newStatus).toBe("UNDER_CLASSIFICATION");
        });
    });
});
