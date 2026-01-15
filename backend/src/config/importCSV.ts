import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import prisma from "./prismaClient";
import {
  FundingType,
  ReviewType,
  SubmissionType,
  SubmissionStatus,
  ProjectStatus,
  ReviewDecision,
} from "../generated/prisma/client";
import {
  ResearchTypePHREB,
  ReviewerRoleType,
  HonorariumStatus,
} from "../generated/prisma/enums";

// Parse date from various formats in CSV
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === "" || dateStr === "-") return null;

  const cleaned = dateStr.trim();

  // Try MM/DD/YYYY format
  const parts = cleaned.split("/");
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    
    // Handle 2-digit years
    if (year < 100) {
      year = year > 50 ? 1900 + year : 2000 + year;
    }
    
    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      return new Date(year, month - 1, day);
    }
  }

  // Try other formats
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Map CSV funding to enum
function mapFunding(funding: string): FundingType {
  const f = funding?.toLowerCase().trim() || "";
  if (f.includes("rgmo") && !f.includes("non-rgmo")) return FundingType.INTERNAL;
  if (f.includes("non-rgmo") || f.includes("government") || f.includes("research grant"))
    return FundingType.EXTERNAL;
  if (f.includes("self")) return FundingType.SELF_FUNDED;
  if (f.includes("n/a") || f === "") return FundingType.NO_FUNDING;
  return FundingType.EXTERNAL;
}

// Map CSV review type to enum
function mapReviewType(type: string): ReviewType | null {
  const t = type?.toLowerCase().trim() || "";
  if (t.includes("exempt")) return ReviewType.EXEMPT;
  if (t.includes("expedited")) return ReviewType.EXPEDITED;
  if (t.includes("full")) return ReviewType.FULL_BOARD;
  return null;
}

// Map CSV status to submission status and decision
function mapStatus(status: string): {
  submissionStatus: SubmissionStatus;
  decision: ReviewDecision | null;
} {
  const s = status?.toLowerCase().trim() || "";
  if (s.includes("cleared") || s.includes("exempted")) {
    return { submissionStatus: SubmissionStatus.CLOSED, decision: ReviewDecision.APPROVED };
  }
  if (s.includes("withdrawn")) {
    return { submissionStatus: SubmissionStatus.WITHDRAWN, decision: null };
  }
  return { submissionStatus: SubmissionStatus.RECEIVED, decision: null };
}

// Map PHREB research type
function mapResearchType(type: string): ResearchTypePHREB | null {
  const t = type?.toLowerCase().trim() || "";
  if (t.includes("biomedical")) return ResearchTypePHREB.BIOMEDICAL;
  if (t.includes("social") || t.includes("behavioral")) return ResearchTypePHREB.SOCIAL_BEHAVIORAL;
  if (t.includes("public health") || t.includes("epidemiolog"))
    return ResearchTypePHREB.PUBLIC_HEALTH;
  if (t.includes("clinical")) return ResearchTypePHREB.CLINICAL_TRIAL;
  if (t !== "" && t !== "others") return ResearchTypePHREB.OTHER;
  return null;
}

// Map honorarium status
function mapHonorariumStatus(status: string): HonorariumStatus {
  const s = status?.toLowerCase().trim() || "";
  if (s.includes("paid")) return HonorariumStatus.PAID;
  if (s.includes("processing")) return HonorariumStatus.PROCESSING;
  if (s.includes("pending")) return HonorariumStatus.PENDING;
  return HonorariumStatus.NOT_APPLICABLE;
}

