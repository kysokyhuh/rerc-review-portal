import "dotenv/config";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import prisma from "./prismaClient";
import {
  EndorsementStatus,
  FundingType,
  LetterDraftStatus,
  ProjectMemberRole,
  ProjectStatus,
  ResearchTypePHREB,
  ReviewDecision,
  ReviewType,
  ReviewerRoleType,
  RoleType,
  SLAStage,
  SubmissionDocumentStatus,
  SubmissionDocumentType,
  SubmissionStatus,
  SubmissionType,
} from "../generated/prisma/client";

const CSV_FILENAME =
  "[Intern Copy] RERC Protocol Database 2024 - 2024 Submission.csv";

const safeTrim = (value: unknown) => String(value ?? "").trim();

const parseDate = (value?: string | null) => {
  const raw = safeTrim(value);
  if (!raw) return null;
  const mdy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    let year = Number(mdy[3]);
    if (year < 100) year += 2000;
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

const mapReviewType = (value: string | null | undefined) => {
  const normalized = safeTrim(value).toLowerCase();
  if (normalized.startsWith("exempt")) return ReviewType.EXEMPT;
  if (normalized.startsWith("expedit")) return ReviewType.EXPEDITED;
  if (normalized.startsWith("full")) return ReviewType.FULL_BOARD;
  return null;
};

const mapFundingType = (value: string | null | undefined) => {
  const normalized = safeTrim(value).toLowerCase();
  if (!normalized || normalized === "n/a") return FundingType.NO_FUNDING;
  if (normalized.includes("self")) return FundingType.SELF_FUNDED;
  if (normalized === "rgmo") return FundingType.INTERNAL;
  return FundingType.EXTERNAL;
};

const mapResearchType = (
  value: string | null | undefined,
  otherValue: string | null | undefined
) => {
  const normalized = safeTrim(value).toLowerCase();
  if (!normalized) return { type: null, other: null };
  if (normalized.includes("social")) {
    return { type: ResearchTypePHREB.SOCIAL_BEHAVIORAL, other: null };
  }
  if (normalized.includes("biomedical")) {
    return { type: ResearchTypePHREB.BIOMEDICAL, other: null };
  }
  if (normalized.includes("epidemiologic")) {
    return { type: ResearchTypePHREB.EPIDEMIOLOGICAL, other: null };
  }
  if (normalized.includes("public health")) {
    return { type: ResearchTypePHREB.PUBLIC_HEALTH, other: null };
  }
  if (normalized.includes("clinical")) {
    return { type: ResearchTypePHREB.CLINICAL_TRIAL, other: null };
  }
  if (normalized.includes("other")) {
    return {
      type: ResearchTypePHREB.OTHER,
      other: safeTrim(otherValue) || safeTrim(value),
    };
  }
  return {
    type: ResearchTypePHREB.OTHER,
    other: safeTrim(otherValue) || safeTrim(value),
  };
};

const mapSubmissionStatus = (
  statusValue: string | null | undefined,
  reviewValue: string | null | undefined,
  finishDate: Date | null,
  reviewType: ReviewType | null
) => {
  const status = safeTrim(statusValue).toLowerCase();
  const review = safeTrim(reviewValue).toLowerCase();
  if (status === "withdrawn" || review === "withdrawn") {
    return SubmissionStatus.WITHDRAWN;
  }
  if (status === "cleared") {
    return SubmissionStatus.CLOSED;
  }
  if (status === "exempted") {
    return finishDate ? SubmissionStatus.CLOSED : SubmissionStatus.CLASSIFIED;
  }
  if (reviewType === ReviewType.EXEMPT) {
    return SubmissionStatus.CLASSIFIED;
  }
  return SubmissionStatus.RECEIVED;
};

const mapProjectStatus = (status: SubmissionStatus) => {
  if (status === SubmissionStatus.WITHDRAWN) return ProjectStatus.WITHDRAWN;
  if (status === SubmissionStatus.CLOSED) return ProjectStatus.CLOSED;
  return ProjectStatus.ACTIVE;
};

const importLegacyCsv = async ({
  committeeId,
  raUserId,
  panelId,
}: {
  committeeId: number;
  raUserId: number;
  panelId: number | null;
}) => {
  const csvPath = path.resolve(process.cwd(), CSV_FILENAME);
  if (!fs.existsSync(csvPath)) {
    console.log(`CSV file not found at ${csvPath}. Skipping legacy import.`);
    return { importedCount: 0 };
  }

  const raw = fs.readFileSync(csvPath, "utf-8");
  const records: string[][] = parse(raw, {
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
    if (!projectCode) continue;

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
    const status = mapSubmissionStatus(
      statusLabel,
      reviewLabel,
      finishDate,
      reviewType
    );
    const finalDecision =
      statusLabel.toLowerCase() === "cleared" ||
      statusLabel.toLowerCase() === "exempted"
        ? ReviewDecision.APPROVED
        : null;
    const finalDecisionDate = finalDecision ? finishDate : null;

    const project = await prisma.project.upsert({
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

    const baseReceivedDate =
      receivedDate ?? finishDate ?? classificationDate ?? new Date();

    const existingSubmission = await prisma.submission.findFirst({
      where: {
        projectId: project.id,
        submissionType: SubmissionType.INITIAL,
        sequenceNumber: 1,
      },
    });

    const submissionData = {
      projectId: project.id,
      submissionType: SubmissionType.INITIAL,
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
      ? await prisma.submission.update({
          where: { id: existingSubmission.id },
          data: submissionData,
        })
      : await prisma.submission.create({ data: submissionData });

    if (reviewType && classificationDate) {
      await prisma.classification.upsert({
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

    const existingHistory = await prisma.submissionStatusHistory.findFirst({
      where: { submissionId: submission.id },
      select: { id: true },
    });
    if (!existingHistory) {
      await prisma.submissionStatusHistory.create({
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
  const raUser = await prisma.user.upsert({
    where: { email: "ra@example.com" },
    update: {},
    create: {
      email: "ra@example.com",
      fullName: "Research Associate",
    },
  });

  // 2) Ensure the main RERC committee exists
  const committee = await prisma.committee.upsert({
    where: { code: "RERC-HUMAN" },
    update: {},
    create: {
      name: "Research Ethics Review Committee – Human Participants",
      code: "RERC-HUMAN",
      description: "Main human participants research ethics committee",
    },
  });

  // 3) Ensure Panel 1 exists under that committee
  let panel1 = await prisma.panel.findFirst({
    where: { code: "P1", committeeId: committee.id },
  });
  if (!panel1) {
    panel1 = await prisma.panel.create({
      data: {
        name: "Panel 1",
        code: "P1",
        committeeId: committee.id,
      },
    });
  }

  // 4) Ensure the RA is a member of this committee
  await prisma.committeeMember.upsert({
    where: {
      committeeId_userId_role: {
        committeeId: committee.id,
        userId: raUser.id,
        role: RoleType.RESEARCH_ASSOCIATE,
      },
    },
    update: {
      isPrimary: true,
    },
    create: {
      committeeId: committee.id,
      userId: raUser.id,
      role: RoleType.RESEARCH_ASSOCIATE,
      isPrimary: true,
    },
  });

  // 5) Seed Config SLA rows if none exist for this committee
  const existingSlaCount = await prisma.configSLA.count({
    where: { committeeId: committee.id },
  });

  if (existingSlaCount === 0) {
    await prisma.configSLA.createMany({
      data: [
        {
          committeeId: committee.id,
          stage: SLAStage.CLASSIFICATION,
          reviewType: ReviewType.EXEMPT,
          workingDays: 3,
          description: "Exempt: classify within 3 working days",
        },
        {
          committeeId: committee.id,
          stage: SLAStage.CLASSIFICATION,
          reviewType: ReviewType.EXPEDITED,
          workingDays: 5,
          description: "Expedited: classify within 5 working days",
        },
        {
          committeeId: committee.id,
          stage: SLAStage.CLASSIFICATION,
          reviewType: ReviewType.FULL_BOARD,
          workingDays: 7,
          description: "Full board: classify within 7 working days",
        },
        {
          committeeId: committee.id,
          stage: SLAStage.REVIEW,
          reviewType: ReviewType.EXPEDITED,
          workingDays: 15,
          description: "Expedited review within 15 working days",
        },
        {
          committeeId: committee.id,
          stage: SLAStage.REVIEW,
          reviewType: ReviewType.FULL_BOARD,
          workingDays: 30,
          description: "Full board review within 30 working days",
        },
        {
          committeeId: committee.id,
          stage: SLAStage.REVISION_RESPONSE,
          reviewType: null,
          workingDays: 70,
          description:
            "Researchers have up to 70 working days to respond to revisions",
        },
      ],
    });

    console.log("Seeded default classification/review SLA for RERC-HUMAN");
  }

  type SlaSeedEntry = {
    committeeId: number;
    stage: SLAStage;
    reviewType: ReviewType | null;
    workingDays: number;
    description: string;
  };

  const membershipSlas: SlaSeedEntry[] = [
    {
      committeeId: committee.id,
      stage: SLAStage.MEMBERSHIP,
      reviewType: null,
      workingDays: 14,
      description: "SOP 1B Step 1: Request and receipt of recommendations",
    },
    {
      committeeId: committee.id,
      stage: SLAStage.MEMBERSHIP,
      reviewType: null,
      workingDays: 3,
      description:
        "SOP 1B Step 2: Nomination and endorsement of members for appointment",
    },
    {
      committeeId: committee.id,
      stage: SLAStage.MEMBERSHIP,
      reviewType: null,
      workingDays: 3,
      description:
        "SOP 1B Step 3: Receipt of appointment papers of new members",
    },
    {
      committeeId: committee.id,
      stage: SLAStage.MEMBERSHIP,
      reviewType: null,
      workingDays: 5,
      description:
        "SOP 1B Step 4: Forwarding of appointment papers to new members",
    },
    {
      committeeId: committee.id,
      stage: SLAStage.MEMBERSHIP,
      reviewType: null,
      workingDays: 5,
      description:
        "SOP 1B Step 5: Signing of conforme, confidentiality agreement, and COI declaration",
    },
    {
      committeeId: committee.id,
      stage: SLAStage.MEMBERSHIP,
      reviewType: null,
      workingDays: 1,
      description:
        "SOP 1B Step 6: Filing of appointment documents and CVs in membership file",
    },
  ];

  const meetingSlas: SlaSeedEntry[] = [
    {
      committeeId: committee.id,
      stage: SLAStage.MEETING,
      reviewType: null,
      workingDays: 1,
      description:
        "SOP 18B Step 1: Distribution of meeting materials for face-to-face meetings",
    },
    {
      committeeId: committee.id,
      stage: SLAStage.MEETING,
      reviewType: null,
      workingDays: 5,
      description:
        "SOP 18B Step 1: For online meetings, materials emailed at least 5 working days ahead of schedule",
    },
  ];

  const ensureSlaEntries = async (entries: SlaSeedEntry[], label: string) => {
    let createdCount = 0;
    for (const sla of entries) {
      const exists = await prisma.configSLA.findFirst({
        where: {
          committeeId: sla.committeeId,
          stage: sla.stage,
          description: sla.description,
        },
      });

      if (!exists) {
        await prisma.configSLA.create({ data: sla });
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
  await prisma.panelMember.upsert({
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
  const existingSubmissionCount = await prisma.submission.count({
    where: {
      project: {
        committeeId: committee.id,
      },
    },
  });

  if (allowDemoData && importedCount === 0 && existingSubmissionCount === 0) {
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const sampleSpecs: Array<{
      projectCode: string;
      title: string;
      piName: string;
      status: "RECEIVED" | "UNDER_REVIEW" | "AWAITING_REVISIONS";
      reviewType?: ReviewType;
    }> = [
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
        reviewType: ReviewType.EXPEDITED,
      },
      {
        projectCode: "2026-0003",
        title: "Sample Project (Awaiting Revisions)",
        piName: "Sample PI",
        status: "AWAITING_REVISIONS",
        reviewType: ReviewType.FULL_BOARD,
      },
    ];

    for (const spec of sampleSpecs) {
      const project = await prisma.project.upsert({
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

      const submission = await prisma.submission.create({
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
        await prisma.classification.create({
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
  const daysAgo = (days: number) =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const daysFromNow = (days: number) =>
    new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const workingDaysAgo = (days: number) => {
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

  const staffUser = await prisma.user.upsert({
    where: { email: "staff@rerc.demo" },
    update: { fullName: "Dashboard Staff", isCommonReviewer: false },
    create: {
      email: "staff@rerc.demo",
      fullName: "Dashboard Staff",
    },
  });

  const reviewerScientist = await prisma.user.upsert({
    where: { email: "reviewer.scientist@rerc.demo" },
    update: { fullName: "Dr. Mira Cruz", isCommonReviewer: true },
    create: {
      email: "reviewer.scientist@rerc.demo",
      fullName: "Dr. Mira Cruz",
      isCommonReviewer: true,
      reviewerExpertise: ["biomedical", "clinical"],
    },
  });

  const reviewerLay = await prisma.user.upsert({
    where: { email: "reviewer.lay@rerc.demo" },
    update: { fullName: "Josefina Reyes", isCommonReviewer: true },
    create: {
      email: "reviewer.lay@rerc.demo",
      fullName: "Josefina Reyes",
      isCommonReviewer: true,
      reviewerExpertise: ["community", "qualitative"],
    },
  });

  const reviewerConsultant = await prisma.user.upsert({
    where: { email: "reviewer.consultant@rerc.demo" },
    update: { fullName: "Dr. Paulo Santos", isCommonReviewer: true },
    create: {
      email: "reviewer.consultant@rerc.demo",
      fullName: "Dr. Paulo Santos",
      isCommonReviewer: true,
      reviewerExpertise: ["statistics"],
    },
  });

  const ensureProponent = async (printedName: string) => {
    const existing = await prisma.proponent.findFirst({
      where: { printedName },
    });
    if (existing) return existing;
    return prisma.proponent.create({
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
      status: SubmissionStatus.RECEIVED,
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
      status: SubmissionStatus.UNDER_REVIEW,
      reviewType: ReviewType.EXPEDITED,
    },
    {
      projectCode: "DASH-1003",
      title: "Urban Air Quality Monitoring",
      piName: "Ana Cruz",
      piSurname: "Cruz",
      piAffiliation: "DLSU Laguna",
      keywords: ["environment", "public-health"],
      receivedDate: daysAgo(40),
      status: SubmissionStatus.AWAITING_REVISIONS,
      reviewType: ReviewType.FULL_BOARD,
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
      status: SubmissionStatus.RECEIVED,
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
      status: SubmissionStatus.UNDER_REVIEW,
      reviewType: ReviewType.EXPEDITED,
    },
    {
      projectCode: "DASH-2003",
      title: "Due Soon Revision",
      piName: "Chloe Tan",
      piSurname: "Tan",
      piAffiliation: "DLSU Laguna",
      keywords: ["revision"],
      receivedDate: workingDaysAgo(5),
      status: SubmissionStatus.AWAITING_REVISIONS,
      reviewType: ReviewType.FULL_BOARD,
    },
  ];

  const ensureStatusHistory = async (
    submissionId: number,
    entries: Array<{
      oldStatus: SubmissionStatus | null;
      newStatus: SubmissionStatus;
      effectiveDate: Date;
      reason?: string;
    }>
  ) => {
    for (const entry of entries) {
      const exists = await prisma.submissionStatusHistory.findFirst({
        where: {
          submissionId,
          newStatus: entry.newStatus,
        },
      });
      if (!exists) {
        await prisma.submissionStatusHistory.create({
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
    const project = await prisma.project.upsert({
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
    const existingProponentLink = await prisma.projectProponent.findFirst({
      where: { projectId: project.id, proponentId: proponent.id },
    });
    if (!existingProponentLink) {
      await prisma.projectProponent.create({
        data: {
          projectId: project.id,
          proponentId: proponent.id,
          role: "Primary",
        },
      });
    }

    const existingMember = await prisma.projectMember.findFirst({
      where: { projectId: project.id, fullName: spec.piName },
    });
    if (!existingMember) {
      await prisma.projectMember.create({
        data: {
          projectId: project.id,
          fullName: spec.piName,
          role: ProjectMemberRole.PI,
          email: `${spec.piSurname.toLowerCase()}@example.com`,
          affiliation: spec.piAffiliation ?? "DLSU Manila",
        },
      });
    }

    const existingChange = await prisma.projectChangeLog.findFirst({
      where: { projectId: project.id, fieldName: "title" },
    });
    if (!existingChange) {
      await prisma.projectChangeLog.create({
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

    let submission = await prisma.submission.findFirst({
      where: {
        projectId: project.id,
        submissionType: SubmissionType.INITIAL,
        sequenceNumber: 1,
      },
    });

    if (!submission) {
      submission = await prisma.submission.create({
        data: {
          projectId: project.id,
          submissionType: SubmissionType.INITIAL,
          sequenceNumber: 1,
          receivedDate: spec.receivedDate,
          status: spec.status,
          createdById: raUser.id,
          staffInChargeId: staffUser.id,
          revisionDueDate:
            spec.status === SubmissionStatus.AWAITING_REVISIONS
              ? daysFromNow(5)
              : null,
        },
      });
    } else {
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          receivedDate: spec.receivedDate,
          status: spec.status,
          staffInChargeId: staffUser.id,
          revisionDueDate:
            spec.status === SubmissionStatus.AWAITING_REVISIONS
              ? daysFromNow(5)
              : null,
        },
      });
    }

    if (spec.reviewType) {
      const existingClassification = await prisma.classification.findUnique({
        where: { submissionId: submission.id },
      });
      if (!existingClassification) {
        await prisma.classification.create({
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
        newStatus: SubmissionStatus.RECEIVED,
        effectiveDate: daysAgo(40),
        reason: "Submission received",
      },
      {
        oldStatus: SubmissionStatus.RECEIVED,
        newStatus: spec.status,
        effectiveDate: spec.receivedDate,
        reason: "Moved to current stage",
      },
    ]);

    const docExists = await prisma.submissionDocument.findFirst({
      where: { submissionId: submission.id, type: SubmissionDocumentType.INFORMED_CONSENT },
    });
    if (!docExists) {
      await prisma.submissionDocument.create({
        data: {
          submissionId: submission.id,
          type: SubmissionDocumentType.INFORMED_CONSENT,
          title: "Informed Consent Form",
          status: SubmissionDocumentStatus.RECEIVED,
          receivedAt: daysAgo(10),
        },
      });
    }

    const letterDraftExists = await prisma.letterDraft.findFirst({
      where: { submissionId: submission.id, templateCode: "6B" },
    });
    if (!letterDraftExists) {
      await prisma.letterDraft.create({
        data: {
          submissionId: submission.id,
          templateCode: "6B",
          status: LetterDraftStatus.DRAFT,
          generatedById: raUser.id,
          notes: "Seeded draft for demo",
        },
      });
    }

    if (spec.status === SubmissionStatus.UNDER_REVIEW) {
      await prisma.review.upsert({
        where: {
          submissionId_reviewerId: {
            submissionId: submission.id,
            reviewerId: reviewerScientist.id,
          },
        },
        update: {
          reviewerRole: ReviewerRoleType.SCIENTIST,
          assignedAt: daysAgo(12),
          dueDate: daysAgo(7),
          respondedAt: null,
        },
        create: {
          submissionId: submission.id,
          reviewerId: reviewerScientist.id,
          reviewerRole: ReviewerRoleType.SCIENTIST,
          assignedAt: daysAgo(12),
          dueDate: daysAgo(7),
        },
      });

      await prisma.review.upsert({
        where: {
          submissionId_reviewerId: {
            submissionId: submission.id,
            reviewerId: reviewerLay.id,
          },
        },
        update: {
          reviewerRole: ReviewerRoleType.LAY,
          assignedAt: daysAgo(12),
          dueDate: daysAgo(6),
          respondedAt: null,
        },
        create: {
          submissionId: submission.id,
          reviewerId: reviewerLay.id,
          reviewerRole: ReviewerRoleType.LAY,
          assignedAt: daysAgo(12),
          dueDate: daysAgo(6),
        },
      });

      await prisma.review.upsert({
        where: {
          submissionId_reviewerId: {
            submissionId: submission.id,
            reviewerId: reviewerConsultant.id,
          },
        },
        update: {
          reviewerRole: ReviewerRoleType.INDEPENDENT_CONSULTANT,
          assignedAt: daysAgo(10),
          dueDate: daysAgo(5),
          endorsementStatus: EndorsementStatus.PENDING,
        },
        create: {
          submissionId: submission.id,
          reviewerId: reviewerConsultant.id,
          reviewerRole: ReviewerRoleType.INDEPENDENT_CONSULTANT,
          assignedAt: daysAgo(10),
          dueDate: daysAgo(5),
          endorsementStatus: EndorsementStatus.PENDING,
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
    await prisma.$disconnect();
  });
