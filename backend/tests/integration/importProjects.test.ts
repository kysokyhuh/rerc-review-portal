import request from "supertest";
import app from "../../src/app";
import prismaClient from "../../src/config/prismaClient";
import { LEGACY_WIDE_COLUMNS } from "../../src/services/imports/projectCsvImport";

const txProjectCreate = jest.fn();
const txSubmissionCreate = jest.fn();
const txProtocolProfileCreate = jest.fn();
const txSubmissionStatusHistoryCreate = jest.fn();
const txLegacyImportSnapshotCreate = jest.fn();

jest.mock("../../src/config/prismaClient", () => {
  return {
    __esModule: true,
    default: {
      committee: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      configSLA: {
        findMany: jest.fn(),
      },
      holiday: {
        findMany: jest.fn(),
      },
      project: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      submission: {
        create: jest.fn(),
      },
      protocolProfile: {
        create: jest.fn(),
      },
      importBatch: {
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) =>
        callback({
          project: { create: txProjectCreate },
          submission: { create: txSubmissionCreate },
          protocolProfile: { create: txProtocolProfileCreate },
          submissionStatusHistory: { create: txSubmissionStatusHistoryCreate },
          legacyImportSnapshot: { create: txLegacyImportSnapshotCreate },
        })
      ),
    },
  };
});

