import "dotenv/config";
import prisma from "./prismaClient";
import { RoleType, ReviewType, SLAStage } from "../generated/prisma/client";

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

  // --- Optional demo data so the dashboard has something to display ---
  // Create a few sample projects/submissions if none exist yet.
  const existingSubmissionCount = await prisma.submission.count({
    where: {
      project: {
        committeeId: committee.id,
      },
    },
  });

  if (existingSubmissionCount === 0) {
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
}

main()
  .catch((e) => {
    console.error("Seed error", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
