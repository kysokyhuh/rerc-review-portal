import { parse } from "csv-parse/sync";
import {
  FundingType,
  ImportMode,
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

export const MAPPABLE_PROJECT_FIELDS = [
  "projectCode",
  "title",
  "piName",
  "fundingType",
  "committeeCode",
  "submissionType",
  "receivedDate",
] as const;

export const REQUIRED_PROJECT_FIELDS = ["projectCode"] as const;

export type MappableProjectField = (typeof MAPPABLE_PROJECT_FIELDS)[number];
export type RequiredProjectField = (typeof REQUIRED_PROJECT_FIELDS)[number];
export type ProjectField = (typeof PROJECT_IMPORT_HEADERS)[number];
export type ColumnMapping = Record<MappableProjectField, string | null>;
export type ParsedCsvFormat = "headered" | "legacy_headered" | "legacy_headerless";
export type ImportModeFit = "match" | "warn" | "blocked";

export interface ImportWarning {
  code: string;
  message: string;
  row?: number;
  field?: string;
}

export interface ImportConfig {
  maxRows: number;
  maxFieldLength: number;
  maxRecordSize: number;
  batchSize: number;
  previewRows: number;
}

export interface RawCsvRow {
  rowNumber: number;
  raw: Record<string, string>;
}

export interface ParsedCsvData {
  detectedFormat: ParsedCsvFormat;
  detectedHeaders: string[];
  rows: RawCsvRow[];
  receivedRows: number;
}

export interface RowError {
  row: number;
  field: string;
  message: string;
}

export interface ProjectProfileReferenceData {
  title: string | null;
  projectLeader: string | null;
  college: string | null;
  department: string | null;
  dateOfSubmission: Date | null;
  monthOfSubmission: string | null;
  typeOfReview: string | null;
  proponent: string | null;
  funding: string | null;
  typeOfResearchPhreb: string | null;
  typeOfResearchPhrebOther: string | null;
  remarks: string | null;
}

export interface LegacyImportSnapshotData {
  sourceRowNumber: number;
  importedStatus: string | null;
  importedTypeOfReview: string | null;
  importedClassificationOfProposal: string | null;
  importedPanel: string | null;
  importedScientistReviewer: string | null;
  importedLayReviewer: string | null;
  importedPrimaryReviewer: string | null;
  importedFinalLayReviewer: string | null;
  importedIndependentConsultant: string | null;
  importedHonorariumStatus: string | null;
  importedTotalDays: number | null;
  importedSubmissionCount: number | null;
  importedReviewDurationDays: number | null;
  importedClassificationDays: number | null;
  importedFinishDate: Date | null;
  importedClassificationDate: Date | null;
  importedMonthOfClearance: string | null;
  importedWithdrawn: boolean | null;
  importedProjectEndDate6A: Date | null;
  importedClearanceExpiration: Date | null;
  importedProgressReportTargetDate: Date | null;
  importedProgressReportSubmission: Date | null;
  importedProgressReportApprovalDate: Date | null;
  importedProgressReportStatus: string | null;
  importedProgressReportDays: number | null;
  importedFinalReportTargetDate: Date | null;
  importedFinalReportSubmission: Date | null;
  importedFinalReportCompletionDate: Date | null;
  importedFinalReportStatus: string | null;
  importedFinalReportDays: number | null;
  importedAmendmentSubmission: Date | null;
  importedAmendmentStatus: string | null;
  importedAmendmentApprovalDate: Date | null;
  importedAmendmentDays: number | null;
  importedContinuingSubmission: Date | null;
  importedContinuingStatus: string | null;
  importedContinuingApprovalDate: Date | null;
  importedContinuingDays: number | null;
  importedRemarks: string | null;
  rawRowJson: Record<string, string>;
}

export interface PreviewPayload {
  detectedFormat: ParsedCsvFormat;
  detectedHeaders: string[];
  previewRowNumbers: number[];
  previewRows: Record<string, string>[];
  suggestedMapping: ColumnMapping;
  missingRequiredFields: RequiredProjectField[];
  warnings: string[];
  warningItems: ImportWarning[];
  selectedMode: ImportMode;
  recommendedMode: ImportMode;
  modeFit: ImportModeFit;
}

export interface ValidatedProjectRow {
  rowNumber: number;
  raw: Record<string, string>;
  projectCode: string;
  title: string | null;
  piName: string | null;
  piAffiliation: string | null;
  collegeOrUnit: string | null;
  proponentCategory: ProponentCategory | null;
  department: string | null;
  proponent: string | null;
  fundingType: FundingType | null;
  researchTypePHREB: ResearchTypePHREB | null;
  researchTypePHREBOther: string | null;
  committeeId: number;
  submissionType: SubmissionType | null;
  receivedDate: Date | null;
  remarks: string | null;
  referenceProfile: ProjectProfileReferenceData;
  legacySnapshot: LegacyImportSnapshotData | null;
  warnings: ImportWarning[];
}

interface ImportModeAssessment {
  selectedMode: ImportMode;
  recommendedMode: ImportMode;
  modeFit: ImportModeFit;
  warningItems: ImportWarning[];
}

interface NumericParseOptions {
  rowNumber: number;
  field: string;
  min?: number;
  max: number;
}

interface DateParseOptions {
  rowNumber: number;
  field: string;
  mode: ImportMode;
}

export const DEFAULT_IMPORT_CONFIG: ImportConfig = {
  maxRows: Number(process.env.IMPORT_MAX_ROWS || 5000),
  maxFieldLength: Number(process.env.IMPORT_MAX_FIELD_LENGTH || 5000),
  maxRecordSize: Number(process.env.IMPORT_MAX_RECORD_SIZE || 200000),
  batchSize: Number(process.env.IMPORT_BATCH_SIZE || 250),
  previewRows: 20,
};

export const LEGACY_WIDE_COLUMNS = [
  "projectCode",
  "title",
  "piName",
  "college",
  "department",
  "dateOfSubmission",
  "monthOfSubmission",
  "typeOfReview",
  "proponent",
  "fundingType",
  "researchTypePHREB",
  "researchTypePHREBOther",
  "status",
  "finishDate",
  "monthOfClearance",
  "reviewDurationReceiptToFinishDate",
  "remarks",
  "panel",
  "scientistReviewer",
  "layReviewer",
  "independentConsultant",
  "honorariumStatusCoMsMaja",
  "classificationOfProposalRerc",
  "classificationDays",
  "provisionOfProjectProposalDocumentsToPrimaryReviewer",
  "provisionOfProjectProposalDocumentsToPrimaryReviewerDays",
  "accomplishmentOfAssessmentForms",
  "accomplishmentOfAssessmentFormsDays",
  "fullReviewMeeting",
  "fullReviewMeetingDays",
  "finalizationOfReviewResults",
  "finalizationOfReviewResultsDays",
  "communicationOfReviewResultsToProjectLeader",
  "communicationOfReviewResultsToProjectLeaderDays",
  "resubmission1FromProponent",
  "resubmission1FromProponentDays",
  "reviewOfResubmission1",
  "reviewOfResubmission1Days",
  "finalizationOfReviewResultsResubmission1",
  "finalizationOfReviewResultsResubmission1Days",
  "resubmission2FromProponent",
  "resubmission2FromProponentDays",
  "reviewOfResubmission2",
  "reviewOfResubmission2Days",
  "finalizationOfReviewResultsResubmission2",
  "finalizationOfReviewResultsResubmission2Days",
  "resubmission3FromProponent",
  "resubmission3FromProponentDays",
  "reviewOfResubmission3",
  "reviewOfResubmission3Days",
  "finalizationOfReviewResultsResubmission3",
  "finalizationOfReviewResultsResubmission3Days",
  "resubmission4FromProponent",
  "resubmission4FromProponentDays",
  "reviewOfResubmission4",
  "reviewOfResubmission4Days",
  "finalizationOfReviewResultsResubmission4",
  "finalizationOfReviewResultsResubmission4Days",
  "issuanceOfEthicsClearance",
  "issuanceOfEthicsClearanceDays",
  "totalDays",
  "submissionCount",
  "withdrawn",
  "projectEndDate6A",
  "clearanceExpiration",
  "progressReportTargetDate",
  "progressReportSubmission",
  "progressReportApprovalDate",
  "progressReportStatus",
  "progressReportDays",
  "finalReportTargetDate",
  "finalReportSubmission",
  "finalReportCompletionDate",
  "finalReportStatus",
  "finalReportDays",
  "amendmentSubmission",
  "amendmentStatusOfRequest",
  "amendmentApprovalDate",
  "amendmentDays",
  "continuingSubmission",
  "continuingStatusOfRequest",
  "continuingApprovalDate",
  "continuingDays",
  "primaryReviewer",
  "finalLayReviewer",
  "holidays",
  "legacyTrailingValue",
] as const;

const LEGACY_HEADER_ROW_LENGTH = LEGACY_WIDE_COLUMNS.length;
const PROJECT_CODE_PATTERN = /^\d{4}-\d{3}[A-Z]?$/i;

const HEADER_SYNONYMS: Record<MappableProjectField, string[]> = {
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
  submissionType: ["submissiontype", "submission"],
  receivedDate: ["receiveddate", "datereceived", "dateofsubmission", "submissiondate"],
};

const LEGACY_WORKFLOW_ONLY_CANDIDATES = [
  "status",
  "finishDate",
  "monthOfClearance",
  "reviewDurationReceiptToFinishDate",
  "panel",
  "scientistReviewer",
  "layReviewer",
  "independentConsultant",
  "honorariumStatusCoMsMaja",
  "classificationOfProposalRerc",
  "classificationDays",
  "totalDays",
  "submissionCount",
  "withdrawn",
  "projectEndDate6A",
  "clearanceExpiration",
  "progressReportTargetDate",
  "progressReportSubmission",
  "progressReportApprovalDate",
  "progressReportStatus",
  "progressReportDays",
  "finalReportTargetDate",
  "finalReportSubmission",
  "finalReportCompletionDate",
  "finalReportStatus",
  "finalReportDays",
  "amendmentSubmission",
  "amendmentStatusOfRequest",
  "amendmentApprovalDate",
  "amendmentDays",
  "continuingSubmission",
  "continuingStatusOfRequest",
  "continuingApprovalDate",
  "continuingDays",
  "primaryReviewer",
  "finalLayReviewer",
  "classificationdate",
];

const LEGACY_MILESTONE_ONLY_CANDIDATES = [
  "provisionOfProjectProposalDocumentsToPrimaryReviewer",
  "provisionOfProjectProposalDocumentsToPrimaryReviewerDays",
  "accomplishmentOfAssessmentForms",
  "accomplishmentOfAssessmentFormsDays",
  "fullReviewMeeting",
  "fullReviewMeetingDays",
  "finalizationOfReviewResults",
  "finalizationOfReviewResultsDays",
  "communicationOfReviewResultsToProjectLeader",
  "communicationOfReviewResultsToProjectLeaderDays",
  "resubmission1FromProponent",
  "resubmission1FromProponentDays",
  "reviewOfResubmission1",
  "reviewOfResubmission1Days",
  "finalizationOfReviewResultsResubmission1",
  "finalizationOfReviewResultsResubmission1Days",
  "resubmission2FromProponent",
  "resubmission2FromProponentDays",
  "reviewOfResubmission2",
  "reviewOfResubmission2Days",
  "finalizationOfReviewResultsResubmission2",
  "finalizationOfReviewResultsResubmission2Days",
  "resubmission3FromProponent",
  "resubmission3FromProponentDays",
  "reviewOfResubmission3",
  "reviewOfResubmission3Days",
  "finalizationOfReviewResultsResubmission3",
  "finalizationOfReviewResultsResubmission3Days",
  "resubmission4FromProponent",
  "resubmission4FromProponentDays",
  "reviewOfResubmission4",
  "reviewOfResubmission4Days",
  "finalizationOfReviewResultsResubmission4",
  "finalizationOfReviewResultsResubmission4Days",
  "issuanceOfEthicsClearance",
  "issuanceOfEthicsClearanceDays",
];

const normalizeHeader = (value: unknown) => String(value ?? "").trim();
const EXCEL_ERROR_RE = /^#(NAME|VALUE|REF|DIV\/0!|N\/A|NULL!|NUM!)[!?]?$|^#{3,}$/i;
const normalizeValue = (value: unknown) => {
  const str = String(value ?? "").trim();
  return EXCEL_ERROR_RE.test(str) ? "" : str;
};

export const normalizeHeaderKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

export const normalizeProjectCode = (value: string) => value.trim().toUpperCase();

const uniqueWarnings = (warnings: ImportWarning[]) => {
  const byKey = new Map<string, ImportWarning>();
  for (const warning of warnings) {
    const key = [
      warning.code,
      warning.message,
      warning.row ?? "",
      warning.field ?? "",
    ].join("|");
    if (!byKey.has(key)) {
      byKey.set(key, warning);
    }
  }
  return Array.from(byKey.values());
};

const toWarningMessages = (warnings: ImportWarning[]) =>
  uniqueWarnings(warnings).map((warning) => warning.message);

const createWarning = (
  code: string,
  message: string,
  row?: number,
  field?: string
): ImportWarning => ({
  code,
  message,
  ...(typeof row === "number" ? { row } : {}),
  ...(field ? { field } : {}),
});

export class CsvImportError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const parseImportMode = (value: unknown): ImportMode => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return ImportMode.INTAKE_IMPORT;
  if (normalized === ImportMode.INTAKE_IMPORT) return ImportMode.INTAKE_IMPORT;
  if (normalized === ImportMode.LEGACY_MIGRATION) return ImportMode.LEGACY_MIGRATION;
  throw new CsvImportError(`Unsupported import mode: ${value}`, 400);
};

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

