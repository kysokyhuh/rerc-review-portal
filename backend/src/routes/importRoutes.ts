import { Router } from "express";
import multer, { MulterError } from "multer";
import prisma from "../config/prismaClient";
import { RoleType } from "../generated/prisma/client";
import { requireRoles } from "../middleware/auth";
import {
  CsvImportError,
  DEFAULT_IMPORT_CONFIG,
  PROJECT_IMPORT_HEADERS,
  buildPreviewPayload,
  chunkRows,
  normalizeCommitMapping,
  normalizeProjectCode,
  parseProjectCsvUnknownFormat,
  suggestColumnMapping,
  validateMappedProjectRows,
} from "../services/imports/projectCsvImport";
import {
  createProjectWithInitialSubmission,
  DuplicateProjectCodeError,
  ProjectCreateValidationError,
} from "../services/projects/createProjectWithInitialSubmission";

const MAX_FILE_SIZE_MB = Number(process.env.IMPORT_MAX_FILE_SIZE_MB || 5);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

const router = Router();

const normalizeHeader = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const pickRawValue = (raw: Record<string, string>, candidates: string[]) => {
  const lookup = new Map<string, string>();
  for (const [header, value] of Object.entries(raw)) {
    lookup.set(normalizeHeader(header), value);
  }
  for (const candidate of candidates) {
    const match = lookup.get(normalizeHeader(candidate));
    if (typeof match === "string" && match.trim()) {
      return match.trim();
    }
  }
  return null;
};

const parseLooseDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseLooseInt = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

type RowEditPayload = Array<{
  rowNumber: number;
  values: Record<string, string>;
}>;

const parseRowEditsPayload = (value: unknown): RowEditPayload => {
  if (!value) return [];
  let parsedValue: unknown = value;
  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      throw new CsvImportError("Invalid row edits JSON.");
    }
  }
  if (!Array.isArray(parsedValue)) {
    throw new CsvImportError("Invalid row edits payload.");
  }
  const edits: RowEditPayload = [];
  for (const item of parsedValue) {
    if (!item || typeof item !== "object") continue;
    const rowNumber = Number((item as any).rowNumber);
    const values = (item as any).values;
    if (!Number.isInteger(rowNumber) || !values || typeof values !== "object") continue;
    const normalizedValues: Record<string, string> = {};
    for (const [key, val] of Object.entries(values as Record<string, unknown>)) {
      if (typeof val === "string") {
        normalizedValues[key] = val;
      }
    }
    edits.push({ rowNumber, values: normalizedValues });
  }
  return edits;
};

