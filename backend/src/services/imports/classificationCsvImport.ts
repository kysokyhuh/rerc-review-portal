import { parse } from "csv-parse/sync";
import { ReviewType, SubmissionStatus } from "../../generated/prisma/client";

export class ClassificationCsvImportError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ClassificationCsvImportError";
  }
}

export type ClassificationCsvWarning = {
  code: string;
  message: string;
  row?: number;
  field?: string;
};

export type ClassificationImportRow = {
  rowNumber: number;
  title: string;
  proponent: string | null;
  projectCode: string | null;
  receivedAt: string | null;
  sourceLink: string | null;
  recommendedTypeRaw: string | null;
  reviewType: ReviewType | null;
  rationale: string;
  raw: Record<string, string>;
  warnings: ClassificationCsvWarning[];
};

export type ClassificationParsedCsv = {
  detectedHeaders: string[];
  rows: ClassificationImportRow[];
  receivedRows: number;
  skippedBlankRows: number;
};

const REQUIRED_HEADERS = ["Title"] as const;
const PREVIEW_ROWS = 20;
const MAX_ROWS = 5000;
const MAX_RECORD_SIZE = 200000;

const normalizeValue = (value: unknown) => String(value ?? "").trim();
export const normalizeClassificationTitle = (value: string) =>
  normalizeValue(value).toLowerCase().replace(/\s+/g, " ");

const normalizeHeaderKey = (value: string) =>
  normalizeValue(value).toLowerCase().replace(/[^a-z0-9]/g, "");

const getByHeader = (row: Record<string, string>, candidates: string[]) => {
  const normalizedCandidates = new Set(candidates.map(normalizeHeaderKey));
  const entry = Object.entries(row).find(([key]) =>
    normalizedCandidates.has(normalizeHeaderKey(key))
  );
  return normalizeValue(entry?.[1]);
};

export const parseClassificationReviewType = (value: string): ReviewType | null => {
  const normalized = normalizeValue(value).toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("exempt")) return ReviewType.EXEMPT;
  if (normalized.includes("expedited")) return ReviewType.EXPEDITED;
  if (normalized.includes("full")) return ReviewType.FULL_BOARD;
  return null;
};

const appendNoteLine = (lines: string[], label: string, value: string | null) => {
  if (!value) return;
  lines.push(`${label}: ${value}`);
};

const buildRationale = (row: Record<string, string>, reviewTypeRaw: string | null) => {
  const lines = ["Imported from classification CSV."];
  appendNoteLine(lines, "Recommended type of review", reviewTypeRaw);
  appendNoteLine(lines, "Remarks/Justification", getByHeader(row, ["Remarks/Justification"]));
  appendNoteLine(lines, "Notes/Summary of Research", getByHeader(row, ["Notes/Summary of Research"]));
  appendNoteLine(
    lines,
    "Remarks on Informed Consent Form/s",
    getByHeader(row, ["Remarks on Informed Consent Form/s"])
  );
  appendNoteLine(lines, "Remarks on Instruments", getByHeader(row, ["Remarks on Instruments"]));
  appendNoteLine(lines, "Additional notes", getByHeader(row, ["Notes", "column_16"]));
  appendNoteLine(lines, "Source link", getByHeader(row, ["Link"]));
  return lines.join("\n");
};

export const parseClassificationCsv = (
  input: Buffer | string
): ClassificationParsedCsv => {
  const records: string[][] = parse(input, {
    bom: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
    max_record_size: MAX_RECORD_SIZE,
  });

  if (!records.length) {
    throw new ClassificationCsvImportError("CSV file is empty.");
  }

  const headers = records[0].map((header, index) => {
    const normalized = normalizeValue(header);
    return normalized || `column_${index + 1}`;
  });
  if (headers.every((header) => !header)) {
    throw new ClassificationCsvImportError("CSV header row is required.");
  }

  const normalizedHeaders = new Set(headers.map(normalizeHeaderKey));
  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !normalizedHeaders.has(normalizeHeaderKey(header))
  );
  if (missingHeaders.length > 0) {
    throw new ClassificationCsvImportError("Required classification headers are missing.", 400, {
      missingRequiredHeaders: missingHeaders,
    });
  }

  const dataRows = records.slice(1);
  if (dataRows.length > MAX_ROWS) {
    throw new ClassificationCsvImportError(`CSV row limit exceeded. Max allowed is ${MAX_ROWS}.`, 413);
  }

  const rows: ClassificationImportRow[] = [];
  let skippedBlankRows = 0;
  for (const [index, record] of dataRows.entries()) {
    const raw: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      raw[header] = normalizeValue(record[columnIndex]);
    });

    const title = getByHeader(raw, ["Title"]);
    const hasAnyContent = Object.values(raw).some((value) => value.length > 0);
    if (!title) {
      if (hasAnyContent) skippedBlankRows += 1;
      continue;
    }

    const recommendedTypeRaw = getByHeader(raw, ["Recommended Type of Review"]) || null;
    const reviewType = parseClassificationReviewType(recommendedTypeRaw ?? "");
    const warnings: ClassificationCsvWarning[] = [];
    if (recommendedTypeRaw && !reviewType) {
      warnings.push({
        code: "UNRECOGNIZED_REVIEW_TYPE",
        row: index + 2,
        field: "Recommended Type of Review",
        message: `Recommended Type of Review "${recommendedTypeRaw}" could not be mapped.`,
      });
    }

    rows.push({
      rowNumber: index + 2,
      title,
      proponent: getByHeader(raw, ["Proponent"]) || null,
      projectCode: getByHeader(raw, ["In Order", "Receipt Code"]) || null,
      receivedAt: getByHeader(raw, ["Submission Date/Time"]) || null,
      sourceLink: getByHeader(raw, ["Link"]) || null,
      recommendedTypeRaw,
      reviewType,
      rationale: buildRationale(raw, recommendedTypeRaw),
      raw,
      warnings,
    });
  }

  if (rows.length === 0) {
    throw new ClassificationCsvImportError("CSV file has no classification rows with Title values.");
  }

  return {
    detectedHeaders: headers,
    rows,
    receivedRows: dataRows.length,
    skippedBlankRows,
  };
};