const excelSerialToDate = (value: number) => {
  const utc = Date.UTC(1899, 11, 30) + value * 24 * 60 * 60 * 1000;
  const parsed = new Date(utc);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseLegacyDateField = (
  rawValue: string,
  options: DateParseOptions
): { value: Date | null; warnings: ImportWarning[] } => {
  const raw = normalizeValue(rawValue);
  if (!raw) return { value: null, warnings: [] };

  const warnings: ImportWarning[] = [];
  const parsedStandard = parseReceivedDate(raw);
  if (parsedStandard) return { value: parsedStandard, warnings };

  const numeric = Number(raw);
  if (
    options.mode === ImportMode.LEGACY_MIGRATION &&
    Number.isFinite(numeric) &&
    Number.isInteger(numeric) &&
    numeric >= 1 &&
    numeric <= 60000
  ) {
    const excelDate = excelSerialToDate(numeric);
    if (excelDate) {
      warnings.push(
        createWarning(
          "EXCEL_SERIAL_DATE_CONVERTED",
          `${options.field} on row ${options.rowNumber} looked like an Excel serial date and was converted automatically.`,
          options.rowNumber,
          options.field
        )
      );
      return { value: excelDate, warnings };
    }
  }

  warnings.push(
    createWarning(
      "INVALID_LEGACY_DATE",
      `${options.field} on row ${options.rowNumber} could not be parsed and will be stored as blank snapshot data.`,
      options.rowNumber,
      options.field
    )
  );
  return { value: null, warnings };
};

const parseBoundedIntegerField = (
  rawValue: string,
  options: NumericParseOptions
): { value: number | null; warnings: ImportWarning[] } => {
  const raw = normalizeValue(rawValue);
  if (!raw) return { value: null, warnings: [] };

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return {
      value: null,
      warnings: [
        createWarning(
          "INVALID_LEGACY_NUMBER",
          `${options.field} on row ${options.rowNumber} is not a valid number and will be stored as blank snapshot data.`,
          options.rowNumber,
          options.field
        ),
      ],
    };
  }

  const integer = Math.trunc(parsed);
  const min = options.min ?? 0;
  if (integer < min || integer > options.max) {
    return {
      value: null,
      warnings: [
        createWarning(
          "SUSPICIOUS_LEGACY_NUMBER",
          `${options.field} on row ${options.rowNumber} is outside the allowed range and will be stored as blank snapshot data.`,
          options.rowNumber,
          options.field
        ),
      ],
    };
  }

  return { value: integer, warnings: [] };
};

