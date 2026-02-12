import "dotenv/config";
import prisma from "./prismaClient";
import {
  CompletenessStatus,
  FundingType,
  ProjectStatus,
  ProponentCategory,
  ResearchTypePHREB,
  ReviewDecision,
  ReviewType,
  SubmissionStatus,
  SubmissionType,
} from "../generated/prisma/client";

type DemoSubmissionSeed = {
  projectCode: string;
  title: string;
  piName: string;
  piSurname: string;
  collegeOrUnit: string;
  proponentCategory: ProponentCategory;
  fundingType: FundingType;
  researchType: ResearchTypePHREB;
  receivedDate: Date;
  status: SubmissionStatus;
  reviewType: ReviewType | null;
  finalDecision: ReviewDecision | null;
  finalDecisionDate: Date | null;
  approvalStartDate: Date | null;
  history: Array<{ newStatus: SubmissionStatus; effectiveDate: Date }>;
};

const date = (value: string) => new Date(value);

const termSeeds = [
  {
    academicYear: "2025-2026",
    term: 1,
    startDate: date("2025-06-01T00:00:00.000Z"),
    endDate: date("2025-09-30T00:00:00.000Z"),
  },
  {
    academicYear: "2025-2026",
    term: 2,
    startDate: date("2025-10-01T00:00:00.000Z"),
    endDate: date("2026-01-31T00:00:00.000Z"),
  },
  {
    academicYear: "2025-2026",
    term: 3,
    startDate: date("2026-02-01T00:00:00.000Z"),
    endDate: date("2026-05-31T00:00:00.000Z"),
  },
];

const holidaySeeds = [
  { date: date("2025-06-12T00:00:00.000Z"), name: "Independence Day" },
  { date: date("2025-08-21T00:00:00.000Z"), name: "Ninoy Aquino Day" },
  { date: date("2025-11-01T00:00:00.000Z"), name: "All Saints' Day" },
  { date: date("2025-12-25T00:00:00.000Z"), name: "Christmas Day" },
  { date: date("2026-01-01T00:00:00.000Z"), name: "New Year's Day" },
];