export type ClassificationMatchStatus =
  | "MATCHED"
  | "UNMATCHED"
  | "AMBIGUOUS"
  | "NO_REVIEW_TYPE";

export type ClassificationImportPreviewRow = {
  rowNumber: number;
  title: string;
  proponent: string | null;
  projectCode: string | null;
  recommendedTypeRaw: string | null;
  reviewType: ReviewType | null;
  matchStatus: ClassificationMatchStatus;
  matchedProjectId: number | null;
  matchedSubmissionId: number | null;
  portalStatus: SubmissionStatus | null;
  action: string;
  warnings: ClassificationCsvWarning[];
};

export type ClassificationProjectMatch = {
  id: number;
  title: string | null;
  projectCode: string | null;
  submissions: Array<{
    id: number;
    status: SubmissionStatus;
    sequenceNumber: number;
    classification: {
      reviewType: ReviewType;
      rationale: string | null;
    } | null;
  }>;
};

export const buildClassificationPreviewRows = (
  parsedRows: ClassificationImportRow[],
  projectsByTitle: Map<string, ClassificationProjectMatch[]>
): ClassificationImportPreviewRow[] =>
  parsedRows.map((row) => {
    const matches = projectsByTitle.get(normalizeClassificationTitle(row.title)) ?? [];
    const warnings = [...row.warnings];
    if (matches.length === 0) {
      warnings.push({
        code: "NO_MATCH",
        row: row.rowNumber,
        field: "Title",
        message: "No existing protocol matches this title.",
      });
      return {
        ...row,
        matchStatus: "UNMATCHED",
        matchedProjectId: null,
        matchedSubmissionId: null,
        portalStatus: null,
        action: "Skipped - no matching protocol",
        warnings,
      };
    }
    if (matches.length > 1) {
      warnings.push({
        code: "AMBIGUOUS_MATCH",
        row: row.rowNumber,
        field: "Title",
        message: "Multiple existing protocols match this title.",
      });
      return {
        ...row,
        matchStatus: "AMBIGUOUS",
        matchedProjectId: null,
        matchedSubmissionId: null,
        portalStatus: null,
        action: "Skipped - multiple matching protocols",
        warnings,
      };
    }

    const project = matches[0];
    const latestSubmission =
      [...project.submissions].sort((a, b) => b.sequenceNumber - a.sequenceNumber)[0] ?? null;
    if (!latestSubmission) {
      warnings.push({
        code: "NO_SUBMISSION",
        row: row.rowNumber,
        field: "Title",
        message: "Matched protocol has no submission to update.",
      });
      return {
        ...row,
        matchStatus: "UNMATCHED",
        matchedProjectId: project.id,
        matchedSubmissionId: null,
        portalStatus: null,
        action: "Skipped - no submission",
        warnings,
      };
    }
    if (!row.reviewType) {
      warnings.push({
        code: latestSubmission.classification ? "NOTES_ONLY" : "NO_REVIEW_TYPE",
        row: row.rowNumber,
        field: "Recommended Type of Review",
        message: latestSubmission.classification
          ? "Review type was not mapped. Existing classification notes will be appended only."
          : "Review type was not mapped and this submission has no existing classification.",
      });
      return {
        ...row,
        matchStatus: "NO_REVIEW_TYPE",
        matchedProjectId: project.id,
        matchedSubmissionId: latestSubmission.id,
        portalStatus: latestSubmission.status,
        action: latestSubmission.classification
          ? "Will append notes only"
          : "Skipped - review type not mapped",
        warnings,
      };
    }

    return {
      ...row,
      matchStatus: "MATCHED",
      matchedProjectId: project.id,
      matchedSubmissionId: latestSubmission.id,
      portalStatus: latestSubmission.status,
      action: `Will classify as ${row.reviewType}`,
      warnings,
    };
  });

export const summarizeClassificationPreview = (rows: ClassificationImportPreviewRow[]) => ({
  matchedRows: rows.filter((row) => row.matchStatus === "MATCHED").length,
  notesOnlyRows: rows.filter((row) => row.matchStatus === "NO_REVIEW_TYPE").length,
  unmatchedRows: rows.filter((row) => row.matchStatus === "UNMATCHED").length,
  ambiguousRows: rows.filter((row) => row.matchStatus === "AMBIGUOUS").length,
  warningRows: rows.filter((row) => row.warnings.length > 0).length,
});

export const mergeImportedRationale = (existing: string | null | undefined, imported: string) => {
  const trimmedExisting = normalizeValue(existing);
  if (!trimmedExisting) return imported;
  return `${trimmedExisting}\n\n---\n${imported}`;
};

export const CLASSIFICATION_PREVIEW_ROWS = PREVIEW_ROWS;