const parseNullableBooleanField = (rawValue: string) => {
  const normalized = normalizeValue(rawValue).toLowerCase();
  if (!normalized) return null;
  if (["yes", "true", "1"].includes(normalized)) return true;
  if (["no", "false", "0"].includes(normalized)) return false;
  return null;
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
  if (compact.includes("GOVERNMENT") || compact.includes("GRANT")) return FundingType.EXTERNAL;
  if (compact === "OTHERS" || compact === "OTHER") return FundingType.EXTERNAL;
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
  const raw = value.trim();
  const normalized = raw.toUpperCase().replace(/\s+/g, "_");
  if (!normalized) return null;
  if (normalized in ProponentCategory) {
    return ProponentCategory[normalized as keyof typeof ProponentCategory];
  }
  const compact = normalized.replace(/[^A-Z]/g, "");
  if (compact.includes("UNDERGRAD")) return ProponentCategory.UNDERGRAD;
  if (compact === "GRAD" || compact.includes("GRADUATE")) return ProponentCategory.GRAD;
  if (compact.includes("FACULTY")) return ProponentCategory.FACULTY;
  if (compact.includes("NONTEACH") || compact.includes("STAFF") || compact.includes("OTHER")) {
    return ProponentCategory.OTHER;
  }
  return null;
};

