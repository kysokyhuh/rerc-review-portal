import "dotenv/config";
import prisma from "../config/prismaClient";
import { RoleType, UserStatus } from "../generated/prisma/client";
import { deleteProjectRecord } from "../services/projects/projectService";

type CliArgs = Record<string, string | boolean>;

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = item.slice(2).split("=", 2);
    const key = rawKey.trim();
    if (!key) {
      continue;
    }

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function readString(args: CliArgs, key: string) {
  const value = args[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readPositiveInt(args: CliArgs, key: string) {
  const raw = readString(args, key);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${key} must be a positive integer.`);
  }
  return value;
}

function hasAdminDeleteRole(roles: RoleType[]) {
  return roles.includes(RoleType.CHAIR) || roles.includes(RoleType.ADMIN);
}

async function resolveActor(args: CliArgs) {
  const actorId =
    readPositiveInt(args, "actor-id") ||
    (process.env.ADMIN_DELETE_ACTOR_ID
      ? Number(process.env.ADMIN_DELETE_ACTOR_ID)
      : null);
  const actorEmail =
    readString(args, "actor-email") ||
    process.env.ADMIN_DELETE_ACTOR_EMAIL?.trim() ||
    null;

  const actor = actorId
    ? await prisma.user.findUnique({
        where: { id: actorId },
        select: {
          id: true,
          email: true,
          fullName: true,
          roles: true,
          status: true,
          isActive: true,
        },
      })
    : actorEmail
    ? await prisma.user.findUnique({
        where: { email: actorEmail },
        select: {
          id: true,
          email: true,
          fullName: true,
          roles: true,
          status: true,
          isActive: true,
        },
      })
    : await prisma.user.findFirst({
        where: {
          status: UserStatus.APPROVED,
          isActive: true,
          roles: { hasSome: [RoleType.CHAIR, RoleType.ADMIN] },
        },
        orderBy: { id: "asc" },
        select: {
          id: true,
          email: true,
          fullName: true,
          roles: true,
          status: true,
          isActive: true,
        },
      });

  if (!actor) {
    throw new Error(
      "No admin actor found. Pass --actor-email or --actor-id for an approved Chair/Admin account."
    );
  }

  if (
    actor.status !== UserStatus.APPROVED ||
    !actor.isActive ||
    !hasAdminDeleteRole(actor.roles)
  ) {
    throw new Error(
      `Actor ${actor.email} must be an active approved Chair/Admin account.`
    );
  }

  return actor;
}

async function resolveProjectId(args: CliArgs) {
  const projectId = readPositiveInt(args, "project-id");
  if (projectId) {
    return projectId;
  }

  const submissionId = readPositiveInt(args, "submission-id");
  if (!submissionId) {
    throw new Error("Pass either --project-id or --submission-id.");
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      projectId: true,
      project: {
        select: {
          id: true,
          projectCode: true,
          title: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error(`Submission ${submissionId} was not found.`);
  }

  if (!submission.projectId || !submission.project) {
    throw new Error(`Submission ${submissionId} has no linked protocol record.`);
  }

  console.log(
    `Resolved submission ${submission.id} to protocol ${submission.projectId}` +
      (submission.project.projectCode ? ` (${submission.project.projectCode})` : "")
  );

  return submission.projectId;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reason = readString(args, "reason");
  const apply = args.apply === true || args.apply === "true";

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  if (!reason) {
    throw new Error('Pass a delete reason, for example: --reason "duplicate test"');
  }

  const projectId = await resolveProjectId(args);
  const actor = await resolveActor(args);

  if (!apply) {
    console.log("Dry run only. Add --apply to move the protocol to Recently Deleted.");
    console.log(`Would delete protocol ${projectId} as ${actor.email}`);
    console.log(`Reason: ${reason}`);
    return;
  }

  const result = await deleteProjectRecord(projectId, reason, actor.id);
  console.log("Protocol moved to Recently Deleted.");
  console.log(
    JSON.stringify(
      {
        projectId: result.project.id,
        projectCode: result.project.projectCode,
        deletedAt: result.project.deletedAt,
        deletePurgeAt: result.project.deletePurgeAt,
        deletedBy: result.project.deletedBy?.email ?? actor.email,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Admin delete failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
