import prisma from "../config/prismaClient";
import { AppError } from "../middleware/errorHandler";

type ColumnRow = {
  column_name: string;
};

let projectSoftDeleteColumnsPromise: Promise<boolean> | null = null;

export async function hasProjectSoftDeleteColumns() {
  if (!projectSoftDeleteColumnsPromise) {
    if (typeof prisma.$queryRaw !== "function") {
      projectSoftDeleteColumnsPromise = Promise.resolve(true);
      return projectSoftDeleteColumnsPromise;
    }

    projectSoftDeleteColumnsPromise = prisma
      .$queryRaw<ColumnRow[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'Project'
          AND column_name IN ('deletedAt', 'purgedAt', 'deletedById', 'deletedReason', 'deletedFromStatus', 'deletePurgeAt')
      `
      .then((rows) => rows.length === 6)
      .catch(() => false);
  }

  return projectSoftDeleteColumnsPromise;
}

export async function getActiveProjectFilter() {
  return (await hasProjectSoftDeleteColumns())
    ? ({
        deletedAt: null,
        purgedAt: null,
      } as const)
    : {};
}

export async function requireProjectSoftDeleteColumns() {
  if (await hasProjectSoftDeleteColumns()) {
    return;
  }

  throw new AppError(
    503,
    "SOFT_DELETE_UNAVAILABLE",
    "Recently Deleted is unavailable until the database migration is applied."
  );
}