const getRawByCandidates = (raw: Record<string, string>, candidates: string[]) => {
  const byNormalized = new Map<string, string>();
  for (const [header, value] of Object.entries(raw)) {
    byNormalized.set(normalizeHeaderKey(header), normalizeValue(value));
  }
  for (const candidate of candidates) {
    const matched = byNormalized.get(normalizeHeaderKey(candidate));
    if (matched) return matched;
  }
  return "";
};

const looksLikeLegacyHeaderRow = (row: string[]) => {
  if (row.length !== LEGACY_HEADER_ROW_LENGTH) {
    return false;
  }

  const firstCell = normalizeValue(row[0]);
  return (
    /^\d{4}$/.test(firstCell) &&
    normalizeHeaderKey(normalizeHeader(row[1])) === normalizeHeaderKey("Title") &&
    normalizeHeaderKey(normalizeHeader(row[2])) === normalizeHeaderKey("Project Leader") &&
    normalizeHeaderKey(normalizeHeader(row[5])) === normalizeHeaderKey("Date of Submission") &&
    normalizeHeaderKey(normalizeHeader(row[17])) === normalizeHeaderKey("Panel")
  );
};

const looksLikeLegacyHeaderlessRow = (row: string[]) =>
  row.length === LEGACY_HEADER_ROW_LENGTH && PROJECT_CODE_PATTERN.test(normalizeValue(row[0]));

