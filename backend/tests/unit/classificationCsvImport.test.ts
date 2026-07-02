import { ReviewType, SubmissionStatus } from "../../src/generated/prisma/enums";
import {
  buildClassificationPreviewRows,
  ClassificationCsvImportError,
  mergeImportedRationale,
  normalizeClassificationTitle,
  parseClassificationCsv,
  parseClassificationReviewType,
  summarizeClassificationPreview,
} from "../../src/services/imports/classificationCsvImport";

const buildCsv = (header: string[], rows: string[][]) =>
  [header.join(","), ...rows.map((row) => row.map((value) => `"${value}"`).join(","))].join("\n");

describe("classification CSV import", () => {
  it("requires the Title header", () => {
    const csv = buildCsv(["No.", "Recommended Type of Review"], [["1", "Exempted"]]);

    expect(() => parseClassificationCsv(csv)).toThrow(ClassificationCsvImportError);
    expect(() => parseClassificationCsv(csv)).toThrow("Required classification headers are missing.");
  });

  it("parses classification rows and maps review types", () => {
    const csv = buildCsv(
      [
        "No.",
        "Title",
        "Proponent",
        "Recommended Type of Review",
        "Remarks/Justification",
        "Notes/Summary of Research",
      ],
      [
        [
          "1",
          "A Study on Health",
          "Dr. A",
          "Expedited - 3",
          "Low risk",
          "Survey protocol",
        ],
      ]
    );

    const parsed = parseClassificationCsv(csv);

    expect(parsed.detectedHeaders).toContain("Title");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toEqual(
      expect.objectContaining({
        rowNumber: 2,
        title: "A Study on Health",
        proponent: "Dr. A",
        reviewType: ReviewType.EXPEDITED,
      })
    );
    expect(parsed.rows[0].rationale).toContain("Remarks/Justification: Low risk");
    expect(parsed.rows[0].rationale).toContain("Notes/Summary of Research: Survey protocol");
  });

  it("normalizes titles and parses supported review labels", () => {
    expect(normalizeClassificationTitle("  A   Protocol Title ")).toBe("a protocol title");
    expect(parseClassificationReviewType("Exempted*")).toBe(ReviewType.EXEMPT);
    expect(parseClassificationReviewType("Expedited - 3")).toBe(ReviewType.EXPEDITED);
    expect(parseClassificationReviewType("Full - 1")).toBe(ReviewType.FULL_BOARD);
    expect(parseClassificationReviewType("recommend for IBC clearance")).toBeNull();
  });

  it("builds preview rows for matched, unmatched, and ambiguous titles", () => {
    const csv = buildCsv(
      ["Title", "Recommended Type of Review"],
      [
        ["Matched Title", "Full - 1"],
        ["Missing Title", "Exempted"],
        ["Duplicate Title", "Expedited - 1"],
        ["Notes Only Title", "recommend for IBC clearance"],
      ]
    );
    const parsed = parseClassificationCsv(csv);
    const projectsByTitle = new Map([
      [
        normalizeClassificationTitle("Matched Title"),
        [
          {
            id: 1,
            title: "Matched Title",
            projectCode: "P-1",
            submissions: [
              {
                id: 10,
                status: SubmissionStatus.AWAITING_CLASSIFICATION,
                sequenceNumber: 1,
                classification: null,
              },
            ],
          },
        ],
      ],
      [
        normalizeClassificationTitle("Duplicate Title"),
        [
          { id: 2, title: "Duplicate Title", projectCode: "P-2", submissions: [] },
          { id: 3, title: "Duplicate Title", projectCode: "P-3", submissions: [] },
        ],
      ],
      [
        normalizeClassificationTitle("Notes Only Title"),
        [
          {
            id: 4,
            title: "Notes Only Title",
            projectCode: "P-4",
            submissions: [
              {
                id: 40,
                status: SubmissionStatus.CLASSIFIED,
                sequenceNumber: 1,
                classification: {
                  reviewType: ReviewType.EXEMPT,
                  rationale: "Existing rationale",
                },
              },
            ],
          },
        ],
      ],
    ]);

    const rows = buildClassificationPreviewRows(parsed.rows, projectsByTitle);
    const summary = summarizeClassificationPreview(rows);

    expect(rows.map((row) => row.matchStatus)).toEqual([
      "MATCHED",
      "UNMATCHED",
      "AMBIGUOUS",
      "NO_REVIEW_TYPE",
    ]);
    expect(summary).toEqual({
      matchedRows: 1,
      notesOnlyRows: 1,
      unmatchedRows: 1,
      ambiguousRows: 1,
      warningRows: 3,
    });
  });

  it("appends imported rationale without replacing existing notes", () => {
    expect(mergeImportedRationale("Existing notes", "Imported notes")).toBe(
      "Existing notes\n\n---\nImported notes"
    );
    expect(mergeImportedRationale("", "Imported notes")).toBe("Imported notes");
  });
});
