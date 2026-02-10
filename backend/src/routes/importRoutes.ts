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
      const mapping = normalizeCommitMapping(req.body?.mapping, parsed.detectedHeaders);

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
        existingProjectCodes,
        config: DEFAULT_IMPORT_CONFIG,
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