async function importCSV() {
  console.log("🚀 Starting CSV import...\n");

  // Read CSV file
  const csvPath = path.join(
    __dirname,
    "../../../[Intern Copy] RERC Protocol Database 2024 - 2024 Submission.csv"
  );

  if (!fs.existsSync(csvPath)) {
    console.error("❌ CSV file not found at:", csvPath);
    return;
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");

  // Parse CSV with proper handling of multi-line fields
  const records = parse(csvContent, {
    columns: false, // We'll handle columns manually
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  console.log(`📊 Found ${records.length} total rows (including header)\n`);

  // First row is header, skip it
  const dataRows = records.slice(1);
  console.log(`📊 Processing ${dataRows.length} data rows\n`);

  // Ensure committee exists
  const committee = await prisma.committee.upsert({
    where: { code: "RERC-HUMAN" },
    update: {},
    create: {
      name: "Research Ethics Review Committee – Human Participants",
      code: "RERC-HUMAN",
      description: "Main human participants research ethics committee",
    },
  });

  // Create panels
  const panelMap: Record<string, number> = {};
  for (const panelName of ["Panel 1", "Panel 2", "Panel 3"]) {
    let panel = await prisma.panel.findFirst({
      where: { name: panelName, committeeId: committee.id },
    });
    if (!panel) {
      panel = await prisma.panel.create({
        data: {
          name: panelName,
          code: panelName.replace(" ", ""),
          committeeId: committee.id,
        },
      });
    }
    panelMap[panelName.toLowerCase()] = panel.id;
  }

  // Track created reviewers
  const reviewerMap: Record<string, number> = {};

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];

    // Column indices based on CSV structure:
    // 0: Project Code (2025)
    // 1: Title
    // 2: Project Leader
    // 3: College
    // 4: Department
    // 5: Date of Submission
    // 6: Month of Submission
    // 7: Type of Review
    // 8: Proponent
    // 9: Funding
    // 10: Type of Research PHREB
    // 11: Type of Research PHREB (Specific)
    // 12: Status
    // 13: Finish Date
    // 14: Month of Clearance
    // 15: Review Duration
    // 16: Remarks
    // 17: Panel
    // 18: Scientist Reviewer
    // 19: Lay Reviewer
    // 20: Independent Consultant
    // 21: Honorarium Status
    // 22: Classification Date

    const projectCode = row[0]?.trim();
    const title = row[1]?.trim();
    const piName = row[2]?.trim();
    const college = row[3]?.trim();
    const department = row[4]?.trim();
    const submissionDateStr = row[5]?.trim();
    const reviewTypeStr = row[7]?.trim();
    const proponent = row[8]?.trim();
    const funding = row[9]?.trim();
    const researchTypePHREB = row[10]?.trim();
    const researchTypePHREBOther = row[11]?.trim();
    const status = row[12]?.trim();
    const finishDateStr = row[13]?.trim();
    const remarks = row[16]?.trim();
    const panelName = row[17]?.trim();
    const scientistReviewer = row[18]?.trim();
    const layReviewer = row[19]?.trim();
    const independentConsultant = row[20]?.trim();
    const honorariumStatus = row[21]?.trim();
    const classificationDateStr = row[22]?.trim();

    // Skip if no valid project code (should be like 2023-001C)
    if (!projectCode || !projectCode.match(/^\d{4}-\d{3}[A-Z]?$/)) {
      console.log(`⏭️  Skipping row ${i + 2}: Invalid project code "${projectCode}"`);
      skipped++;
      continue;
    }

    try {
      // Parse dates
      const submissionDate = parseDate(submissionDateStr);
      const finishDate = parseDate(finishDateStr);
      const classificationDate = parseDate(classificationDateStr);

      // Map enums
      const fundingType = mapFunding(funding);
      const reviewType = mapReviewType(reviewTypeStr);
      const { submissionStatus, decision } = mapStatus(status);
      const researchType = mapResearchType(researchTypePHREB);

      // Determine project status
      let projectStatus: ProjectStatus = ProjectStatus.ACTIVE;
      if (submissionStatus === SubmissionStatus.CLOSED) {
        projectStatus = ProjectStatus.CLOSED;
      } else if (submissionStatus === SubmissionStatus.WITHDRAWN) {
        projectStatus = ProjectStatus.WITHDRAWN;
      }

      // Create or update project
      const project = await prisma.project.upsert({
        where: { projectCode },
        update: {
          title: title || "Untitled",
          piName: piName || "Unknown",
          piAffiliation: college || null,
          department: department || null,
          proponent: proponent || null,
          researchTypePHREB: researchType,
          researchTypePHREBOther: researchTypePHREBOther || null,
          fundingType,
          overallStatus: projectStatus,
        },
        create: {
          projectCode,
          title: title || "Untitled",
          piName: piName || "Unknown",
          piAffiliation: college || null,
          department: department || null,
          proponent: proponent || null,
          researchTypePHREB: researchType,
          researchTypePHREBOther: researchTypePHREBOther || null,
          fundingType,
          committeeId: committee.id,
          initialSubmissionDate: submissionDate,
          overallStatus: projectStatus,
          approvalStartDate: finishDate,
          approvalEndDate: finishDate
            ? new Date(finishDate.getTime() + 365 * 24 * 60 * 60 * 1000)
            : null,
        },
      });

      // Find or create submission
      let submission = await prisma.submission.findFirst({
        where: { projectId: project.id, submissionType: SubmissionType.INITIAL },
      });

      if (!submission) {
        submission = await prisma.submission.create({
          data: {
            projectId: project.id,
            submissionType: SubmissionType.INITIAL,
            sequenceNumber: 1,
            receivedDate: submissionDate || new Date(),
            status: submissionStatus,
            finalDecision: decision,
            finalDecisionDate: finishDate,
            remarks: remarks || null,
          },
        });
      } else {
        submission = await prisma.submission.update({
          where: { id: submission.id },
          data: {
            status: submissionStatus,
            finalDecision: decision,
            finalDecisionDate: finishDate,
            remarks: remarks || null,
          },
        });
      }

      // Create classification if review type exists
      if (reviewType) {
        const panelId = panelName ? panelMap[panelName.toLowerCase()] : null;

        await prisma.classification.upsert({
          where: { submissionId: submission.id },
          update: {
            reviewType,
            classificationDate: classificationDate || submissionDate || new Date(),
            panelId,
          },
          create: {
            submissionId: submission.id,
            reviewType,
            classificationDate: classificationDate || submissionDate || new Date(),
            panelId,
          },
        });
      }

      // Helper to create reviewer and review
      const createReviewerAndReview = async (
        name: string,
        role: ReviewerRoleType,
        honorarium: string
      ) => {
        if (!name || name.trim() === "") return;

        const cleanName = name.trim();
        let reviewerId = reviewerMap[cleanName];

        if (!reviewerId) {
          const email =
            cleanName
              .toLowerCase()
              .replace(/[^a-z0-9]/g, ".")
              .replace(/\.+/g, ".")
              .replace(/^\.+|\.+$/g, "") + "@dlsu.edu.ph";

          const reviewer = await prisma.user.upsert({
            where: { email },
            update: { fullName: cleanName },
            create: { email, fullName: cleanName },
          });
          reviewerId = reviewer.id;
          reviewerMap[cleanName] = reviewerId;
        }

        // Check if review already exists
        const existingReview = await prisma.review.findUnique({
          where: {
            submissionId_reviewerId: {
              submissionId: submission!.id,
              reviewerId,
            },
          },
        });

        if (!existingReview) {
          await prisma.review.create({
            data: {
              submissionId: submission!.id,
              reviewerId,
              reviewerRole: role,
              honorariumStatus: mapHonorariumStatus(honorarium),
              isPrimary: role === ReviewerRoleType.SCIENTIST,
              decision: decision,
              respondedAt: finishDate,
            },
          });
        }
      };

      // Create reviews for each reviewer type
      await createReviewerAndReview(scientistReviewer, ReviewerRoleType.SCIENTIST, honorariumStatus);
      await createReviewerAndReview(layReviewer, ReviewerRoleType.LAY, honorariumStatus);
      await createReviewerAndReview(
        independentConsultant,
        ReviewerRoleType.INDEPENDENT_CONSULTANT,
        honorariumStatus
      );

      imported++;
      if (imported % 20 === 0) {
        console.log(`✅ Imported ${imported} projects...`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Error importing ${projectCode}:`, error);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Import Summary:");
  console.log(`   ✅ Imported: ${imported}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log("=".repeat(50));
}

// Run import
importCSV()
  .then(() => {
    console.log("\n🎉 Import completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
