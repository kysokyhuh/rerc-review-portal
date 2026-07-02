import { createHash } from "crypto";
import { Router } from "express";
import multer, { MulterError } from "multer";
import prisma from "../config/prismaClient";
import {
  ImportMode,
  ProjectOrigin,
  ReviewType,
  RoleType,
  SubmissionStatus,
} from "../generated/prisma/client";
import { requireRoles } from "../middleware/auth";
import {
  type ColumnMapping,
  buildPreviewPayload,
  chunkRows,
  CsvImportError,
  DEFAULT_IMPORT_CONFIG,
  inferImportMode,
  normalizeCommitMapping,
  normalizeProjectCode,
  parseProjectCsvUnknownFormat,
  type ParsedCsvData,
  PROJECT_IMPORT_HEADERS,
  suggestColumnMapping,
  validateMappedProjectRows,
} from "../services/imports/projectCsvImport";
import {
  buildClassificationPreviewRows,
  CLASSIFICATION_PREVIEW_ROWS,
  ClassificationCsvImportError,
  type ClassificationImportPreviewRow,
  type ClassificationProjectMatch,
  mergeImportedRationale,
  normalizeClassificationTitle,
  parseClassificationCsv,
  summarizeClassificationPreview,
} from "../services/imports/classificationCsvImport";
import {
  createProjectWithInitialSubmission,
  DuplicateProjectCodeError,
  ProjectCreateValidationError,
} from "../services/projects/createProjectWithInitialSubmission";
import { BRAND } from "../config/branding";

const MAX_FILE_SIZE_MB = Number(process.env.IMPORT_MAX_FILE_SIZE_MB || 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const CSV_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "text/plain",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

const router = Router();

const DEFAULT_COMMITTEE_REQUIRED_MESSAGE =
  "This file leaves committeeCode blank on one or more rows, but no default intake committee is configured. Configure IMPORT_DEFAULT_COMMITTEE_CODE and create that committee before importing.";

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
    const rowNumber = Number((item as { rowNumber?: unknown }).rowNumber);
    const values = (item as { values?: unknown }).values;
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

const getUploadFileOrThrow = (req: any, importLabel = "Project import") => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    throw new CsvImportError("A file is required.", 400);
  }
  if (!file.size) {
    throw new CsvImportError("The uploaded file is empty.", 400);
  }
  const lowerName = String(file.originalname ?? "").toLowerCase();
  if (lowerName.endsWith(".xlsx")) {
    throw new CsvImportError(
      `${importLabel} now accepts CSV files only. Export the workbook to CSV and upload that file instead.`,
      415
    );
  }
  if (
    !lowerName.endsWith(".csv") &&
    !CSV_MIME_TYPES.has(file.mimetype) &&
    file.mimetype !== "application/vnd.ms-excel"
  ) {
    throw new CsvImportError("Unsupported file type. Please upload a CSV file.", 415);
  }
  return { file, sourceType: "csv" as const };
};

const toJsonValue = <T>(value: T) => JSON.parse(JSON.stringify(value));

const rowHasImportContent = (row: ParsedCsvData["rows"][number], mapping: ColumnMapping) => {
  const anchorHeaders = [
    mapping.projectCode,
    mapping.title,
    mapping.piName,
    mapping.receivedDate,
  ].filter((header): header is string => Boolean(header));

  if (anchorHeaders.length === 0) {
    return Object.values(row.raw).some((value) => value.trim().length > 0);
  }

  return anchorHeaders.some((header) => (row.raw[header] ?? "").trim().length > 0);
};

const fileNeedsDefaultCommittee = (parsed: ParsedCsvData, mapping: ColumnMapping) =>
  parsed.rows.some((row) => {
    if (!rowHasImportContent(row, mapping)) {
      return false;
    }

    const committeeHeader = mapping.committeeCode;
    const committeeCode = committeeHeader ? row.raw[committeeHeader] ?? "" : "";
    return committeeCode.trim().length === 0;
  });

const CLASSIFICATION_ADVANCE_STATUSES = new Set<SubmissionStatus>([
    SubmissionStatus.RECEIVED,
    SubmissionStatus.UNDER_COMPLETENESS_CHECK,
    SubmissionStatus.RETURNED_FOR_COMPLETION,
    SubmissionStatus.AWAITING_CLASSIFICATION,
    SubmissionStatus.UNDER_CLASSIFICATION,
]);

const classificationStatusCanAdvance = (status: SubmissionStatus) =>
  CLASSIFICATION_ADVANCE_STATUSES.has(status);

