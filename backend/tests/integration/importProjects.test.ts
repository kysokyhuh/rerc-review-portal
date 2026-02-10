import request from "supertest";
import app from "../../src/app";
import prismaClient from "../../src/config/prismaClient";

const txProjectCreate = jest.fn();
const txSubmissionCreate = jest.fn();

jest.mock("../../src/config/prismaClient", () => {
  return {
    __esModule: true,
    default: {
      committee: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      project: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      submission: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) =>
        callback({
          project: { create: txProjectCreate },
          submission: { create: txSubmissionCreate },
        })
      ),
    },
  };
});

const prisma = prismaClient as unknown as {
  committee: { findMany: jest.Mock; findFirst: jest.Mock };
  project: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
  submission: { create: jest.Mock };
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

describe("POST /imports/projects/commit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.committee.findMany.mockResolvedValue([{ id: 1, code: "RERC-HUMAN" }]);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.project.findFirst.mockResolvedValue(null);
    txProjectCreate.mockResolvedValue({ id: 1 });
    txSubmissionCreate.mockResolvedValue({ id: 10 });
  });

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
});
