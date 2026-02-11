import { parse } from "csv-parse/sync";
import {
  FundingType,
  ProponentCategory,
  ResearchTypePHREB,
  SubmissionType,
} from "../../generated/prisma/client";

export const PROJECT_IMPORT_HEADERS = [
  "projectCode",
  "title",
  "piName",
  "piAffiliation",
  "collegeOrUnit",
  "proponentCategory",
  "department",
  "proponent",
  "fundingType",
  "researchTypePHREB",
  "researchTypePHREBOther",
  "committeeCode",
  "submissionType",
  "receivedDate",
  "remarks",
] as const;

export const REQUIRED_PROJECT_FIELDS = [
  "projectCode",
  "title",
  "piName",
  "fundingType",
  "committeeCode",
  "submissionType",
  "receivedDate",
] as const;

export type RequiredProjectField = (typeof REQUIRED_PROJECT_FIELDS)[number];
export type ProjectField = (typeof PROJECT_IMPORT_HEADERS)[number];
export type ColumnMapping = Record<RequiredProjectField, string | null>;

const HEADER_SYNONYMS: Record<RequiredProjectField, string[]> = {
  projectCode: [
    "projectcode",
    "protocolcode",
    "protocolid",
    "projectid",
    "studycode",
    "recordnumber",
  ],
  title: ["title", "projecttitle", "studytitle", "protocoltitle"],
  piName: [
    "piname",
    "pi",
    "principalinvestigator",
    "projectleader",
    "investigatorname",
  ],
  fundingType: ["funding", "fundingtype", "sourceoffunding", "fundingsource"],
  committeeCode: ["committee", "committeecode", "committeeid", "ethicscommittee"],
  submissionType: ["submissiontype", "typeofreview", "reviewtype", "submission"],
  receivedDate: ["receiveddate", "datereceived", "dateofsubmission", "submissiondate"],
};

export interface ImportConfig {
  maxRows: number;
  maxFieldLength: number;
  maxRecordSize: number;
  batchSize: number;
  previewRows: number;
}

export const DEFAULT_IMPORT_CONFIG: ImportConfig = {
  maxRows: Number(process.env.IMPORT_MAX_ROWS || 5000),
  maxFieldLength: Number(process.env.IMPORT_MAX_FIELD_LENGTH || 5000),
  maxRecordSize: Number(process.env.IMPORT_MAX_RECORD_SIZE || 200000),
  batchSize: Number(process.env.IMPORT_BATCH_SIZE || 250),
  previewRows: 20,
};

export interface RawCsvRow {
  rowNumber: number;
  raw: Record<string, string>;
}

export interface ParsedCsvData {
  detectedHeaders: string[];
  rows: RawCsvRow[];
  receivedRows: number;
}

export interface RowError {
  row: number;
  field: string;
  message: string;
}

export interface PreviewPayload {
  detectedHeaders: string[];
  previewRows: Record<string, string>[];
  suggestedMapping: ColumnMapping;
  missingRequiredFields: RequiredProjectField[];
  warnings: string[];
}

export interface ValidatedProjectRow {
  rowNumber: number;
  projectCode: string;
  title: string;
  piName: string;
  piAffiliation: string | null;
  collegeOrUnit: string | null;
  proponentCategory: ProponentCategory | null;
  department: string | null;
  proponent: string | null;
  fundingType: FundingType;
  researchTypePHREB: ResearchTypePHREB | null;
  researchTypePHREBOther: string | null;
  committeeId: number;
  submissionType: SubmissionType;
  receivedDate: Date;
  remarks: string | null;
}

export class CsvImportError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const normalizeHeader = (value: unknown) => String(value ?? "").trim();
const normalizeValue = (value: unknown) => String(value ?? "").trim();

export const normalizeHeaderKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

export const normalizeProjectCode = (value: string) => value.trim().toUpperCase();