const uniqueClassificationWarnings = (rows: ClassificationImportPreviewRow[]) => {
  const seen = new Set<string>();
  const warnings = [];
  for (const row of rows) {
    for (const warning of row.warnings) {
      const key = `${warning.code}:${warning.row ?? ""}:${warning.field ?? ""}:${warning.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      warnings.push(warning);
    }
  }
  return warnings;
};

const loadClassificationProjectMatches = async () => {
  const projects = await prisma.project.findMany({
    where: { title: { not: null } },
    select: {
      id: true,
      title: true,
      projectCode: true,
      submissions: {
        orderBy: { sequenceNumber: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          sequenceNumber: true,
          classification: {
            select: {
              reviewType: true,
              rationale: true,
            },
          },
        },
      },
    },
  });

  const projectsByTitle = new Map<string, ClassificationProjectMatch[]>();
  for (const project of projects) {
    const normalizedTitle = normalizeClassificationTitle(project.title ?? "");
    if (!normalizedTitle) continue;
    const existing = projectsByTitle.get(normalizedTitle) ?? [];
    existing.push(project);
    projectsByTitle.set(normalizedTitle, existing);
  }
  return projectsByTitle;
};

const buildClassificationPreviewResponse = async (fileBuffer: Buffer) => {
  const parsed = parseClassificationCsv(fileBuffer);
  const projectsByTitle = await loadClassificationProjectMatches();
  const previewRows = buildClassificationPreviewRows(parsed.rows, projectsByTitle);
  const warningItems = uniqueClassificationWarnings(previewRows);
  return {
    parsed,
    previewRows,
    response: {
      detectedHeaders: parsed.detectedHeaders,
      receivedRows: parsed.receivedRows,
      skippedBlankRows: parsed.skippedBlankRows,
      previewRows: previewRows.slice(0, CLASSIFICATION_PREVIEW_ROWS),
      summary: summarizeClassificationPreview(previewRows),
      warnings: Array.from(new Set(warningItems.map((warning) => warning.message))),
      warningItems,
    },
  };
};

const buildConfiguredDefaultCommittee = async () => {
  const explicitDefaultCommitteeCode = String(
    process.env.IMPORT_DEFAULT_COMMITTEE_CODE ?? ""
  )
    .trim()
    .toUpperCase();
  const configuredDefaultCommitteeCode =
    explicitDefaultCommitteeCode || BRAND.defaultCommitteeCode;
  if (!configuredDefaultCommitteeCode) {
    return {
      defaultCommitteeCode: null,
      defaultCommitteeId: null,
    };
  }

  const committee = await prisma.committee.findFirst({
    where: { code: { equals: configuredDefaultCommitteeCode, mode: "insensitive" } },
    select: { id: true, code: true },
  });
  if (!committee) {
    if (explicitDefaultCommitteeCode) {
      throw new CsvImportError(
        `Configured default intake committee does not exist: ${configuredDefaultCommitteeCode}`,
        500
      );
    }

    return {
      defaultCommitteeCode: null,
      defaultCommitteeId: null,
    };
  }

  return {
    defaultCommitteeCode: committee.code.toUpperCase(),
    defaultCommitteeId: committee.id,
  };
};

router.post(
  "/imports/projects/preview",
  requireRoles([RoleType.ADMIN, RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  uploadSingleFile,
  async (req, res) => {
    try {
      const { file, sourceType } = getUploadFileOrThrow(req);
      const parsed = parseProjectCsvUnknownFormat(file.buffer, DEFAULT_IMPORT_CONFIG);
      const mode = inferImportMode(parsed);
      const mapping = suggestColumnMapping(parsed.detectedHeaders);
      const needsDefaultCommittee = fileNeedsDefaultCommittee(parsed, mapping);
      let defaultCommitteeCode: string | null = null;
      if (needsDefaultCommittee) {
        const configuredDefaultCommittee = await buildConfiguredDefaultCommittee();
        defaultCommitteeCode = configuredDefaultCommittee.defaultCommitteeCode;
        if (!configuredDefaultCommittee.defaultCommitteeId || !defaultCommitteeCode) {
          throw new CsvImportError(DEFAULT_COMMITTEE_REQUIRED_MESSAGE, 400);
        }
      }
      const preview = buildPreviewPayload(parsed, DEFAULT_IMPORT_CONFIG);
      const sourceWarnings = [
        ...(defaultCommitteeCode
          ? [
              `Rows with blank committeeCode will be attached to default committee ${defaultCommitteeCode}. The Chair can assign Panel 1-4 later.`,
            ]
          : []),
        ...(
        mode === ImportMode.LEGACY_MIGRATION && sourceType === "csv"
          ? [
              "This file looks like an older spreadsheet export. If some formula results were not included in the CSV, those fields will stay blank after import.",
            ]
          : [])
      ];

      return res.json({ ...preview, sourceType, sourceWarnings });
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
      const { file, sourceType } = getUploadFileOrThrow(req);
      const parsed = parseProjectCsvUnknownFormat(file.buffer, DEFAULT_IMPORT_CONFIG);
      const mode = inferImportMode(parsed);

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
        ? normalizeCommitMapping(req.body.mapping, parsed.detectedHeaders)
        : suggestColumnMapping(parsed.detectedHeaders);
      const needsDefaultCommittee = fileNeedsDefaultCommittee(parsed, mapping);
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
      let defaultCommitteeId: number | null = null;
      let defaultCommitteeCode: string | null = null;
      if (needsDefaultCommittee) {
        const configuredDefaultCommittee = await buildConfiguredDefaultCommittee();
        defaultCommitteeId = configuredDefaultCommittee.defaultCommitteeId;
        defaultCommitteeCode = configuredDefaultCommittee.defaultCommitteeCode;
        if (!defaultCommitteeId || !defaultCommitteeCode) {
          throw new CsvImportError(DEFAULT_COMMITTEE_REQUIRED_MESSAGE, 400);
        }
      }

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

      const { validRows, errors, warnings } = validateMappedProjectRows({
        parsed,
        mapping,
        committeeCodeMap,
        defaultCommitteeId,
        existingProjectCodes,
        config: DEFAULT_IMPORT_CONFIG,
        mode,
      });

      const warningRows = new Set(
        validRows.filter((row) => row.warnings.length > 0).map((row) => row.rowNumber)
      ).size;
      const fileHash = createHash("sha256").update(file.buffer).digest("hex");
      const importBatch = await prisma.importBatch.create({
        data: {
          mode,
          sourceFilename: file.originalname || `project-import.${sourceType}`,
          sourceFileHash: fileHash,
          uploadedById: req.user!.id,
          receivedRows: parsed.receivedRows,
          insertedRows: 0,
          failedRows: 0,
          warningRows,
          notes: null,
          summaryJson: toJsonValue({
            detectedFormat: parsed.detectedFormat,
            inferredMode: mode,
            warnings,
          }),
        },
        select: {
          id: true,
          mode: true,
          sourceFilename: true,
          createdAt: true,
        },
      });

      let insertedRows = 0;
      const insertionErrors: Array<{ row: number; field: string; message: string }> = [];

      for (const batch of chunkRows(validRows, DEFAULT_IMPORT_CONFIG.batchSize)) {
        for (const row of batch) {
          try {
            await createProjectWithInitialSubmission(
              {
                projectCode: row.projectCode,
                title: row.title,
                piName: row.piName,
                piAffiliation: row.piAffiliation,
                collegeOrUnit: row.collegeOrUnit,
                proponentCategory: row.proponentCategory,
                department: row.department,
                proponent: row.proponent,
                researchTypePHREB: row.researchTypePHREB,
                researchTypePHREBOther: row.researchTypePHREBOther,
                fundingType: row.fundingType,
                committeeId: row.committeeId,
                defaultCommitteeCode,
                submissionType: row.submissionType,
                receivedDate: row.receivedDate,
                notes: row.remarks,
                origin:
                  mode === ImportMode.LEGACY_MIGRATION
                    ? ProjectOrigin.LEGACY_IMPORT
                    : ProjectOrigin.NATIVE_PORTAL,
                importMode: mode,
                importBatchId: importBatch.id,
                importSourceRowNumber: row.rowNumber,
                workflowReceivedDate: importBatch.createdAt,
                referenceProfile: row.referenceProfile,
                legacyWorkflowSeed: row.legacyWorkflowSeed,
              },
              req.user!.id
            );
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

      await prisma.importBatch.update({
        where: { id: importBatch.id },
        data: {
          insertedRows,
          failedRows,
          warningRows,
          notes:
            mode === ImportMode.LEGACY_MIGRATION
              ? "Import completed. Usable values from the older spreadsheet format were added to the live workflow records."
              : warnings.length > 0
                ? "Import completed with warnings."
                : "Import completed.",
          summaryJson: toJsonValue({
            detectedFormat: parsed.detectedFormat,
            inferredMode: mode,
            warnings,
            errors: allErrors,
          }),
        },
      });

      console.info(
        `[imports] projects-commit user=${req.user?.id ?? "unknown"} mode=${mode} received=${parsed.receivedRows} inserted=${insertedRows} failed=${failedRows} at=${new Date().toISOString()}`
      );

      return res.json({
        receivedRows: parsed.receivedRows,
        insertedRows,
        failedRows,
        warningRows,
        warnings,
        sourceType,
        importBatch,
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

router.post(
  "/imports/classifications/preview",
  requireRoles([RoleType.ADMIN, RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  uploadSingleFile,
  async (req, res) => {
    try {
      const { file } = getUploadFileOrThrow(req, "Classification import");
      const { response } = await buildClassificationPreviewResponse(file.buffer);
      return res.json(response);
    } catch (error) {
      if (error instanceof ClassificationCsvImportError || error instanceof CsvImportError) {
        return res.status(error.status).json({
          message: error.message,
          details: error.details,
        });
      }
      console.error("Classification preview failed:", error);
      return res.status(500).json({ message: "Classification preview failed." });
    }
  }
);

router.post(
  "/imports/classifications/commit",
  requireRoles([RoleType.ADMIN, RoleType.CHAIR, RoleType.RESEARCH_ASSOCIATE]),
  uploadSingleFile,
  async (req, res) => {
    try {
      const { file } = getUploadFileOrThrow(req, "Classification import");
      const { parsed, previewRows } = await buildClassificationPreviewResponse(file.buffer);
      const rowsByNumber = new Map(parsed.rows.map((row) => [row.rowNumber, row]));
      const allErrors: Array<{ row: number; field: string; message: string }> = [];
      let insertedRows = 0;

      for (const previewRow of previewRows) {
        const parsedRow = rowsByNumber.get(previewRow.rowNumber);
        if (!parsedRow) continue;

        if (
          previewRow.matchStatus === "UNMATCHED" ||
          previewRow.matchStatus === "AMBIGUOUS" ||
          !previewRow.matchedSubmissionId
        ) {
          allErrors.push({
            row: previewRow.rowNumber,
            field: "Title",
            message: previewRow.action,
          });
          continue;
        }

        if (previewRow.matchStatus === "NO_REVIEW_TYPE") {
          const submission = await prisma.submission.findUnique({
            where: { id: previewRow.matchedSubmissionId },
            select: {
              classification: {
                select: {
                  rationale: true,
                },
              },
            },
          });
          if (!submission?.classification) {
            allErrors.push({
              row: previewRow.rowNumber,
              field: "Recommended Type of Review",
              message: "Review type could not be mapped and no existing classification exists for notes-only update.",
            });
            continue;
          }

          await prisma.classification.update({
            where: { submissionId: previewRow.matchedSubmissionId },
            data: {
              rationale: mergeImportedRationale(
                submission.classification.rationale,
                parsedRow.rationale
              ),
            },
          });
          insertedRows += 1;
          continue;
        }

        if (!parsedRow.reviewType) {
          allErrors.push({
            row: previewRow.rowNumber,
            field: "Recommended Type of Review",
            message: "Review type could not be mapped.",
          });
          continue;
        }

        await prisma.$transaction(async (tx) => {
          const submission = await tx.submission.findUnique({
            where: { id: previewRow.matchedSubmissionId! },
            select: {
              id: true,
              status: true,
              classification: {
                select: {
                  rationale: true,
                },
              },
            },
          });
          if (!submission) {
            throw new ClassificationCsvImportError("Matched submission no longer exists.");
          }

          await tx.classification.upsert({
            where: { submissionId: submission.id },
            update: {
              reviewType: parsedRow.reviewType as ReviewType,
              classificationDate: new Date(),
              rationale: mergeImportedRationale(
                submission.classification?.rationale,
                parsedRow.rationale
              ),
              classifiedById: req.user!.id,
            },
            create: {
              submissionId: submission.id,
              reviewType: parsedRow.reviewType as ReviewType,
              classificationDate: new Date(),
              rationale: parsedRow.rationale,
              classifiedById: req.user!.id,
            },
          });

          if (classificationStatusCanAdvance(submission.status)) {
            await tx.submission.update({
              where: { id: submission.id },
              data: { status: SubmissionStatus.CLASSIFIED },
            });
            await tx.submissionStatusHistory.create({
              data: {
                submissionId: submission.id,
                oldStatus: submission.status,
                newStatus: SubmissionStatus.CLASSIFIED,
                effectiveDate: new Date(),
                reason: "Classification imported from CSV.",
                changedById: req.user!.id,
              },
            });
          }
        });
        insertedRows += 1;
      }

      const warningItems = uniqueClassificationWarnings(previewRows);
      const warningRows = new Set(warningItems.map((warning) => warning.row).filter(Boolean)).size;
      const failedRows = new Set(allErrors.map((error) => error.row)).size;

      console.info(
        `[imports] classifications-commit user=${req.user?.id ?? "unknown"} received=${parsed.receivedRows} updated=${insertedRows} failed=${failedRows} at=${new Date().toISOString()}`
      );

      return res.json({
        entity: "classification",
        receivedRows: parsed.receivedRows,
        insertedRows,
        failedRows,
        warningRows,
        warnings: warningItems,
        errors: allErrors.sort((a, b) => {
          if (a.row !== b.row) return a.row - b.row;
          return a.field.localeCompare(b.field);
        }),
      });
    } catch (error) {
      if (error instanceof ClassificationCsvImportError || error instanceof CsvImportError) {
        return res.status(error.status).json({
          message: error.message,
          details: error.details,
        });
      }
      console.error("Classification import failed:", error);
      return res.status(500).json({ message: "Classification import failed." });
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