const demoSubmissions: DemoSubmissionSeed[] = [
  {
    projectCode: "DEMO-RPT-001",
    title: "Community Nutrition Mapping",
    piName: "Maria Santos",
    piSurname: "Santos",
    collegeOrUnit: "College of Science",
    proponentCategory: ProponentCategory.FACULTY,
    fundingType: FundingType.INTERNAL,
    researchType: ResearchTypePHREB.PUBLIC_HEALTH,
    receivedDate: date("2025-06-10T00:00:00.000Z"),
    status: SubmissionStatus.CLOSED,
    reviewType: ReviewType.EXPEDITED,
    finalDecision: ReviewDecision.APPROVED,
    finalDecisionDate: date("2025-06-19T00:00:00.000Z"),
    approvalStartDate: date("2025-06-19T00:00:00.000Z"),
    history: [
      { newStatus: SubmissionStatus.RECEIVED, effectiveDate: date("2025-06-10T00:00:00.000Z") },
      { newStatus: SubmissionStatus.UNDER_REVIEW, effectiveDate: date("2025-06-13T00:00:00.000Z") },
      { newStatus: SubmissionStatus.CLOSED, effectiveDate: date("2025-06-19T00:00:00.000Z") },
    ],
  },
  {
    projectCode: "DEMO-RPT-002",
    title: "Student Sleep Quality Survey",
    piName: "Jerome Dela Cruz",
    piSurname: "Dela Cruz",
    collegeOrUnit: "College of Liberal Arts",
    proponentCategory: ProponentCategory.UNDERGRAD,
    fundingType: FundingType.NO_FUNDING,
    researchType: ResearchTypePHREB.SOCIAL_BEHAVIORAL,
    receivedDate: date("2025-07-08T00:00:00.000Z"),
    status: SubmissionStatus.CLOSED,
    reviewType: ReviewType.EXEMPT,
    finalDecision: ReviewDecision.APPROVED,
    finalDecisionDate: date("2025-07-14T00:00:00.000Z"),
    approvalStartDate: date("2025-07-14T00:00:00.000Z"),
    history: [
      { newStatus: SubmissionStatus.RECEIVED, effectiveDate: date("2025-07-08T00:00:00.000Z") },
      { newStatus: SubmissionStatus.UNDER_REVIEW, effectiveDate: date("2025-07-10T00:00:00.000Z") },
      { newStatus: SubmissionStatus.CLOSED, effectiveDate: date("2025-07-14T00:00:00.000Z") },
    ],
  },
  {
    projectCode: "DEMO-RPT-003",
    title: "Healthcare AI Triage Pilot",
    piName: "Angela Reyes",
    piSurname: "Reyes",
    collegeOrUnit: "Gokongwei College of Engineering",
    proponentCategory: ProponentCategory.GRAD,
    fundingType: FundingType.EXTERNAL,
    researchType: ResearchTypePHREB.CLINICAL_TRIAL,
    receivedDate: date("2025-09-02T00:00:00.000Z"),
    status: SubmissionStatus.AWAITING_REVISIONS,
    reviewType: ReviewType.FULL_BOARD,
    finalDecision: null,
    finalDecisionDate: null,
    approvalStartDate: null,
    history: [
      { newStatus: SubmissionStatus.RECEIVED, effectiveDate: date("2025-09-02T00:00:00.000Z") },
      { newStatus: SubmissionStatus.UNDER_REVIEW, effectiveDate: date("2025-09-08T00:00:00.000Z") },
      { newStatus: SubmissionStatus.AWAITING_REVISIONS, effectiveDate: date("2025-09-16T00:00:00.000Z") },
    ],
  },
  {
    projectCode: "DEMO-RPT-004",
    title: "Food Safety in School Canteens",
    piName: "Noel Garcia",
    piSurname: "Garcia",
    collegeOrUnit: "College of Science",
    proponentCategory: ProponentCategory.FACULTY,
    fundingType: FundingType.INTERNAL,
    researchType: ResearchTypePHREB.PUBLIC_HEALTH,
    receivedDate: date("2025-09-15T00:00:00.000Z"),
    status: SubmissionStatus.WITHDRAWN,
    reviewType: ReviewType.FULL_BOARD,
    finalDecision: null,
    finalDecisionDate: null,
    approvalStartDate: null,
    history: [
      { newStatus: SubmissionStatus.RECEIVED, effectiveDate: date("2025-09-15T00:00:00.000Z") },
      { newStatus: SubmissionStatus.UNDER_REVIEW, effectiveDate: date("2025-09-19T00:00:00.000Z") },
      { newStatus: SubmissionStatus.WITHDRAWN, effectiveDate: date("2025-09-24T00:00:00.000Z") },
    ],
  },
  {
    projectCode: "DEMO-RPT-005",
    title: "Campus Emergency Response Drill Study",
    piName: "Patricia Tan",
    piSurname: "Tan",
    collegeOrUnit: "Office of Campus Services",
    proponentCategory: ProponentCategory.OTHER,
    fundingType: FundingType.INTERNAL,
    researchType: ResearchTypePHREB.EPIDEMIOLOGICAL,
    receivedDate: date("2025-10-12T00:00:00.000Z"),
    status: SubmissionStatus.UNDER_REVIEW,
    reviewType: ReviewType.EXPEDITED,
    finalDecision: null,
    finalDecisionDate: null,
    approvalStartDate: null,
    history: [
      { newStatus: SubmissionStatus.RECEIVED, effectiveDate: date("2025-10-12T00:00:00.000Z") },
      { newStatus: SubmissionStatus.UNDER_REVIEW, effectiveDate: date("2025-10-16T00:00:00.000Z") },
    ],
  },
  {
    projectCode: "DEMO-RPT-006",
    title: "Learning Analytics Consent Evaluation",
    piName: "Eric Ong",
    piSurname: "Ong",
    collegeOrUnit: "College of Computer Studies",
    proponentCategory: ProponentCategory.GRAD,
    fundingType: FundingType.SELF_FUNDED,
    researchType: ResearchTypePHREB.SOCIAL_BEHAVIORAL,
    receivedDate: date("2025-11-05T00:00:00.000Z"),
    status: SubmissionStatus.CLOSED,
    reviewType: ReviewType.EXEMPT,
    finalDecision: ReviewDecision.APPROVED,
    finalDecisionDate: date("2025-11-13T00:00:00.000Z"),
    approvalStartDate: date("2025-11-13T00:00:00.000Z"),
    history: [
      { newStatus: SubmissionStatus.RECEIVED, effectiveDate: date("2025-11-05T00:00:00.000Z") },
      { newStatus: SubmissionStatus.UNDER_REVIEW, effectiveDate: date("2025-11-08T00:00:00.000Z") },
      { newStatus: SubmissionStatus.CLOSED, effectiveDate: date("2025-11-13T00:00:00.000Z") },
    ],
  },
  {
    projectCode: "DEMO-RPT-007",
    title: "Telemedicine Follow-up Framework",
    piName: "Andrea Lim",
    piSurname: "Lim",
    collegeOrUnit: "College of Science",
    proponentCategory: ProponentCategory.FACULTY,
    fundingType: FundingType.EXTERNAL,
    researchType: ResearchTypePHREB.BIOMEDICAL,
    receivedDate: date("2026-01-18T00:00:00.000Z"),
    status: SubmissionStatus.REVISION_SUBMITTED,
    reviewType: ReviewType.FULL_BOARD,
    finalDecision: null,
    finalDecisionDate: null,
    approvalStartDate: null,
    history: [
      { newStatus: SubmissionStatus.RECEIVED, effectiveDate: date("2026-01-18T00:00:00.000Z") },
      { newStatus: SubmissionStatus.UNDER_REVIEW, effectiveDate: date("2026-01-21T00:00:00.000Z") },
      { newStatus: SubmissionStatus.AWAITING_REVISIONS, effectiveDate: date("2026-01-28T00:00:00.000Z") },
      { newStatus: SubmissionStatus.REVISION_SUBMITTED, effectiveDate: date("2026-02-04T00:00:00.000Z") },
    ],
  },
  {
    projectCode: "DEMO-RPT-008",
    title: "Barangay Mental Health Assessment",
    piName: "Louise Aquino",
    piSurname: "Aquino",
    collegeOrUnit: "College of Liberal Arts",
    proponentCategory: ProponentCategory.UNDERGRAD,
    fundingType: FundingType.NO_FUNDING,
    researchType: ResearchTypePHREB.PUBLIC_HEALTH,
    receivedDate: date("2026-02-10T00:00:00.000Z"),
    status: SubmissionStatus.CLOSED,
    reviewType: ReviewType.EXPEDITED,
    finalDecision: ReviewDecision.APPROVED,
    finalDecisionDate: date("2026-02-18T00:00:00.000Z"),
    approvalStartDate: date("2026-02-18T00:00:00.000Z"),
    history: [
      { newStatus: SubmissionStatus.RECEIVED, effectiveDate: date("2026-02-10T00:00:00.000Z") },
      { newStatus: SubmissionStatus.UNDER_REVIEW, effectiveDate: date("2026-02-13T00:00:00.000Z") },
      { newStatus: SubmissionStatus.CLOSED, effectiveDate: date("2026-02-18T00:00:00.000Z") },
    ],
  },
  {
    projectCode: "DEMO-RPT-009",
    title: "Digital Literacy Baseline Study",
    piName: "Carlo Rivera",
    piSurname: "Rivera",
    collegeOrUnit: "College of Computer Studies",
    proponentCategory: ProponentCategory.OTHER,
    fundingType: FundingType.INTERNAL,
    researchType: ResearchTypePHREB.OTHER,
    receivedDate: date("2026-03-03T00:00:00.000Z"),
    status: SubmissionStatus.RECEIVED,
    reviewType: null,
    finalDecision: null,
    finalDecisionDate: null,
    approvalStartDate: null,
    history: [{ newStatus: SubmissionStatus.RECEIVED, effectiveDate: date("2026-03-03T00:00:00.000Z") }],
  },
  {
    projectCode: "DEMO-RPT-010",
    title: "Clinical Documentation Improvement Study",
    piName: "Donna Pineda",
    piSurname: "Pineda",
    collegeOrUnit: "College of Science",
    proponentCategory: ProponentCategory.GRAD,
    fundingType: FundingType.EXTERNAL,
    researchType: ResearchTypePHREB.CLINICAL_TRIAL,
    receivedDate: date("2026-04-08T00:00:00.000Z"),
    status: SubmissionStatus.WITHDRAWN,
    reviewType: ReviewType.FULL_BOARD,
    finalDecision: null,
    finalDecisionDate: null,
    approvalStartDate: null,
    history: [
      { newStatus: SubmissionStatus.RECEIVED, effectiveDate: date("2026-04-08T00:00:00.000Z") },
      { newStatus: SubmissionStatus.UNDER_REVIEW, effectiveDate: date("2026-04-12T00:00:00.000Z") },
      { newStatus: SubmissionStatus.WITHDRAWN, effectiveDate: date("2026-04-17T00:00:00.000Z") },
    ],
  },
];