export const parseReceivedDate = (value: string): Date | null => {
  const raw = value.trim();
  if (!raw) return null;

  const setUtcDate = (year: number, month: number, day: number) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date;
  };

  const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    return setUtcDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }

  const mdy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (mdy) {
    let year = Number(mdy[3]);
    if (year < 100) year += 2000;
    return setUtcDate(year, Number(mdy[1]), Number(mdy[2]));
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const parseFundingType = (value: string): FundingType | null => {
  const normalized = value.trim().toUpperCase();
  if (!normalized || normalized === "N/A") return null;
  if (normalized in FundingType) {
    return FundingType[normalized as keyof typeof FundingType];
  }
  const compact = normalized.replace(/[^A-Z]/g, "");
  if (compact.includes("SELF")) return FundingType.SELF_FUNDED;
  if (compact.includes("NOFUND") || compact === "NONE") return FundingType.NO_FUNDING;
  if (compact.includes("INTERNAL") || compact.includes("RGMO")) return FundingType.INTERNAL;
  if (compact.includes("EXTERNAL")) return FundingType.EXTERNAL;
  return null;
};

const parseSubmissionType = (value: string): SubmissionType | null => {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (!normalized) return null;
  if (normalized in SubmissionType) {
    return SubmissionType[normalized as keyof typeof SubmissionType];
  }
  return null;
};

const parseResearchType = (value: string): ResearchTypePHREB | null => {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (!normalized) return null;
  if (normalized in ResearchTypePHREB) {
    return ResearchTypePHREB[normalized as keyof typeof ResearchTypePHREB];
  }
  return null;
};

const parseProponentCategory = (value: string): ProponentCategory | null => {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (!normalized) return null;
  if (normalized in ProponentCategory) {
    return ProponentCategory[normalized as keyof typeof ProponentCategory];
  }
  return null;
};

export const parseProjectCsvUnknownFormat = (
  input: Buffer | string,
  config: ImportConfig = DEFAULT_IMPORT_CONFIG
): ParsedCsvData => {
  const records: string[][] = parse(input, {
    bom: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
    max_record_size: config.maxRecordSize,
  });

  if (!records.length) {
    throw new CsvImportError("CSV file is empty.");
  }

  const detectedHeaders = records[0].map(normalizeHeader);
  if (!detectedHeaders.length || detectedHeaders.every((header) => !header)) {
    throw new CsvImportError("CSV header row is empty.");
  }

  const dataRows = records.slice(1);
  if (!dataRows.length) {
    throw new CsvImportError("CSV file has no data rows.");
  }

  if (dataRows.length > config.maxRows) {
    throw new CsvImportError(`CSV row limit exceeded. Max allowed is ${config.maxRows}.`, 413);
  }

  const rows = dataRows.map((row, index) => {
    const record: Record<string, string> = {};
    detectedHeaders.forEach((header, columnIndex) => {
      const safeHeader = header || `column_${columnIndex + 1}`;
      record[safeHeader] = normalizeValue(row[columnIndex]);
    });

    return {
      rowNumber: index + 2,
      raw: record,
    };
  });

  return {
    detectedHeaders,
    rows,
    receivedRows: rows.length,
  };
};

export const suggestColumnMapping = (detectedHeaders: string[]): ColumnMapping => {
  const mapping: ColumnMapping = {
    projectCode: null,
    title: null,
    piName: null,
    fundingType: null,
    committeeCode: null,
    submissionType: null,
    receivedDate: null,
  };

  const usedHeaders = new Set<string>();
  const normalizedHeaderLookup = detectedHeaders.map((header) => ({
    original: header,
    normalized: normalizeHeaderKey(header),
  }));

  for (const field of REQUIRED_PROJECT_FIELDS) {
    const canonicalKey = normalizeHeaderKey(field);
    const directMatch = normalizedHeaderLookup.find(
      (header) => header.normalized === canonicalKey && !usedHeaders.has(header.original)
    );

    if (directMatch) {
      mapping[field] = directMatch.original;
      usedHeaders.add(directMatch.original);
      continue;
    }

    const synonymSet = new Set(HEADER_SYNONYMS[field].map(normalizeHeaderKey));
    const synonymMatch = normalizedHeaderLookup.find(
      (header) => synonymSet.has(header.normalized) && !usedHeaders.has(header.original)
    );

    if (synonymMatch) {
      mapping[field] = synonymMatch.original;
      usedHeaders.add(synonymMatch.original);
    }
  }

  return mapping;
};

export const buildPreviewPayload = (
  parsed: ParsedCsvData,
  config: ImportConfig = DEFAULT_IMPORT_CONFIG
): PreviewPayload => {
  const suggestedMapping = suggestColumnMapping(parsed.detectedHeaders);
  const missingRequiredFields = REQUIRED_PROJECT_FIELDS.filter(
    (field) => !suggestedMapping[field]
  );

  const warnings: string[] = [];
  if (missingRequiredFields.length > 0) {
    warnings.push("We can't find these required fields. Map columns to continue.");
  }

  const normalizedCounts = new Map<string, number>();
  parsed.detectedHeaders.forEach((header) => {
    const key = normalizeHeaderKey(header);
    normalizedCounts.set(key, (normalizedCounts.get(key) || 0) + 1);
  });
  const duplicateNormalizedHeaders = Array.from(normalizedCounts.values()).some(
    (count) => count > 1
  );
  if (duplicateNormalizedHeaders) {
    warnings.push(
      "Some column headers look duplicated after normalization. Verify your mapping before import."
    );
  }

  return {
    detectedHeaders: parsed.detectedHeaders,
    previewRows: parsed.rows.slice(0, config.previewRows).map((row) => row.raw),
    suggestedMapping,
    missingRequiredFields,
    warnings,
  };
};

const parseMappingPayload = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      throw new CsvImportError("Invalid mapping JSON.");
    }
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  throw new CsvImportError("Invalid mapping payload.");
};