const prisma = prismaClient as unknown as {
  committee: { findMany: jest.Mock; findFirst: jest.Mock };
  configSLA: { findMany: jest.Mock };
  holiday: { findMany: jest.Mock };
  project: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
  submission: { create: jest.Mock };
  protocolProfile: { create: jest.Mock };
  importBatch: { create: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
};

const headers = [
  "projectCode",
  "title",
  "piName",
  "piAffiliation",
  "department",
  "proponent",
  "fundingType",
  "researchTypePHREB",
  "researchTypePHREBOther",
  "committeeCode",
  "submissionType",
  "receivedDate",
  "remarks",
];

const buildCsv = (rows: string[][]) =>
  [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

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

const buildLegacyCsv = (rows: string[][], includeHeader: boolean) =>
  [
    ...(includeHeader ? [buildLegacyHeaderRow()] : []),
    ...rows,
  ]
    .map((row) => row.join(","))
    .join("\n");

const csrfHeaders = {
  Origin: "http://localhost:5173",
  Cookie: "csrfToken=test-csrf",
  "X-CSRF-Token": "test-csrf",
};

describe("project import routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IMPORT_DEFAULT_COMMITTEE_CODE = "RERC-HUMAN";
    prisma.committee.findMany.mockResolvedValue([{ id: 1, code: "RERC-HUMAN" }]);
    prisma.committee.findFirst.mockResolvedValue({ id: 1, code: "RERC-HUMAN" });
    prisma.configSLA.findMany.mockResolvedValue([]);
    prisma.holiday.findMany.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.project.findFirst.mockResolvedValue(null);
    txProjectCreate.mockResolvedValue({ id: 1 });
    txSubmissionCreate.mockResolvedValue({ id: 10 });
    txProtocolProfileCreate.mockResolvedValue({ id: 20 });
    txSubmissionStatusHistoryCreate.mockResolvedValue({ id: 30 });
    txLegacyImportSnapshotCreate.mockResolvedValue({ id: 40 });
    prisma.importBatch.create.mockResolvedValue({
      id: 99,
      mode: "INTAKE_IMPORT",
      sourceFilename: "projects.csv",
      createdAt: "2026-04-10T00:00:00.000Z",
    });
    prisma.importBatch.update.mockResolvedValue({
      id: 99,
      insertedRows: 1,
      failedRows: 0,
      warningRows: 0,
    });
  });

  describe("POST /imports/projects/preview", () => {
    it("detects legacy headered CSVs", async () => {
      const csv = buildLegacyCsv(
        [
          buildLegacyRow({
            0: "2026-201A",
            1: "Legacy Headered Preview",
            2: "Dr. Header",
            5: "2026-01-10",
            9: "INTERNAL",
          }),
        ],
        true
      );

      const response = await request(app)
        .post("/imports/projects/preview")
        .set(csrfHeaders)
        .set("X-User-ID", "1")
        .set("X-User-Email", "ra@example.com")
        .set("X-User-Name", "RA")
        .set("X-User-Roles", "RESEARCH_ASSOCIATE")
        .attach("file", Buffer.from(csv), "legacy-headered.csv");

      expect(response.status).toBe(200);
      expect(response.body.detectedFormat).toBe("legacy_headered");
      expect(response.body.missingRequiredFields).toEqual([]);
      expect(response.body.detectedHeaders[0]).toBe("projectCode");
    });

    it("detects legacy headerless CSVs and returns a warning", async () => {
      const csv = buildLegacyCsv(
        [
          buildLegacyRow({
            0: "2026-202B",
            1: "Legacy Headerless Preview",
            2: "Dr. No Header",
            5: "2026-02-15",
            9: "EXTERNAL",
          }),
        ],
        false
      );

      const response = await request(app)
        .post("/imports/projects/preview")
        .set(csrfHeaders)
        .set("X-User-ID", "1")
        .set("X-User-Email", "ra@example.com")
        .set("X-User-Name", "RA")
        .set("X-User-Roles", "RESEARCH_ASSOCIATE")
        .attach("file", Buffer.from(csv), "legacy-headerless.csv");

      expect(response.status).toBe(200);
      expect(response.body.detectedFormat).toBe("legacy_headerless");
      expect(response.body.missingRequiredFields).toEqual([]);
      expect(response.body.warnings).toContain(
        "No header row detected; using legacy column order."
      );
    });
  });

  describe("POST /imports/projects/commit", () => {
    it("imports valid rows and reports invalid rows", async () => {
      const csv = buildCsv([
        [
          "2026-001",
          "Valid Title",
          "Dr. A",
          "Science",
          "Biology",
          "",
          "INTERNAL",
          "",
          "",
          "RERC-HUMAN",
          "INITIAL",
          "2026-01-10",
          "",
        ],
        [
          "2026-002",
          "Invalid Funding",
          "Dr. B",
          "Science",
          "Biology",
          "",
          "NOT_A_TYPE",
          "",
          "",
          "RERC-HUMAN",
          "INITIAL",
          "2026-01-10",
          "",
        ],
      ]);

      const mapping = {
        projectCode: "projectCode",
        title: "title",
        piName: "piName",
        fundingType: "fundingType",
        committeeCode: "committeeCode",
        submissionType: "submissionType",
        receivedDate: "receivedDate",
      };

      const response = await request(app)
        .post("/imports/projects/commit")
        .set(csrfHeaders)
        .set("X-User-ID", "1")
        .set("X-User-Email", "ra@example.com")
        .set("X-User-Name", "RA")
        .set("X-User-Roles", "RESEARCH_ASSOCIATE")
        .field("mapping", JSON.stringify(mapping))
        .attach("file", Buffer.from(csv), "projects.csv");

      expect(response.status).toBe(200);
      expect(response.body.receivedRows).toBe(2);
      expect(response.body.insertedRows).toBe(1);
      expect(response.body.failedRows).toBe(1);
      expect(response.body.errors.length).toBeGreaterThan(0);
      expect(txProjectCreate).toHaveBeenCalledTimes(1);
      expect(txSubmissionCreate).toHaveBeenCalledTimes(1);
    });

    it("imports rows when only anchor mappings are provided", async () => {
      const csv = buildCsv([
        [
          "2026-003",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "RERC-HUMAN",
          "",
          "",
          "",
        ],
      ]);

      const mapping = {
        projectCode: "projectCode",
        committeeCode: "committeeCode",
      };

      const response = await request(app)
        .post("/imports/projects/commit")
        .set(csrfHeaders)
        .set("X-User-ID", "1")
        .set("X-User-Email", "ra@example.com")
        .set("X-User-Name", "RA")
        .set("X-User-Roles", "RESEARCH_ASSOCIATE")
        .field("mapping", JSON.stringify(mapping))
        .attach("file", Buffer.from(csv), "projects.csv");

      expect(response.status).toBe(200);
      expect(response.body.insertedRows).toBe(1);
      expect(response.body.failedRows).toBe(0);
      expect(txProjectCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: null,
            piName: null,
            fundingType: null,
          }),
        })
      );
      expect(txSubmissionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            submissionType: null,
            receivedDate: expect.any(Date),
          }),
        })
      );
    });

    it("commits legacy headered and headerless CSVs with the same normalized payload", async () => {
      const legacyRow = buildLegacyRow({
        0: "2026-301A",
        1: "Legacy Commit Title",
        2: "Dr. Commit",
        3: "Science",
        4: "Biology",
        5: "2026-03-01",
        6: "March",
        7: "FULL_BOARD",
        8: "Faculty",
        9: "INTERNAL",
        10: "BIOMEDICAL",
        11: "",
        12: "Closed",
        13: "2026-03-20",
        14: "March",
        15: "19",
        16: "Legacy remarks",
        17: "Panel 1",
        18: "Prof. Science",
        19: "Ms. Lay",
        20: "Consultant X",
        22: "Classified",
        60: "25",
        61: "2",
        62: "No",
        63: "2026-12-31",
        64: "2027-12-31",
        65: "2026-06-01",
        66: "2026-06-15",
        67: "2026-06-20",
        68: "Accepted",
        69: "5",
        70: "2026-11-01",
        71: "2026-11-10",
        72: "2026-11-20",
        73: "Complete",
        74: "10",
        75: "2026-07-01",
        76: "Approved",
        77: "2026-07-05",
        78: "4",
        79: "2026-08-01",
        80: "Approved",
        81: "2026-08-05",
        82: "4",
        83: "Prof. Primary",
        84: "Ms. Final Lay",
      });

      const performCommit = async (includeHeader: boolean) =>
        request(app)
          .post("/imports/projects/commit")
          .set(csrfHeaders)
          .set("X-User-ID", "1")
          .set("X-User-Email", "ra@example.com")
          .set("X-User-Name", "RA")
          .set("X-User-Roles", "RESEARCH_ASSOCIATE")
          .field("mode", "LEGACY_MIGRATION")
          .attach(
            "file",
            Buffer.from(buildLegacyCsv([legacyRow], includeHeader)),
            includeHeader ? "legacy-headered.csv" : "legacy-headerless.csv"
          );

      const headeredResponse = await performCommit(true);
      expect(headeredResponse.status).toBe(200);
      expect(headeredResponse.body.insertedRows).toBe(1);
      expect(headeredResponse.body.failedRows).toBe(0);

      const headeredProjectArgs = txProjectCreate.mock.calls[0][0];
      const headeredSubmissionArgs = txSubmissionCreate.mock.calls[0][0];
      const headeredProfileArgs = txProtocolProfileCreate.mock.calls[0][0];
      const headeredSnapshotArgs = txLegacyImportSnapshotCreate.mock.calls[0][0];

      txProjectCreate.mockClear();
      txSubmissionCreate.mockClear();
      txProtocolProfileCreate.mockClear();
      txLegacyImportSnapshotCreate.mockClear();

      const headerlessResponse = await performCommit(false);
      expect(headerlessResponse.status).toBe(200);
      expect(headerlessResponse.body.insertedRows).toBe(1);
      expect(headerlessResponse.body.failedRows).toBe(0);

      const headerlessProjectArgs = txProjectCreate.mock.calls[0][0];
      const headerlessSubmissionArgs = txSubmissionCreate.mock.calls[0][0];
      const headerlessProfileArgs = txProtocolProfileCreate.mock.calls[0][0];
      const headerlessSnapshotArgs = txLegacyImportSnapshotCreate.mock.calls[0][0];

      expect(headerlessProjectArgs).toEqual(
        expect.objectContaining({
          ...headeredProjectArgs,
          data: expect.objectContaining({
            ...headeredProjectArgs.data,
            importSourceRowNumber: 1,
          }),
        })
      );
      expect(headerlessSubmissionArgs).toEqual(headeredSubmissionArgs);
      expect(headerlessProfileArgs).toEqual(headeredProfileArgs);
      expect(headerlessSnapshotArgs).toEqual(
        expect.objectContaining({
          ...headeredSnapshotArgs,
          data: expect.objectContaining({
            ...headeredSnapshotArgs.data,
            sourceRowNumber: 1,
          }),
        })
      );
      expect(headerlessSnapshotArgs.data).toEqual(
        expect.objectContaining({
          importedProgressReportStatus: "Accepted",
          importedFinalReportStatus: "Complete",
          importedAmendmentStatus: "Approved",
          importedContinuingStatus: "Approved",
          importedFinalLayReviewer: "Ms. Final Lay",
        })
      );
    });

    it("INTAKE_IMPORT creates project with origin=NATIVE_PORTAL and submission with AWAITING_CLASSIFICATION", async () => {
      const csv = buildCsv([
        ["2026-401", "Intake Title", "Dr. Intake", "Science", "Biology", "", "INTERNAL", "", "", "RERC-HUMAN", "INITIAL", "2026-01-10", ""],
      ]);
      const mapping = {
        projectCode: "projectCode",
        title: "title",
        piName: "piName",
        fundingType: "fundingType",
        committeeCode: "committeeCode",
        submissionType: "submissionType",
        receivedDate: "receivedDate",
      };

      const response = await request(app)
        .post("/imports/projects/commit")
        .set(csrfHeaders)
        .set("X-User-ID", "1")
        .set("X-User-Email", "ra@example.com")
        .set("X-User-Name", "RA")
        .set("X-User-Roles", "RESEARCH_ASSOCIATE")
        .field("mode", "INTAKE_IMPORT")
        .field("mapping", JSON.stringify(mapping))
        .attach("file", Buffer.from(csv), "intake.csv");

      expect(response.status).toBe(200);
      expect(response.body.insertedRows).toBe(1);
      expect(txProjectCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ origin: "NATIVE_PORTAL" }) })
      );
      expect(txSubmissionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "AWAITING_CLASSIFICATION" }) })
      );
      expect(txLegacyImportSnapshotCreate).not.toHaveBeenCalled();
    });

    it("legacy-shaped files still preserve LEGACY_IMPORT origin but enter the live workflow immediately", async () => {
      const legacyRow = buildLegacyRow({
        0: "2026-402",
        1: "Legacy Title",
        2: "Dr. Legacy",
        5: "2026-03-01",
        9: "INTERNAL",
        17: "Panel 1",
      });

      const response = await request(app)
        .post("/imports/projects/commit")
        .set(csrfHeaders)
        .set("X-User-ID", "1")
        .set("X-User-Email", "ra@example.com")
        .set("X-User-Name", "RA")
        .set("X-User-Roles", "RESEARCH_ASSOCIATE")
        .field("mode", "LEGACY_MIGRATION")
        .attach("file", Buffer.from(buildLegacyCsv([legacyRow], true)), "legacy.csv");

      expect(response.status).toBe(200);
      expect(response.body.insertedRows).toBe(1);
      expect(txProjectCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ origin: "LEGACY_IMPORT" }) })
      );
      expect(txSubmissionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "AWAITING_CLASSIFICATION",
            receivedDate: expect.any(Date),
          }),
        })
      );
      expect(txLegacyImportSnapshotCreate).toHaveBeenCalled();
    });

    it("auto-detects legacy headerless CSVs and imports them into the live workflow", async () => {
      const legacyRow = buildLegacyRow({ 0: "2026-403", 1: "Blocked Title", 5: "2026-03-01" });
      const csv = [legacyRow.join(",")].join("\n"); // no header row → legacy_headerless

      const response = await request(app)
        .post("/imports/projects/commit")
        .set(csrfHeaders)
        .set("X-User-ID", "1")
        .set("X-User-Email", "ra@example.com")
        .set("X-User-Name", "RA")
        .set("X-User-Roles", "RESEARCH_ASSOCIATE")
        .attach("file", Buffer.from(csv), "legacy-headerless.csv");

      expect(response.status).toBe(200);
      expect(response.body.insertedRows).toBe(1);
      expect(txSubmissionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "AWAITING_CLASSIFICATION",
          }),
        })
      );
      expect(txLegacyImportSnapshotCreate).toHaveBeenCalled();
    });

    it("returns warnings and batch metadata without exposing a user-selected import mode", async () => {
      // Row with totalDays=9999 (exceeds 3650 bound) → SUSPICIOUS_LEGACY_NUMBER warning
      const legacyRow = buildLegacyRow({
        0: "2026-404",
        1: "Warning Title",
        5: "2026-03-01",
        60: "9999", // totalDays column (index 60) — out of range triggers warning
      });

      const response = await request(app)
        .post("/imports/projects/commit")
        .set(csrfHeaders)
        .set("X-User-ID", "1")
        .set("X-User-Email", "ra@example.com")
        .set("X-User-Name", "RA")
        .set("X-User-Roles", "RESEARCH_ASSOCIATE")
        .attach("file", Buffer.from(buildLegacyCsv([legacyRow], true)), "legacy-warnings.csv");

      expect(response.status).toBe(200);
      expect(response.body.selectedMode).toBeUndefined();
      expect(response.body.recommendedMode).toBeUndefined();
      expect(response.body.modeFit).toBeUndefined();
      expect(response.body.warnings).toBeDefined();
      expect(Array.isArray(response.body.warnings)).toBe(true);
      expect(response.body.warningRows).toBeGreaterThanOrEqual(1);
      expect(response.body.importBatch).toBeDefined();
    });
  });
});
