import {
  CsvImportError,
  buildPreviewPayload,
  normalizeHeaderKey,
  parseProjectCsvUnknownFormat,
  parseReceivedDate,
  suggestColumnMapping,
} from "../../src/services/imports/projectCsvImport";

const buildCsv = (header: string[], rows: string[][]) =>
  [header.join(","), ...rows.map((row) => row.join(","))].join("\n");

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

    expect(preview.detectedHeaders).toEqual(["Project Code", "PI", "Date Received"]);
    expect(preview.suggestedMapping.projectCode).toBe("Project Code");
    expect(preview.suggestedMapping.piName).toBe("PI");
    expect(preview.missingRequiredFields).toEqual([]);
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
