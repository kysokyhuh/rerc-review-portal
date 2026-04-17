import request from "supertest";
import app from "../../src/app";

jest.mock("../../src/services/projects/projectService", () => {
  const actual = jest.requireActual("../../src/services/projects/projectService");
  return {
    __esModule: true,
    ...actual,
    getProjectFull: jest.fn(),
    archiveProject: jest.fn(),
    restoreProjectArchive: jest.fn(),
    deleteProjectRecord: jest.fn(),
    getRecentlyDeletedProjects: jest.fn(),
    restoreDeletedProjectRecord: jest.fn(),
    purgeExpiredDeletedProjects: jest.fn(),
  };
});

const projectService = jest.requireMock("../../src/services/projects/projectService") as {
  getProjectFull: jest.Mock;
  archiveProject: jest.Mock;
  restoreProjectArchive: jest.Mock;
  deleteProjectRecord: jest.Mock;
  getRecentlyDeletedProjects: jest.Mock;
  restoreDeletedProjectRecord: jest.Mock;
  purgeExpiredDeletedProjects: jest.Mock;
};

describe("project archive routes", () => {
  const csrfHeaders = {
    Origin: "http://localhost:5173",
    Cookie: "csrfToken=test-csrf",
    "X-CSRF-Token": "test-csrf",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows admin to open project detail", async () => {
    projectService.getProjectFull.mockResolvedValue({
      id: 10,
      projectCode: "RERC-001",
      title: "Archived protocol",
      piName: "Test PI",
      overallStatus: "ACTIVE",
      committee: { id: 1, code: "RERC-HUMAN", name: "Human" },
      submissions: [],
      statusHistory: [],
      changeLog: [],
    });

    const response = await request(app)
      .get("/projects/10/full")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "ADMIN");

    expect(response.status).toBe(200);
    expect(projectService.getProjectFull).toHaveBeenCalledWith(10);
  });

  it("denies non-chair-admin archive attempts", async () => {
    const response = await request(app)
      .post("/projects/10/archive")
      .set(csrfHeaders)
      .set("X-User-ID", "12")
      .set("X-User-Roles", "RESEARCH_ASSOCIATE")
      .send({ mode: "CLOSED", reason: "done" });

    expect(response.status).toBe(403);
    expect(projectService.archiveProject).not.toHaveBeenCalled();
  });

  it("archives a project for chair users", async () => {
    projectService.archiveProject.mockResolvedValue({
      project: { id: 10, overallStatus: "CLOSED" },
      history: {
        id: 1,
        oldStatus: "ACTIVE",
        newStatus: "CLOSED",
        effectiveDate: new Date().toISOString(),
        reason: "All work complete",
      },
    });

    const response = await request(app)
      .post("/projects/10/archive")
      .set(csrfHeaders)
      .set("X-User-ID", "7")
      .set("X-User-Roles", "CHAIR")
      .send({ mode: "CLOSED", reason: "All work complete" });

    expect(response.status).toBe(200);
    expect(projectService.archiveProject).toHaveBeenCalledWith(
      10,
      "CLOSED",
      "All work complete",
      7
    );
  });

  it("requires a reason for archive requests", async () => {
    const response = await request(app)
      .post("/projects/10/archive")
      .set(csrfHeaders)
      .set("X-User-ID", "7")
      .set("X-User-Roles", "CHAIR")
      .send({ mode: "CLOSED", reason: "" });

    expect(response.status).toBe(400);
    expect(projectService.archiveProject).not.toHaveBeenCalled();
  });

  it("restores a project for admin users", async () => {
    projectService.restoreProjectArchive.mockResolvedValue({
      project: { id: 10, overallStatus: "ACTIVE" },
      history: {
        id: 2,
        oldStatus: "CLOSED",
        newStatus: "ACTIVE",
        effectiveDate: new Date().toISOString(),
        reason: "Continuing review required",
      },
    });

    const response = await request(app)
      .post("/projects/10/restore")
      .set(csrfHeaders)
      .set("X-User-ID", "9")
      .set("X-User-Roles", "ADMIN")
      .send({ reason: "Continuing review required" });

    expect(response.status).toBe(200);
    expect(projectService.restoreProjectArchive).toHaveBeenCalledWith(
      10,
      "Continuing review required",
      9
    );
  });

  it("denies non-chair-admin delete attempts", async () => {
    const response = await request(app)
      .post("/projects/10/delete")
      .set(csrfHeaders)
      .set("X-User-ID", "12")
      .set("X-User-Roles", "RESEARCH_ASSOCIATE")
      .send({ reason: "Duplicate protocol" });

    expect(response.status).toBe(403);
    expect(projectService.deleteProjectRecord).not.toHaveBeenCalled();
  });

  it("deletes a project for admin users", async () => {
    projectService.deleteProjectRecord.mockResolvedValue({
      project: {
        id: 10,
        overallStatus: "ACTIVE",
        deletedAt: new Date().toISOString(),
      },
    });

    const response = await request(app)
      .post("/projects/10/delete")
      .set(csrfHeaders)
      .set("X-User-ID", "9")
      .set("X-User-Roles", "ADMIN")
      .send({ reason: "Duplicate protocol" });

    expect(response.status).toBe(200);
    expect(projectService.deleteProjectRecord).toHaveBeenCalledWith(10, "Duplicate protocol", 9);
  });

  it("lists recently deleted protocols for chair users", async () => {
    projectService.getRecentlyDeletedProjects.mockResolvedValue({
      items: [],
      total: 0,
      limit: 100,
      offset: 0,
    });

    const response = await request(app)
      .get("/projects/recently-deleted")
      .set("X-User-ID", "7")
      .set("X-User-Roles", "CHAIR");

    expect(response.status).toBe(200);
    expect(projectService.getRecentlyDeletedProjects).toHaveBeenCalled();
  });

  it("restores a deleted project with target status", async () => {
    projectService.restoreDeletedProjectRecord.mockResolvedValue({
      project: { id: 10, overallStatus: "DRAFT" },
      history: {
        id: 3,
        oldStatus: "ACTIVE",
        newStatus: "DRAFT",
        effectiveDate: new Date().toISOString(),
        reason: "Restored for rework",
      },
    });

    const response = await request(app)
      .post("/projects/10/restore-deleted")
      .set(csrfHeaders)
      .set("X-User-ID", "7")
      .set("X-User-Roles", "CHAIR")
      .send({ reason: "Restored for rework", targetStatus: "DRAFT" });

    expect(response.status).toBe(200);
    expect(projectService.restoreDeletedProjectRecord).toHaveBeenCalledWith(
      10,
      "Restored for rework",
      "DRAFT",
      7
    );
  });
});
