import {
  CsvImportError,
  LEGACY_WIDE_COLUMNS,
  buildPreviewPayload,
  normalizeHeaderKey,
  parseProjectCsvUnknownFormat,
  parseReceivedDate,
  suggestColumnMapping,
} from "../../src/services/imports/projectCsvImport";

const buildCsv = (header: string[], rows: string[][]) =>
  [header.join(","), ...rows.map((row) => row.join(","))].join("\n");

const buildLegacyRow = (overrides: Record<number, string>) => {
  const row = Array.from({ length: LEGACY_WIDE_COLUMNS.length }, () => "");
  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }
  return row;
};

const buildLegacyHeaderRow = () => {
  const row = Array.from({ length: LEGACY_WIDE_COLUMNS.length }, () => "");
  row[0] = "2025";
  row[1] = "Title";
  row[2] = "Project Leader";
  row[3] = "College";
  row[5] = "Date of Submission";
  row[17] = "Panel";
  return row;
};

describe("project CSV import mapping", () => {
  it("normalizes headers and auto-matches synonyms", () => {
    expect(normalizeHeaderKey("Project Code")).toBe("projectcode");
    expect(normalizeHeaderKey("received_date")).toBe("receiveddate");

    const mapping = suggestColumnMapping([
      "Protocol Code",
      "Study Title",
      "Principal Investigator",
      "Funding",
      "Committee",
      "Type of Review",
      "Date Received",
    ]);

    expect(mapping.projectCode).toBe("Protocol Code");
    expect(mapping.piName).toBe("Principal Investigator");
    expect(mapping.receivedDate).toBe("Date Received");
  });

  it("parses receivedDate safely", () => {
    expect(parseReceivedDate("2026-01-31")?.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(parseReceivedDate("01/31/2026")?.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(parseReceivedDate("2/9/26")?.toISOString()).toBe("2026-02-09T00:00:00.000Z");
    expect(parseReceivedDate("2026-02-31")).toBeNull();
    expect(parseReceivedDate("not-a-date")).toBeNull();
  });

  it("preview identifies missing required fields", () => {
    const csv = buildCsv(
      ["Project Code", "PI", "Date Received"],
      [["2026-001", "Dr. A", "2026-01-10"]]
    );

    const parsed = parseProjectCsvUnknownFormat(csv);
    const preview = buildPreviewPayload(parsed);

    expect(parsed.detectedFormat).toBe("headered");
    expect(preview.detectedFormat).toBe("headered");
    expect(preview.detectedHeaders).toEqual(["Project Code", "PI", "Date Received"]);
    expect(preview.suggestedMapping.projectCode).toBe("Project Code");
    expect(preview.suggestedMapping.piName).toBe("PI");
    expect(preview.missingRequiredFields).toEqual([]);
  });

  it("parses legacy headered CSVs into canonical legacy headers", () => {
    const dataRow = buildLegacyRow({
      0: "2026-101A",
      1: "Legacy Title",
      2: "Dr. Legacy",
      5: "2026-01-10",
      9: "INTERNAL",
      10: "BIOMEDICAL",
      16: "Legacy remarks",
      68: "Accepted",
      70: "2026-08-01",
      83: "Prof. Primary",
    });
    const csv = buildCsv(buildLegacyHeaderRow(), [dataRow]);

    const parsed = parseProjectCsvUnknownFormat(csv);
    const preview = buildPreviewPayload(parsed);

    expect(parsed.detectedFormat).toBe("legacy_headered");
    expect(parsed.detectedHeaders).toEqual(LEGACY_WIDE_COLUMNS);
    expect(parsed.rows[0]).toEqual(
      expect.objectContaining({
        rowNumber: 2,
        raw: expect.objectContaining({
          projectCode: "2026-101A",
          title: "Legacy Title",
          fundingType: "INTERNAL",
          progressReportStatus: "Accepted",
          finalReportTargetDate: "2026-08-01",
          primaryReviewer: "Prof. Primary",
        }),
      })
    );
    expect(preview.detectedFormat).toBe("legacy_headered");
    expect(preview.warnings).toContain(
      "Some core fields are missing in this file and will be left blank until backfilled."
    );
  });

  it("parses headerless legacy CSVs and keeps CSV row numbers", () => {
    const dataRow = buildLegacyRow({
      0: "2026-102B",
      1: "Headerless Legacy Title",
      2: "Dr. No Header",
      5: "2026-02-15",
      9: "EXTERNAL",
      67: "2026-07-01",
      68: "Approved",
      69: "12",
    });
    const csv = [dataRow.join(",")].join("\n");

    const parsed = parseProjectCsvUnknownFormat(csv);
    const preview = buildPreviewPayload(parsed);

    expect(parsed.detectedFormat).toBe("legacy_headerless");
    expect(parsed.detectedHeaders).toEqual(LEGACY_WIDE_COLUMNS);
    expect(parsed.rows[0].rowNumber).toBe(1);
    expect(parsed.rows[0].raw).toEqual(
      expect.objectContaining({
        projectCode: "2026-102B",
        title: "Headerless Legacy Title",
        progressReportApprovalDate: "2026-07-01",
        progressReportStatus: "Approved",
        progressReportDays: "12",
      })
    );
    expect(preview.detectedFormat).toBe("legacy_headerless");
    expect(preview.warnings).toContain(
      "No header row detected; using legacy column order."
    );
  });

  it("rejects unsupported headerless non-legacy CSVs", () => {
    const csv = [["2026-001", "Title Only", "Dr. A"].join(",")].join("\n");

    expect(() => parseProjectCsvUnknownFormat(csv)).toThrow(
      "Headerless CSV is only supported for the known legacy RERC export layout."
    );
  });

  it("rejects CSV beyond max rows", () => {
    const csv = buildCsv(
      ["projectCode", "title"],
      Array.from({ length: 2 }, (_, index) => [`P-${index + 1}`, `Title ${index + 1}`])
    );
    expect(() =>
      parseProjectCsvUnknownFormat(csv, {
        maxRows: 1,
        maxFieldLength: 5000,
        maxRecordSize: 200000,
        batchSize: 50,
        previewRows: 20,
      })
    ).toThrow(CsvImportError);
  });
});