export const normalizeCommitMapping = (
  mappingPayload: unknown,
  detectedHeaders: string[]
): ColumnMapping => {
  const rawMapping = parseMappingPayload(mappingPayload);
  const headerSet = new Set(detectedHeaders);
  const mapping: ColumnMapping = {
    projectCode: null,
    title: null,
    piName: null,
    fundingType: null,
    committeeCode: null,
    submissionType: null,
    receivedDate: null,
  };

  for (const field of REQUIRED_PROJECT_FIELDS) {
    const selectedHeader = rawMapping[field];
    if (typeof selectedHeader !== "string" || !selectedHeader.trim()) {
      mapping[field] = null;
      continue;
    }
    const header = selectedHeader.trim();
    if (!headerSet.has(header)) {
      throw new CsvImportError(`Mapping for ${field} points to an unknown column: ${header}`);
    }
    mapping[field] = header;
  }

  return mapping;
};

export const validateMappedProjectRows = ({
  parsed,
  mapping,
  committeeCodeMap,
  existingProjectCodes,
  config = DEFAULT_IMPORT_CONFIG,
}: {
  parsed: ParsedCsvData;
  mapping: ColumnMapping;
  committeeCodeMap: Map<string, number>;
  existingProjectCodes: Set<string>;
  config?: ImportConfig;
}): { validRows: ValidatedProjectRow[]; errors: RowError[] } => {
  const missingRequiredMapping = REQUIRED_PROJECT_FIELDS.filter((field) => !mapping[field]);
  if (missingRequiredMapping.length > 0) {
    throw new CsvImportError(
      "Required fields are not fully mapped.",
      400,
      { missingRequiredFields: missingRequiredMapping }
    );
  }

  const validRows: ValidatedProjectRow[] = [];
  const errors: RowError[] = [];
  const seenProjectCodes = new Set<string>();

  for (const row of parsed.rows) {
    const rowErrors: RowError[] = [];

    const getMapped = (field: RequiredProjectField) => {
      const header = mapping[field] as string;
      return normalizeValue(row.raw[header]);
    };

    const projectCodeRaw = getMapped("projectCode");
    const title = getMapped("title");
    const piName = getMapped("piName");
    const fundingRaw = getMapped("fundingType");
    const committeeCodeRaw = getMapped("committeeCode");
    const submissionRaw = getMapped("submissionType");
    const receivedRaw = getMapped("receivedDate");

    if (!projectCodeRaw) {
      rowErrors.push({ row: row.rowNumber, field: "projectCode", message: "projectCode is required." });
    }
    if (!title) {
      rowErrors.push({ row: row.rowNumber, field: "title", message: "title is required." });
    }
    if (!piName) {
      rowErrors.push({ row: row.rowNumber, field: "piName", message: "piName is required." });
    }
    if (!fundingRaw) {
      rowErrors.push({ row: row.rowNumber, field: "fundingType", message: "fundingType is required." });
    }
    if (!committeeCodeRaw) {
      rowErrors.push({ row: row.rowNumber, field: "committeeCode", message: "committeeCode is required." });
    }
    if (!submissionRaw) {
      rowErrors.push({ row: row.rowNumber, field: "submissionType", message: "submissionType is required." });
    }
    if (!receivedRaw) {
      rowErrors.push({ row: row.rowNumber, field: "receivedDate", message: "receivedDate is required." });
    }

    const projectCode = normalizeProjectCode(projectCodeRaw);
    if (projectCode) {
      if (seenProjectCodes.has(projectCode)) {
        rowErrors.push({ row: row.rowNumber, field: "projectCode", message: "Duplicate projectCode in CSV." });
      }
      if (existingProjectCodes.has(projectCode)) {
        rowErrors.push({ row: row.rowNumber, field: "projectCode", message: "projectCode already exists." });
      }
      seenProjectCodes.add(projectCode);
    }

    const fundingType = parseFundingType(fundingRaw);
    if (fundingRaw && !fundingType) {
      rowErrors.push({ row: row.rowNumber, field: "fundingType", message: "Invalid fundingType." });
    }

    const submissionType = parseSubmissionType(submissionRaw);
    if (submissionRaw && !submissionType) {
      rowErrors.push({ row: row.rowNumber, field: "submissionType", message: "Invalid submissionType." });
    }

    const receivedDate = parseReceivedDate(receivedRaw);
    if (receivedRaw && !receivedDate) {
      rowErrors.push({ row: row.rowNumber, field: "receivedDate", message: "Invalid receivedDate." });
    }

    const committeeCode = committeeCodeRaw.toUpperCase();
    const committeeId = committeeCodeMap.get(committeeCode);
    if (committeeCodeRaw && !committeeId) {
      rowErrors.push({ row: row.rowNumber, field: "committeeCode", message: "committeeCode does not exist." });
    }

    for (const [field, value] of Object.entries(row.raw)) {
      if (value.length > config.maxFieldLength) {
        rowErrors.push({
          row: row.rowNumber,
          field,
          message: `Field exceeds ${config.maxFieldLength} characters.`,
        });
      }
    }

    const researchRaw = normalizeValue(row.raw.researchTypePHREB);
    const researchType = parseResearchType(researchRaw);
    if (researchRaw && !researchType) {
      rowErrors.push({ row: row.rowNumber, field: "researchTypePHREB", message: "Invalid researchTypePHREB." });
    }

    const researchTypeOther = normalizeValue(row.raw.researchTypePHREBOther) || null;
    const proponentCategoryRaw = normalizeValue(row.raw.proponentCategory);
    const proponentCategory = parseProponentCategory(proponentCategoryRaw);
    if (proponentCategoryRaw && !proponentCategory) {
      rowErrors.push({
        row: row.rowNumber,
        field: "proponentCategory",
        message: "Invalid proponentCategory.",
      });
    }
    if (researchType === ResearchTypePHREB.OTHER && !researchTypeOther) {
      rowErrors.push({
        row: row.rowNumber,
        field: "researchTypePHREBOther",
        message: "researchTypePHREBOther is required when researchTypePHREB is OTHER.",
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    validRows.push({
      rowNumber: row.rowNumber,
      projectCode,
      title,
      piName,
      piAffiliation: normalizeValue(row.raw.piAffiliation) || null,
      collegeOrUnit:
        normalizeValue(row.raw.collegeOrUnit) ||
        normalizeValue(row.raw.piAffiliation) ||
        null,
      proponentCategory: proponentCategory ?? null,
      department: normalizeValue(row.raw.department) || null,
      proponent: normalizeValue(row.raw.proponent) || null,
      fundingType: fundingType!,
      researchTypePHREB: researchType ?? null,
      researchTypePHREBOther: researchTypeOther,
      committeeId: committeeId!,
      submissionType: submissionType!,
      receivedDate: receivedDate!,
      remarks: normalizeValue(row.raw.remarks) || null,
    });
  }

  return { validRows, errors };
};

export const chunkRows = <T>(rows: T[], batchSize: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    chunks.push(rows.slice(i, i + batchSize));
  }
  return chunks;
};
