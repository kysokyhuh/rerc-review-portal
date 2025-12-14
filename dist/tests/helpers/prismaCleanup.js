"use strict";
/**
 * Prisma cleanup helper for integration tests
 * Provides utilities to reset database state between tests
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupDatabase = cleanupDatabase;
exports.resetDatabaseWithSeed = resetDatabaseWithSeed;
exports.cleanupSubmissions = cleanupSubmissions;
exports.cleanupProjects = cleanupProjects;
const prismaClient_1 = __importDefault(require("../../src/config/prismaClient"));
/**
 * Clears all user-created data (respects foreign key constraints)
 * Order matters: delete leaf tables first, then parents
 */
async function cleanupDatabase() {
    try {
        await prismaClient_1.default.$transaction([
            // Leaf tables first (no outgoing FKs or safe to delete)
            prismaClient_1.default.submissionStatusHistory.deleteMany({}),
            prismaClient_1.default.review.deleteMany({}),
            prismaClient_1.default.classification.deleteMany({}),
            prismaClient_1.default.submission.deleteMany({}),
            prismaClient_1.default.panelMember.deleteMany({}),
            prismaClient_1.default.panel.deleteMany({}),
            prismaClient_1.default.committeeMember.deleteMany({}),
            prismaClient_1.default.project.deleteMany({}),
            prismaClient_1.default.configSLA.deleteMany({}),
            prismaClient_1.default.committee.deleteMany({}),
            prismaClient_1.default.user.deleteMany({}),
        ]);
    }
    catch (err) {
        console.error("Failed to cleanup database:", err);
        throw err;
    }
}
/**
 * Reset database and run seed (if you have a seed function)
 */
async function resetDatabaseWithSeed(seedFn) {
    await cleanupDatabase();
    if (seedFn) {
        await seedFn();
    }
}
/**
 * Alternative: delete only specific tables (for more granular control)
 */
async function cleanupSubmissions() {
    await prismaClient_1.default.$transaction([
        prismaClient_1.default.submissionStatusHistory.deleteMany({}),
        prismaClient_1.default.review.deleteMany({}),
        prismaClient_1.default.classification.deleteMany({}),
        prismaClient_1.default.submission.deleteMany({}),
    ]);
}
async function cleanupProjects() {
    await cleanupSubmissions();
    await prismaClient_1.default.project.deleteMany({});
}
