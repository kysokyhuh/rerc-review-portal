import ExcelJS from "exceljs";
import {
  CsvImportError,
  DEFAULT_IMPORT_CONFIG,
  LEGACY_WIDE_COLUMNS,
  parseProjectCsvUnknownFormat,
  type ImportConfig,
  type ParsedCsvData,
} from "./projectCsvImport";

// Matches Excel error strings that should be treated as empty
const EXCEL_ERROR_RE = /^#(NAME|VALUE|REF|DIV\/0!|N\/A|NULL!|NUM!)[!?]?$|^#{3,}$/i;

const LEGACY_COLUMN_COUNT = LEGACY_WIDE_COLUMNS.length;

/**
 * Format a JS Date as YYYY-MM-DD (UTC).
 * All legacy dates are stored as UTC midnight strings to match
 * the format expected by parseLegacyDateField downstream.
 */
const toIsoDateString = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Extract a clean string value from an exceljs cell using the priority chain:
 *   1. Formula cached result (cell.result) — recovers NETWORKDAYS, EDATE, TEXT(), etc.
 *   2. Typed date value — outputs ISO date string
 *   3. Typed number value — outputs numeric string
 *   4. Text / rich-text / boolean value
 *   5. Error / null → empty string
 *
 * Excel error strings (#NAME?, #VALUE!, etc.) are always stripped to "".
 */
const extractCellText = (cell: ExcelJS.Cell): string => {
  const { type } = cell;
  const V = ExcelJS.ValueType;

  // Empty or merged
  if (type === V.Null || type === V.Merge) return "";

  // Error cell (cell itself is an error)
  if (type === V.Error) return "";

  // Formula cell — use the cached result Excel stored
  if (type === V.Formula) {
    const formulaValue = cell.value as ExcelJS.CellFormulaValue;
    const result = formulaValue?.result;

    if (result === null || result === undefined) return "";

    // Formula evaluated to an error (e.g. #NAME? because holidays range missing)
    if (
      typeof result === "object" &&
      result !== null &&
      "error" in (result as object)
    ) {
      return "";
    }

    // Formula result is a Date (e.g. EDATE, date arithmetic)
    if (result instanceof Date) {
      return isNaN(result.getTime()) ? "" : toIsoDateString(result);
    }

    // Formula result is a number (e.g. NETWORKDAYS, SUM, day count)
    if (typeof result === "number") {
      return Number.isFinite(result) ? String(Math.round(result * 100) / 100) : "";
    }

    // Formula result is boolean
    if (typeof result === "boolean") return result ? "TRUE" : "FALSE";

    // Formula result is a string
    const str = String(result).trim();
    return EXCEL_ERROR_RE.test(str) ? "" : str;
  }

  // Typed date (non-formula date cell)
  if (type === V.Date) {
    const date = cell.value as Date;
    if (!(date instanceof Date) || isNaN(date.getTime())) return "";
    return toIsoDateString(date);
  }

  // Number
  if (type === V.Number) {
    const n = cell.value as number;
    return Number.isFinite(n) ? String(n) : "";
  }

  // Boolean
  if (type === V.Boolean) {
    return (cell.value as boolean) ? "TRUE" : "FALSE";
  }

  // Shared string
  if (type === V.SharedString) {
    const str = String(cell.value ?? "").trim();
    return EXCEL_ERROR_RE.test(str) ? "" : str;
  }

  // Rich text
  if (type === V.RichText) {
    const rich = cell.value as ExcelJS.CellRichTextValue;
    const str = (rich?.richText ?? []).map((r) => r.text).join("").trim();
    return EXCEL_ERROR_RE.test(str) ? "" : str;
  }

  // Plain string / hyperlink / anything else
  const raw = String(cell.value ?? "").trim();
  return EXCEL_ERROR_RE.test(raw) ? "" : raw;
};

/**
 * Escape a value for inclusion in a CSV cell (RFC 4180).
 * Always wraps in quotes so commas, newlines, and quotes inside values
 * are handled correctly when passed to the downstream CSV parser.
 */
const toCsvCell = (value: string): string => `"${value.replace(/"/g, '""')}"`;

/**
 * Parse a project XLSX workbook for legacy migration.
 *
 * Strategy:
 *   1. Read all cells from the first worksheet using exceljs.
 *   2. Apply the cell-value priority chain (formula cached result → typed → text).
 *   3. Reconstruct the data as a clean CSV string (Excel errors → "", dates → ISO).
 *   4. Feed the clean CSV string through the existing parseProjectCsvUnknownFormat
 *      so all downstream detection, mapping, and validation logic is reused unchanged.
 *
 * This means the XLSX parser produces the exact same ParsedCsvData shape as the
 * CSV parser — the rest of the pipeline (buildPreviewPayload, validateMappedProjectRows,
 * the commit route) requires zero changes.
 */
export const parseProjectXlsxForLegacyMigration = async (
  buffer: Buffer | ArrayBuffer,
  config: ImportConfig = DEFAULT_IMPORT_CONFIG
): Promise<ParsedCsvData> => {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  try {
    await workbook.xlsx.load(arrayBuffer as ArrayBuffer);
  } catch {
    throw new CsvImportError(
      "Could not read XLSX file. Make sure the file is a valid Excel workbook (.xlsx).",
      400
    );
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new CsvImportError("XLSX file contains no worksheets.", 400);
  }

  // Collect all non-empty rows up to the row limit
  const rawRows: string[][] = [];
  let rowCount = 0;

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    rowCount++;
    if (rowCount > config.maxRows + 1) return; // +1 for possible header row

    const cells: string[] = [];
    for (let col = 1; col <= LEGACY_COLUMN_COUNT; col++) {
      cells.push(extractCellText(row.getCell(col)));
    }
    rawRows.push(cells);
  });

  if (rawRows.length === 0) {
    throw new CsvImportError("XLSX file is empty.", 400);
  }

  if (rowCount > config.maxRows + 1) {
    throw new CsvImportError(
      `XLSX file exceeds the maximum of ${config.maxRows} data rows.`,
      400
    );
  }

  // Rebuild as a clean CSV string and feed through the existing parser.
  // All Excel errors have already been stripped; dates are ISO strings;
  // formula cached results are plain numbers or strings.
  const csvString = rawRows
    .map((row) => row.map(toCsvCell).join(","))
    .join("\n");

  return parseProjectCsvUnknownFormat(csvString, config);
};
