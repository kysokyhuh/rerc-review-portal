import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import prisma from "../config/prismaClient";

const DEFAULT_LEGACY_CSV_FILENAME =
  "[Intern Copy] RERC Protocol Database 2024 - 2024 Submission.csv";

const normalizeReviewType = (value: string | null | undefined) => {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!text) return null;
  if (text.includes("withdraw")) return "Withdrawn";
  if (text.includes("exempt")) return "Exempted";
  if (text.includes("expedit")) return "Expedited";
  if (text.includes("full")) return "Full Review";
  return null;
};

const monthLabel = (value: Date) =>
  value.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const resolveCsvPath = () => {
  const candidates = [
    process.env.LEGACY_CSV_PATH ? path.resolve(process.env.LEGACY_CSV_PATH) : null,
    path.resolve(process.cwd(), DEFAULT_LEGACY_CSV_FILENAME),
    path.resolve(process.cwd(), "..", DEFAULT_LEGACY_CSV_FILENAME),
    path.resolve("/Users/kayexds/Downloads/test.csv"),
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
};

const loadReviewMapFromCsv = (csvPath: string | null) => {
  if (!csvPath) return new Map<string, string>();

  const raw = fs.readFileSync(csvPath, "utf8");
  const records: string[][] = parse(raw, {
    bom: true,
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });

  const reviewByCode = new Map<string, string>();
  for (const row of records.slice(1)) {
    const projectCode = String(row[0] ?? "")
      .trim()
      .toUpperCase();
    const reviewType = String(row[7] ?? "").trim();
    if (!projectCode || !reviewType) continue;
    reviewByCode.set(projectCode, reviewType);
  }

  return reviewByCode;
};

async function main() {
  const csvPath = resolveCsvPath();
  const csvReviewMap = loadReviewMapFromCsv(csvPath);

  const profiles = await prisma.project.findMany({
    select: {
      projectCode: true,
      protocolProfile: {
        select: {
          id: true,
          dateOfSubmission: true,
          monthOfSubmission: true,
          typeOfReview: true,
          status: true,
          classificationOfProposalRerc: true,
          withdrawn: true,
        },
      },
      submissions: {
        where: { sequenceNumber: 1 },
        select: {
          receivedDate: true,
          status: true,
        },
      },
    },
  });

  let repairedDates = 0;
  let repairedReviewTypes = 0;

  for (const project of profiles) {
    const profile = project.protocolProfile;
    const submission = project.submissions[0];
    if (!profile) continue;

    const patch: {
      dateOfSubmission?: Date;
      monthOfSubmission?: string;
      typeOfReview?: string;
    } = {};

    if (
      submission?.receivedDate &&
      (!profile.dateOfSubmission ||
        profile.dateOfSubmission.getTime() !== submission.receivedDate.getTime())
    ) {
      patch.dateOfSubmission = submission.receivedDate;
      patch.monthOfSubmission = monthLabel(submission.receivedDate);
      repairedDates += 1;
    }

    if (!profile.typeOfReview) {
      const projectCode = String(project.projectCode ?? "")
        .trim()
        .toUpperCase();
      const inferredReviewType =
        csvReviewMap.get(projectCode) ??
        normalizeReviewType(profile.status) ??
        normalizeReviewType(profile.classificationOfProposalRerc) ??
        (profile.withdrawn === true ? "Withdrawn" : null) ??
        normalizeReviewType(submission?.status);

      if (inferredReviewType) {
        patch.typeOfReview = inferredReviewType;
        repairedReviewTypes += 1;
      }
    }

    if (Object.keys(patch).length === 0) continue;

    await prisma.protocolProfile.update({
      where: { id: profile.id },
      data: patch,
    });
  }

  console.log(
    JSON.stringify(
      {
        repairedDates,
        repairedReviewTypes,
        csvPathUsed: csvPath,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Failed to repair legacy protocol profiles.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
