/**
 * Prisma cleanup helper for integration tests
 * Provides utilities to reset database state between tests
 */

import prisma from "../../src/prisma";

/**
 * Clears all user-created data (respects foreign key constraints)
 * Order matters: delete leaf tables first, then parents
 */
export async function cleanupDatabase() {
  try {
    await prisma.$transaction([
      // Leaf tables first (no outgoing FKs or safe to delete)
      prisma.submissionStatusHistory.deleteMany({}),
      prisma.review.deleteMany({}),
      prisma.classification.deleteMany({}),
      prisma.submission.deleteMany({}),
      prisma.panelMember.deleteMany({}),
      prisma.panel.deleteMany({}),
      prisma.committeeMember.deleteMany({}),
      prisma.project.deleteMany({}),
      prisma.configSLA.deleteMany({}),
      prisma.committee.deleteMany({}),
      prisma.user.deleteMany({}),
    ]);
  } catch (err) {
    console.error("Failed to cleanup database:", err);
    throw err;
  }
}

/**
 * Reset database and run seed (if you have a seed function)
 */
export async function resetDatabaseWithSeed(seedFn?: () => Promise<void>) {
  await cleanupDatabase();
  if (seedFn) {
    await seedFn();
  }
}

/**
 * Alternative: delete only specific tables (for more granular control)
 */
export async function cleanupSubmissions() {
  await prisma.$transaction([
    prisma.submissionStatusHistory.deleteMany({}),
    prisma.review.deleteMany({}),
    prisma.classification.deleteMany({}),
    prisma.submission.deleteMany({}),
  ]);
}

export async function cleanupProjects() {
  await cleanupSubmissions();
  await prisma.project.deleteMany({});
}