const looksLikeUnsupportedHeaderlessRow = (row: string[]) =>
  PROJECT_CODE_PATTERN.test(normalizeValue(row[0]));

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

  const firstRow = records[0] ?? [];
  let detectedFormat: ParsedCsvFormat;
  let detectedHeaders: string[];
  let dataRows: string[][];
  let firstDataRowNumber: number;

  if (looksLikeLegacyHeaderRow(firstRow)) {
    detectedFormat = "legacy_headered";
    detectedHeaders = [...LEGACY_WIDE_COLUMNS];
    dataRows = records.slice(1);
    firstDataRowNumber = 2;
  } else if (looksLikeLegacyHeaderlessRow(firstRow)) {
    detectedFormat = "legacy_headerless";
    detectedHeaders = [...LEGACY_WIDE_COLUMNS];
    dataRows = records;
    firstDataRowNumber = 1;
  } else {
    const normalizedHeaders = firstRow.map(normalizeHeader);
    if (!normalizedHeaders.length || normalizedHeaders.every((header) => !header)) {
      throw new CsvImportError("CSV header row is empty.");
    }
    if (looksLikeUnsupportedHeaderlessRow(firstRow)) {
      throw new CsvImportError(
        "Headerless CSV is only supported for the known legacy RERC export layout."
      );
    }

    detectedFormat = "headered";
    detectedHeaders = normalizedHeaders;
    dataRows = records.slice(1);
    firstDataRowNumber = 2;
  }

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
      rowNumber: index + firstDataRowNumber,
      raw: record,
    };
  });

  return {
    detectedFormat,
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

  if (detectedHeaders.length > 0) {
    mapping.projectCode = detectedHeaders[0];
    usedHeaders.add(detectedHeaders[0]);
  }

  for (const field of MAPPABLE_PROJECT_FIELDS) {
    if (field === "projectCode") continue;
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

const getNormalizedHeadersWithValues = (parsed: ParsedCsvData, candidates: string[]) => {
  const matchedHeaders = parsed.detectedHeaders.filter((header) =>
    candidates.includes(normalizeHeaderKey(header))
  );

  return matchedHeaders.filter((header) =>
    parsed.rows.some((row) => normalizeValue(row.raw[header]).length > 0)
  );
};

export const assessImportMode = (
  parsed: ParsedCsvData,
  selectedMode: ImportMode
): ImportModeAssessment => {
  const populatedLegacyHeaders = getNormalizedHeadersWithValues(
    parsed,
    LEGACY_WORKFLOW_ONLY_CANDIDATES
  );
  const populatedMilestoneHeaders = getNormalizedHeadersWithValues(
    parsed,
    LEGACY_MILESTONE_ONLY_CANDIDATES
  );

  const hasLegacyFormat = parsed.detectedFormat !== "headered";
  const hasLegacyWorkflowValues =
    populatedLegacyHeaders.length > 0 || populatedMilestoneHeaders.length > 0;
  const recommendedMode =
    hasLegacyFormat || hasLegacyWorkflowValues
      ? ImportMode.LEGACY_MIGRATION
      : ImportMode.INTAKE_IMPORT;

  const warningItems: ImportWarning[] = [];
  if (populatedLegacyHeaders.length > 0) {
    warningItems.push(
      createWarning(
        "LEGACY_WORKFLOW_COLUMNS",
        "Legacy workflow columns detected. These values will be imported as read-only spreadsheet snapshot data and will not override live portal workflow records."
      )
    );
  }
  if (populatedMilestoneHeaders.length > 0) {
    warningItems.push(
      createWarning(
        "LEGACY_MILESTONE_COLUMNS",
        "Legacy milestone/date columns detected. These values will not create live ProtocolMilestone or workflow-event rows."
      )
    );
  }

  let modeFit: ImportModeFit = "match";
  if (selectedMode === ImportMode.INTAKE_IMPORT) {
    if (parsed.detectedFormat === "legacy_headerless" || hasLegacyWorkflowValues) {
      modeFit = "blocked";
      warningItems.push(
        createWarning(
          "MODE_MISMATCH_BLOCKED",
          "Selected intake import mode does not fit this file. Use Legacy Migration for legacy exports or files with populated legacy workflow columns."
        )
      );
    } else if (parsed.detectedFormat === "legacy_headered") {
      modeFit = "warn";
      warningItems.push(
        createWarning(
          "MODE_MISMATCH_WARNING",
          "This file matches the legacy export layout. Intake import can continue only because the legacy workflow columns are empty."
        )
      );
    }
  } else if (selectedMode === ImportMode.LEGACY_MIGRATION && recommendedMode === ImportMode.INTAKE_IMPORT) {
    modeFit = "warn";
    warningItems.push(
      createWarning(
        "MODE_MISMATCH_WARNING",
        "This file looks like a normal intake CSV. Legacy migration can continue, but the imported snapshot may be mostly empty."
      )
    );
  }

  return {
    selectedMode,
    recommendedMode,
    modeFit,
    warningItems: uniqueWarnings(warningItems),
  };
};

const collectRowPreviewWarnings = (parsed: ParsedCsvData, mode: ImportMode, previewRows: number) => {
  if (mode !== ImportMode.LEGACY_MIGRATION) {
    return [] as ImportWarning[];
  }

  return uniqueWarnings(
    parsed.rows
      .slice(0, previewRows)
      .flatMap((row) => extractLegacySnapshot(row.raw, row.rowNumber, mode).warnings)
  );
};

export const buildPreviewPayload = (
  parsed: ParsedCsvData,
  selectedMode: ImportMode = ImportMode.INTAKE_IMPORT,
  config: ImportConfig = DEFAULT_IMPORT_CONFIG
): PreviewPayload => {
  const suggestedMapping = suggestColumnMapping(parsed.detectedHeaders);
  const missingRequiredFields = REQUIRED_PROJECT_FIELDS.filter(
    (field) => !suggestedMapping[field]
  );
  const assessment = assessImportMode(parsed, selectedMode);

  const warnings: ImportWarning[] = [...assessment.warningItems];
  if (missingRequiredFields.length > 0) {
    warnings.push(
      createWarning(
        "MISSING_REQUIRED_FIELDS",
        "We can't find these required fields. Map columns to continue."
      )
    );
  }

  const missingOptionalCoreFields = MAPPABLE_PROJECT_FIELDS.filter(
    (field) =>
      !REQUIRED_PROJECT_FIELDS.includes(field as RequiredProjectField) &&
      !suggestedMapping[field]
  );
  if (missingOptionalCoreFields.length > 0) {
    warnings.push(
      createWarning(
        "MISSING_OPTIONAL_CORE_FIELDS",
        "Some core fields are missing in this file and will be left blank until backfilled."
      )
    );
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
      createWarning(
        "DUPLICATE_HEADERS_AFTER_NORMALIZATION",
        "Some column headers look duplicated after normalization. Verify your mapping before import."
      )
    );
  }
  if (parsed.detectedFormat === "legacy_headerless") {
    warnings.push(
      createWarning(
        "LEGACY_HEADERLESS",
        "No header row detected; using legacy column order."
      )
    );
  }

  warnings.push(...collectRowPreviewWarnings(parsed, selectedMode, config.previewRows));

  return {
    detectedFormat: parsed.detectedFormat,
    detectedHeaders: parsed.detectedHeaders,
    previewRowNumbers: parsed.rows.slice(0, config.previewRows).map((row) => row.rowNumber),
    previewRows: parsed.rows.slice(0, config.previewRows).map((row) => row.raw),
    suggestedMapping,
    missingRequiredFields,
    warnings: toWarningMessages(warnings),
    warningItems: uniqueWarnings(warnings),
    selectedMode: assessment.selectedMode,
    recommendedMode: assessment.recommendedMode,
    modeFit: assessment.modeFit,
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

  for (const field of MAPPABLE_PROJECT_FIELDS) {
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

const buildReferenceProfile = (params: {
  row: RawCsvRow;
  title: string | null;
  piName: string | null;
  collegeOrUnit: string | null;
  department: string | null;
  proponent: string | null;
  receivedDate: Date | null;
  fundingType: FundingType | null;
}) : ProjectProfileReferenceData => {
  const { row, title, piName, collegeOrUnit, department, proponent, receivedDate, fundingType } = params;
  return {
    title: getRawByCandidates(row.raw, ["title", "Project Title"]) || title || null,
    projectLeader:
      getRawByCandidates(row.raw, ["projectLeader", "Project Leader", "PI Name"]) ||
      piName ||
      null,
    college:
      getRawByCandidates(row.raw, [
        "college",
        "College",
        "College / Service Unit",
        "College/Service Unit",
        "College/Unit",
      ]) ||
      collegeOrUnit ||
      null,
    department: getRawByCandidates(row.raw, ["department", "Department"]) || department || null,
    dateOfSubmission:
      parseReceivedDate(getRawByCandidates(row.raw, ["dateOfSubmission", "Date of Submission"])) ||
      receivedDate,
    monthOfSubmission:
      getRawByCandidates(row.raw, ["monthOfSubmission", "Month of Submission"]) || null,
    typeOfReview: getRawByCandidates(row.raw, ["typeOfReview", "Type of Review"]) || null,
    proponent: getRawByCandidates(row.raw, ["proponent", "Proponent"]) || proponent || null,
    funding:
      getRawByCandidates(row.raw, ["funding", "Funding", "Funding Type"]) ||
      fundingType ||
      null,
    typeOfResearchPhreb:
      getRawByCandidates(row.raw, ["researchTypePHREB", "Type of Research PHREB"]) || null,
    typeOfResearchPhrebOther:
      getRawByCandidates(row.raw, [
        "researchTypePHREBOther",
        "Type of Research PHREB (Specific for Others)",
      ]) || null,
    remarks: getRawByCandidates(row.raw, ["remarks", "Remarks"]) || null,
  };
};

const extractLegacySnapshot = (
  raw: Record<string, string>,
  rowNumber: number,
  mode: ImportMode
): { snapshot: LegacyImportSnapshotData; warnings: ImportWarning[] } => {
  const warnings: ImportWarning[] = [];
  const parseDateCandidate = (field: string, candidates: string[]) => {
    const parsed = parseLegacyDateField(getRawByCandidates(raw, candidates), {
      rowNumber,
      field,
      mode,
    });
    warnings.push(...parsed.warnings);
    return parsed.value;
  };
  const parseIntCandidate = (
    field: string,
    candidates: string[],
    max: number
  ) => {
    const parsed = parseBoundedIntegerField(getRawByCandidates(raw, candidates), {
      rowNumber,
      field,
      max,
    });
    warnings.push(...parsed.warnings);
    return parsed.value;
  };

  return {
    snapshot: {
      sourceRowNumber: rowNumber,
      importedStatus: getRawByCandidates(raw, ["status", "Status"]) || null,
      importedTypeOfReview: getRawByCandidates(raw, ["typeOfReview", "Type of Review"]) || null,
      importedClassificationOfProposal:
        getRawByCandidates(raw, [
          "classificationOfProposalRerc",
          "Classification of Proposal (RERC)",
        ]) || null,
      importedPanel: getRawByCandidates(raw, ["panel", "Panel"]) || null,
      importedScientistReviewer:
        getRawByCandidates(raw, ["scientistReviewer", "Scientist Reviewer"]) || null,
      importedLayReviewer: getRawByCandidates(raw, ["layReviewer", "Lay Reviewer"]) || null,
      importedPrimaryReviewer:
        getRawByCandidates(raw, ["primaryReviewer", "Primary Reviewer"]) || null,
      importedFinalLayReviewer:
        getRawByCandidates(raw, [
          "finalLayReviewer",
          "Final Lay Reviewer",
          "Lay Reviewer (Final)",
        ]) || null,
      importedIndependentConsultant:
        getRawByCandidates(raw, [
          "independentConsultant",
          "Independent Consultant",
          "Independent Consultant (if applicable)",
        ]) || null,
      importedHonorariumStatus:
        getRawByCandidates(raw, [
          "honorariumStatusCoMsMaja",
          "Honorarium Status (c/o Ms. Maja)",
          "Honorarium Status",
        ]) || null,
      importedTotalDays: parseIntCandidate("totalDays", ["totalDays", "Total days"], 3650),
      importedSubmissionCount: parseIntCandidate(
        "submissionCount",
        ["submissionCount", "# Submissions"],
        100
      ),
      importedReviewDurationDays: parseIntCandidate(
        "reviewDurationDays",
        ["reviewDurationReceiptToFinishDate", "Review Duration (Receipt to Finish date)"],
        3650
      ),
      importedClassificationDays: parseIntCandidate(
        "classificationDays",
        ["classificationDays", "# days"],
        3650
      ),
      importedFinishDate: parseDateCandidate("finishDate", ["finishDate", "Finish Date"]),
      importedClassificationDate: parseDateCandidate("classificationDate", [
        "classificationDate",
        "Classification Date",
      ]),
      importedMonthOfClearance:
        getRawByCandidates(raw, ["monthOfClearance", "Month of Clearance"]) || null,
      importedWithdrawn: parseNullableBooleanField(
        getRawByCandidates(raw, ["withdrawn", "Withdrawn"])
      ),
      importedProjectEndDate6A: parseDateCandidate("projectEndDate6A", [
        "projectEndDate6A",
        "Project End Date (6A)",
      ]),
      importedClearanceExpiration: parseDateCandidate("clearanceExpiration", [
        "clearanceExpiration",
        "Clearance Expiration",
      ]),
      importedProgressReportTargetDate: parseDateCandidate("progressReportTargetDate", [
        "progressReportTargetDate",
        "Progress Report [Target Date]",
      ]),
      importedProgressReportSubmission: parseDateCandidate("progressReportSubmission", [
        "progressReportSubmission",
        "Progress Report [Submission]",
      ]),
      importedProgressReportApprovalDate: parseDateCandidate("progressReportApprovalDate", [
        "progressReportApprovalDate",
        "Progress Report [Approval Date]",
      ]),
      importedProgressReportStatus:
        getRawByCandidates(raw, ["progressReportStatus", "Progress Report Status"]) || null,
      importedProgressReportDays: parseIntCandidate(
        "progressReportDays",
        ["progressReportDays", "Progress Report # of Days", "Progress Report # Days"],
        3650
      ),
      importedFinalReportTargetDate: parseDateCandidate("finalReportTargetDate", [
        "finalReportTargetDate",
        "Final Report [Target Date]",
      ]),
      importedFinalReportSubmission: parseDateCandidate("finalReportSubmission", [
        "finalReportSubmission",
        "Final Report [Submission]",
      ]),
      importedFinalReportCompletionDate: parseDateCandidate("finalReportCompletionDate", [
        "finalReportCompletionDate",
        "Final Report [Completion Date]",
      ]),
      importedFinalReportStatus:
        getRawByCandidates(raw, ["finalReportStatus", "Final Report Status"]) || null,
      importedFinalReportDays: parseIntCandidate(
        "finalReportDays",
        ["finalReportDays", "Final Report # of Days", "Final Report # Days"],
        3650
      ),
      importedAmendmentSubmission: parseDateCandidate("amendmentSubmission", [
        "amendmentSubmission",
        "Amendment [Submission]",
        "Amendment Submission",
      ]),
      importedAmendmentStatus:
        getRawByCandidates(raw, [
          "amendmentStatusOfRequest",
          "Amendment Status of Request",
          "Status of Request",
        ]) || null,
      importedAmendmentApprovalDate: parseDateCandidate("amendmentApprovalDate", [
        "amendmentApprovalDate",
        "Amendment Approval Date",
        "Approval Date",
      ]),
      importedAmendmentDays: parseIntCandidate(
        "amendmentDays",
        ["amendmentDays", "Amendment # of Days", "Amendment Days"],
        3650
      ),
      importedContinuingSubmission: parseDateCandidate("continuingSubmission", [
        "continuingSubmission",
        "Continuing [Submission]",
      ]),
      importedContinuingStatus:
        getRawByCandidates(raw, [
          "continuingStatusOfRequest",
          "Continuing Status of Request",
        ]) || null,
      importedContinuingApprovalDate: parseDateCandidate("continuingApprovalDate", [
        "continuingApprovalDate",
        "Continuing Approval Date",
      ]),
      importedContinuingDays: parseIntCandidate(
        "continuingDays",
        ["continuingDays", "Continuing # of Days"],
        3650
      ),
      importedRemarks: getRawByCandidates(raw, ["remarks", "Remarks"]) || null,
      rawRowJson: { ...raw },
    },
    warnings: uniqueWarnings(warnings),
  };
};

export const validateMappedProjectRows = ({
  parsed,
  mapping,
  committeeCodeMap,
  defaultCommitteeId = null,
  existingProjectCodes,
  config = DEFAULT_IMPORT_CONFIG,
  mode,
}: {
  parsed: ParsedCsvData;
  mapping: ColumnMapping;
  committeeCodeMap: Map<string, number>;
  defaultCommitteeId?: number | null;
  existingProjectCodes: Set<string>;
  config?: ImportConfig;
  mode: ImportMode;
}): { validRows: ValidatedProjectRow[]; errors: RowError[]; warnings: ImportWarning[] } => {
  const assessment = assessImportMode(parsed, mode);
  if (assessment.modeFit === "blocked") {
    throw new CsvImportError("Selected import mode does not fit this CSV.", 400, {
      selectedMode: mode,
      recommendedMode: assessment.recommendedMode,
      warnings: assessment.warningItems,
    });
  }

  const missingRequiredMapping = REQUIRED_PROJECT_FIELDS.filter((field) => !mapping[field]);
  if (missingRequiredMapping.length > 0) {
    throw new CsvImportError("Required fields are not fully mapped.", 400, {
      missingRequiredFields: missingRequiredMapping,
    });
  }

  const validRows: ValidatedProjectRow[] = [];
  const errors: RowError[] = [];
  const warnings: ImportWarning[] = [...assessment.warningItems];
  const seenProjectCodes = new Set<string>();

  for (const row of parsed.rows) {
    const rowErrors: RowError[] = [];

    const getMapped = (field: MappableProjectField) => {
      const header = mapping[field];
      if (!header) return "";
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
      rowErrors.push({
        row: row.rowNumber,
        field: "projectCode",
        message: "projectCode is required.",
      });
    }
    const projectCode = normalizeProjectCode(projectCodeRaw);
    if (projectCode) {
      if (seenProjectCodes.has(projectCode)) {
        rowErrors.push({
          row: row.rowNumber,
          field: "projectCode",
          message: "Duplicate projectCode in CSV.",
        });
      }
      if (existingProjectCodes.has(projectCode)) {
        rowErrors.push({
          row: row.rowNumber,
          field: "projectCode",
          message: "projectCode already exists.",
        });
      }
      seenProjectCodes.add(projectCode);
    }

    const fundingType = parseFundingType(fundingRaw);
    if (fundingRaw && !fundingType) {
      rowErrors.push({
        row: row.rowNumber,
        field: "fundingType",
        message: "Invalid fundingType.",
      });
    }

    const submissionType = parseSubmissionType(submissionRaw);
    if (submissionRaw && !submissionType) {
      rowErrors.push({
        row: row.rowNumber,
        field: "submissionType",
        message: "Invalid submissionType.",
      });
    }

    const receivedDate = parseReceivedDate(receivedRaw);
    if (receivedRaw && !receivedDate) {
      rowErrors.push({
        row: row.rowNumber,
        field: "receivedDate",
        message: "Invalid receivedDate.",
      });
    }

    const committeeCode = committeeCodeRaw.toUpperCase();
    const committeeId = committeeCodeRaw
      ? committeeCodeMap.get(committeeCode) ?? null
      : defaultCommitteeId;
    if (committeeCodeRaw && !committeeId) {
      rowErrors.push({
        row: row.rowNumber,
        field: "committeeCode",
        message: "committeeCode does not exist.",
      });
    }
    if (!committeeId) {
      rowErrors.push({
        row: row.rowNumber,
        field: "committeeCode",
        message: "committeeCode is required unless a default intake committee is configured.",
      });
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

    const researchRaw = getRawByCandidates(row.raw, [
      "researchTypePHREB",
      "Type of Research PHREB",
    ]);
    const researchType = parseResearchType(researchRaw);
    if (researchRaw && !researchType) {
      rowErrors.push({
        row: row.rowNumber,
        field: "researchTypePHREB",
        message: "Invalid researchTypePHREB.",
      });
    }

    const researchTypeOther =
      getRawByCandidates(row.raw, [
        "researchTypePHREBOther",
        "Type of Research PHREB (Specific for Others)",
      ]) || null;
    const proponentCategoryRaw = getRawByCandidates(row.raw, [
      "proponentCategory",
      "Proponent Category",
      "Proponent",
    ]);
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

    const piAffiliation =
      getRawByCandidates(row.raw, [
        "piAffiliation",
        "PI Affiliation",
        "Affiliation",
        "College",
        "College / Service Unit",
        "College/Service Unit",
        "College/Unit",
      ]) || null;
    const collegeOrUnit =
      getRawByCandidates(row.raw, [
        "collegeOrUnit",
        "collegeOrserviceUnit",
        "College",
        "College / Service Unit",
        "College/Service Unit",
        "College/Unit",
        "Service Unit",
        "Unit",
      ]) ||
      piAffiliation ||
      null;
    const department =
      getRawByCandidates(row.raw, ["department", "Department"]) || null;
    const proponent =
      getRawByCandidates(row.raw, ["proponent", "Proponent"]) || null;
    const remarks = getRawByCandidates(row.raw, ["remarks", "Remarks"]) || null;

    const referenceProfile = buildReferenceProfile({
      row,
      title: title || null,
      piName: piName || null,
      collegeOrUnit,
      department,
      proponent,
      receivedDate,
      fundingType,
    });
    const legacyResult =
      mode === ImportMode.LEGACY_MIGRATION
        ? extractLegacySnapshot(row.raw, row.rowNumber, mode)
        : { snapshot: null, warnings: [] as ImportWarning[] };

    warnings.push(...legacyResult.warnings);
    validRows.push({
      rowNumber: row.rowNumber,
      raw: row.raw,
      projectCode,
      title: title || null,
      piName: piName || null,
      piAffiliation,
      collegeOrUnit,
      proponentCategory: proponentCategory ?? null,
      department,
      proponent,
      fundingType: fundingType ?? null,
      researchTypePHREB: researchType ?? null,
      researchTypePHREBOther: researchTypeOther,
      committeeId: committeeId!,
      submissionType: submissionType ?? null,
      receivedDate: receivedDate ?? null,
      remarks,
      referenceProfile,
      legacySnapshot: legacyResult.snapshot,
      warnings: legacyResult.warnings,
    });
  }

  return { validRows, errors, warnings: uniqueWarnings(warnings) };
};

export const chunkRows = <T>(rows: T[], batchSize: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    chunks.push(rows.slice(i, i + batchSize));
  }
  return chunks;
};