async function seedAcademicTerms() {
  for (const term of termSeeds) {
    const existing = await prisma.academicTerm.findFirst({
      where: {
        academicYear: term.academicYear,
        term: term.term,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.academicTerm.update({
        where: { id: existing.id },
        data: {
          startDate: term.startDate,
          endDate: term.endDate,
        },
      });
      continue;
    }

    await prisma.academicTerm.create({ data: term });
  }
}

async function seedHolidays() {
  for (const holiday of holidaySeeds) {
    const existing = await prisma.holiday.findFirst({
      where: { date: holiday.date },
      select: { id: true },
    });

    if (existing) {
      await prisma.holiday.update({
        where: { id: existing.id },
        data: { name: holiday.name },
      });
      continue;
    }

    await prisma.holiday.create({ data: holiday });
  }
}

async function seedReportSubmissions() {
  let committee = await prisma.committee.findFirst({
    where: { code: "RERC-HUMAN" },
    select: { id: true },
  });
  if (!committee) {
    committee = await prisma.committee.create({
      data: {
        code: "RERC-HUMAN",
        name: "RERC Human Research Ethics Committee",
        description: "Demo committee for reports",
        isActive: true,
      },
      select: { id: true },
    });
  }

  for (const item of demoSubmissions) {
    const existingProject = await prisma.project.findFirst({
      where: { projectCode: item.projectCode },
      select: { id: true },
    });

    const projectData = {
      title: item.title,
      piName: item.piName,
      piSurname: item.piSurname,
      piAffiliation: item.collegeOrUnit,
      collegeOrUnit: item.collegeOrUnit,
      proponentCategory: item.proponentCategory,
      fundingType: item.fundingType,
      researchTypePHREB: item.researchType,
      initialSubmissionDate: item.receivedDate,
      committeeId: committee.id,
      overallStatus:
        item.status === SubmissionStatus.CLOSED
          ? ProjectStatus.ACTIVE
          : item.status === SubmissionStatus.WITHDRAWN
            ? ProjectStatus.WITHDRAWN
            : ProjectStatus.DRAFT,
      approvalStartDate: item.approvalStartDate,
    };

    const project = existingProject
      ? await prisma.project.update({
          where: { id: existingProject.id },
          data: projectData,
        })
      : await prisma.project.create({
          data: {
            projectCode: item.projectCode,
            ...projectData,
          },
        });

    const existingSubmission = await prisma.submission.findFirst({
      where: {
        projectId: project.id,
        sequenceNumber: 1,
      },
      select: { id: true },
    });

    const submissionData = {
      projectId: project.id,
      submissionType: SubmissionType.INITIAL,
      sequenceNumber: 1,
      receivedDate: item.receivedDate,
      completenessStatus: CompletenessStatus.COMPLETE,
      status: item.status,
      finalDecision: item.finalDecision,
      finalDecisionDate: item.finalDecisionDate,
    };

    const submission = existingSubmission
      ? await prisma.submission.update({
          where: { id: existingSubmission.id },
          data: submissionData,
        })
      : await prisma.submission.create({
          data: submissionData,
        });

    const existingClassification = await prisma.classification.findFirst({
      where: { submissionId: submission.id },
      select: { id: true },
    });

    if (item.reviewType) {
      const classificationData = {
        submissionId: submission.id,
        reviewType: item.reviewType,
        classificationDate: item.history[1]?.effectiveDate ?? item.receivedDate,
        rationale: "Demo report seed",
      };

      if (existingClassification) {
        await prisma.classification.update({
          where: { id: existingClassification.id },
          data: classificationData,
        });
      } else {
        await prisma.classification.create({
          data: classificationData,
        });
      }
    } else if (existingClassification) {
      await prisma.classification.delete({
        where: { id: existingClassification.id },
      });
    }

    await prisma.submissionStatusHistory.deleteMany({
      where: { submissionId: submission.id },
    });

    await prisma.submissionStatusHistory.createMany({
      data: item.history.map((entry, index) => ({
        submissionId: submission.id,
        oldStatus: index === 0 ? null : item.history[index - 1].newStatus,
        newStatus: entry.newStatus,
        effectiveDate: entry.effectiveDate,
        reason: "Demo report seed",
      })),
    });
  }
}

async function main() {
  await seedAcademicTerms();
  await seedHolidays();
  await seedReportSubmissions();

  console.log("Report demo seed complete.");
  console.log("Created/updated:");
  console.log("- 3 academic terms for 2025-2026");
  console.log(`- ${holidaySeeds.length} holidays`);
  console.log(`- ${demoSubmissions.length} report demo submissions`);
  console.log("");
  console.log("Try:");
  console.log(
    "GET /reports/academic-year-summary?academicYear=2025-2026&term=ALL&committeeCode=RERC-HUMAN"
  );
}

main()
  .catch((error) => {
    console.error("Failed to seed report demo data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