const uploadSingleFile = (req: any, res: any, next: any) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`,
      });
    }
    return res.status(400).json({
      message: "Failed to process upload.",
    });
  });
};

const getUploadFileOrThrow = (req: any) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    throw new CsvImportError("CSV file is required.", 400);
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new CsvImportError("Unsupported file type. Please upload a CSV file.", 415);
  }
  if (!file.size) {
    throw new CsvImportError("CSV file is empty.", 400);
  }
  return file;
};

router.post(
  "/imports/projects/preview",
  requireRoles([RoleType.ADMIN, RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  uploadSingleFile,
  async (req, res) => {
    try {
      const file = getUploadFileOrThrow(req);
      const parsed = parseProjectCsvUnknownFormat(file.buffer, DEFAULT_IMPORT_CONFIG);
      const preview = buildPreviewPayload(parsed, DEFAULT_IMPORT_CONFIG);
      return res.json(preview);
    } catch (error) {
      if (error instanceof CsvImportError) {
        return res.status(error.status).json({
          message: error.message,
          details: error.details,
        });
      }
      return res.status(500).json({ message: "Preview failed." });
    }
  }
);

router.post(
  "/imports/projects/commit",
  requireRoles([RoleType.ADMIN, RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  uploadSingleFile,
  async (req, res) => {
    try {
      const file = getUploadFileOrThrow(req);
      const parsed = parseProjectCsvUnknownFormat(file.buffer, DEFAULT_IMPORT_CONFIG);
      const rowEdits = parseRowEditsPayload(req.body?.rowEdits);
      if (rowEdits.length > 0) {
        const byRow = new Map(parsed.rows.map((row) => [row.rowNumber, row]));
        for (const edit of rowEdits) {
          const target = byRow.get(edit.rowNumber);
          if (!target) continue;
          for (const [header, value] of Object.entries(edit.values)) {
            if (header in target.raw) {
              target.raw[header] = value;
            }
          }
        }
      }
      const mapping = req.body?.mapping
        ? normalizeCommitMapping(req.body?.mapping, parsed.detectedHeaders)
        : suggestColumnMapping(parsed.detectedHeaders);

      const codes = parsed.rows
        .map((row) => {
          const mappedHeader = mapping.projectCode;
          if (!mappedHeader) return "";
          return normalizeProjectCode(row.raw[mappedHeader] || "");
        })
        .filter(Boolean);

      const committees = await prisma.committee.findMany({
        select: { id: true, code: true },
      });
      const committeeCodeMap = new Map(
        committees.map((committee) => [committee.code.toUpperCase(), committee.id])
      );
      const defaultCommitteeId = committees[0]?.id ?? null;

      const existingProjects = codes.length
        ? await prisma.project.findMany({
            where: { projectCode: { in: codes } },
            select: { projectCode: true },
          })
        : [];
      const existingProjectCodes = new Set(
        existingProjects
          .map((project) => normalizeProjectCode(project.projectCode || ""))
          .filter(Boolean)
      );

      const { validRows, errors } = validateMappedProjectRows({
        parsed,
        mapping,
        committeeCodeMap,
        defaultCommitteeId,
        existingProjectCodes,
        config: DEFAULT_IMPORT_CONFIG,
      });

      let insertedRows = 0;
      const insertionErrors: Array<{ row: number; field: string; message: string }> = [];

      for (const batch of chunkRows(validRows, DEFAULT_IMPORT_CONFIG.batchSize)) {
        for (const row of batch) {
          try {
            const created = await createProjectWithInitialSubmission(
              {
                projectCode: row.projectCode,
                title: row.title,
                piName: row.piName,
                piAffiliation: row.piAffiliation,
                collegeOrUnit: row.collegeOrUnit,
                proponentCategory: row.proponentCategory,
                department: row.department,
                proponent: row.proponent,
                fundingType: row.fundingType,
                committeeId: row.committeeId,
                submissionType: row.submissionType,
                receivedDate: row.receivedDate,
                notes: row.remarks,
              },
              req.user?.id
            );
            if (created?.projectId) {
              await prisma.protocolProfile.upsert({
                where: { projectId: created.projectId },
                update: {
                  title:
                    pickRawValue(row.raw, ["Title", "Project Title"]) ?? row.title,
                  projectLeader:
                    pickRawValue(row.raw, ["Project Leader", "PI Name"]) ?? row.piName,
                  college: pickRawValue(row.raw, ["College", "College/Unit"]),
                  department: pickRawValue(row.raw, ["Department"]),
                  dateOfSubmission:
                    parseLooseDate(pickRawValue(row.raw, ["Date of Submission"])) ??
                    row.receivedDate,
                  monthOfSubmission: pickRawValue(row.raw, ["Month of Submission"]),
                  typeOfReview:
                    pickRawValue(row.raw, ["Type of Review"]) ??
                    (row.submissionType ?? null),
                  proponent: pickRawValue(row.raw, ["Proponent"]) ?? row.proponent,
                  funding:
                    pickRawValue(row.raw, ["Funding", "Funding Type"]) ??
                    (row.fundingType ?? null),
                  typeOfResearchPhreb: pickRawValue(row.raw, ["Type of Research PHREB"]),
                  typeOfResearchPhrebOther: pickRawValue(row.raw, [
                    "Type of Research PHREB (Specific for Others)",
                  ]),
                  status: pickRawValue(row.raw, ["Status"]),
                  finishDate: parseLooseDate(pickRawValue(row.raw, ["Finish Date"])),
                  monthOfClearance: pickRawValue(row.raw, ["Month of Clearance"]),
                  reviewDurationDays: parseLooseInt(
                    pickRawValue(row.raw, ["Review Duration (Receipt to Finish date)"])
                  ),
                  remarks: pickRawValue(row.raw, ["Remarks"]) ?? row.remarks,
                  panel: pickRawValue(row.raw, ["Panel"]),
                  scientistReviewer: pickRawValue(row.raw, ["Scientist Reviewer"]),
                  layReviewer: pickRawValue(row.raw, ["Lay Reviewer"]),
                  independentConsultant: pickRawValue(row.raw, [
                    "Independent Consultant (if applicable)",
                  ]),
                  honorariumStatus: pickRawValue(row.raw, [
                    "Honorarium Status (c/o Ms. Maja)",
                  ]),
                  classificationOfProposalRerc: pickRawValue(row.raw, [
                    "Classification of Proposal (RERC)",
                  ]),
                  totalDays: parseLooseInt(pickRawValue(row.raw, ["Total days"])),
                  submissionCount: parseLooseInt(pickRawValue(row.raw, ["# Submissions"])),
                  withdrawn:
                    pickRawValue(row.raw, ["Withdrawn"])?.toLowerCase() === "yes"
                      ? true
                      : pickRawValue(row.raw, ["Withdrawn"])?.toLowerCase() === "no"
                        ? false
                        : null,
                  projectEndDate6A: parseLooseDate(
                    pickRawValue(row.raw, ["Project End Date (6A)"])
                  ),
                  clearanceExpiration: parseLooseDate(
                    pickRawValue(row.raw, ["Clearance Expiration"])
                  ),
                  progressReportTargetDate: parseLooseDate(
                    pickRawValue(row.raw, ["Progress Report [Target Date]"])
                  ),
                  progressReportSubmission: parseLooseDate(
                    pickRawValue(row.raw, ["Progress Report [Submission]"])
                  ),
                  progressReportApprovalDate: parseLooseDate(
                    pickRawValue(row.raw, ["Progress Report [Approval Date]"])
                  ),
                  progressReportStatus: pickRawValue(row.raw, ["Progress Report Status"]),
                  progressReportDays: parseLooseInt(
                    pickRawValue(row.raw, ["Progress Report # of Days", "Progress Report # Days"])
                  ),
                  finalReportTargetDate: parseLooseDate(
                    pickRawValue(row.raw, ["Final Report [Target Date]"])
                  ),
                  finalReportSubmission: parseLooseDate(
                    pickRawValue(row.raw, ["Final Report [Submission]"])
                  ),
                  finalReportCompletionDate: parseLooseDate(
                    pickRawValue(row.raw, ["Final Report [Completion Date]"])
                  ),
                  finalReportStatus: pickRawValue(row.raw, ["Final Report Status"]),
                  finalReportDays: parseLooseInt(
                    pickRawValue(row.raw, ["Final Report # of Days", "Final Report # Days"])
                  ),
                  amendmentSubmission: parseLooseDate(
                    pickRawValue(row.raw, ["Amendment [Submission]"])
                  ),
                  amendmentStatusOfRequest: pickRawValue(row.raw, ["Status of Request"]),
                  amendmentApprovalDate: parseLooseDate(
                    pickRawValue(row.raw, ["Approval Date"])
                  ),
                  amendmentDays: parseLooseInt(pickRawValue(row.raw, ["# of Days"])),
                  continuingSubmission: parseLooseDate(
                    pickRawValue(row.raw, ["Continuing [Submission]"])
                  ),
                  continuingStatusOfRequest: pickRawValue(row.raw, [
                    "Continuing Status of Request",
                  ]),
                  continuingApprovalDate: parseLooseDate(
                    pickRawValue(row.raw, ["Continuing Approval Date"])
                  ),
                  continuingDays: parseLooseInt(
                    pickRawValue(row.raw, ["Continuing # of Days"])
                  ),
                  primaryReviewer: pickRawValue(row.raw, ["Primary Reviewer"]),
                  finalLayReviewer: pickRawValue(row.raw, ["Lay Reviewer"]),
                },
                create: {
                  projectId: created.projectId,
                },
              });
            }
            insertedRows += 1;
          } catch (error: any) {
            if (error instanceof ProjectCreateValidationError) {
              insertionErrors.push(
                ...error.errors.map((fieldError) => ({
                  row: row.rowNumber,
                  field: fieldError.field,
                  message: fieldError.message,
                }))
              );
              continue;
            }

            if (error instanceof DuplicateProjectCodeError) {
              insertionErrors.push({
                row: row.rowNumber,
                field: "projectCode",
                message: "projectCode already exists.",
              });
              continue;
            }

            let message = "Failed to insert row.";
            let field = "projectCode";
            if (error?.code === "P2002") {
              message = "projectCode already exists.";
            } else if (error?.code === "P2003") {
              message = "Invalid reference on this row.";
              field = "committeeCode";
            }
            insertionErrors.push({
              row: row.rowNumber,
              field,
              message,
            });
          }
        }
      }

      const allErrors = [...errors, ...insertionErrors].sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.field.localeCompare(b.field);
      });
      const failedRows = new Set(allErrors.map((error) => error.row)).size;

      console.info(
        `[imports] projects-commit user=${req.user?.id ?? "unknown"} received=${parsed.receivedRows} inserted=${insertedRows} failed=${failedRows} at=${new Date().toISOString()}`
      );

      return res.json({
        receivedRows: parsed.receivedRows,
        insertedRows,
        failedRows,
        errors: allErrors,
      });
    } catch (error) {
      if (error instanceof CsvImportError) {
        return res.status(error.status).json({
          message: error.message,
          details: error.details,
        });
      }
      console.error("Import commit failed:", error);
      return res.status(500).json({ message: "Import failed." });
    }
  }
);

router.get(
  "/api/imports/projects/template",
  requireRoles([RoleType.ADMIN, RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  (_req, res) => {
    const header = PROJECT_IMPORT_HEADERS.join(",");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="project_import_template.csv"'
    );
    res.send(`${header}\n`);
  }
);

export default router;
