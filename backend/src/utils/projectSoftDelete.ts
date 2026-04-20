import { AppError } from "../middleware/errorHandler";
import { hasTableColumns } from "./schemaIntrospection";

export async function hasProjectSoftDeleteColumns() {
  return hasTableColumns("Project", [
    "deletedAt",
    "purgedAt",
    "deletedById",
    "deletedReason",
    "deletedFromStatus",
    "deletePurgeAt",
  ]);
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
