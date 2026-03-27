import request from "supertest";

jest.mock("../../src/config/prismaClient", () => ({
  __esModule: true,
  default: {
    user: {
      findMany: jest.fn(),
    },
    authSession: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/auth/authService", () => ({
  __esModule: true,
  AuthError: class extends Error {
    statusCode: number;
    code: string;

    constructor(statusCode: number, code: string, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      this.name = "AuthError";
    }
  },
  approveAccessRequest: jest.fn(),
  rejectAccessRequest: jest.fn(),
  disableManagedUser: jest.fn(),
  enableManagedUser: jest.fn(),
  resetManagedUserPassword: jest.fn(),
  updateManagedUser: jest.fn(),
}));

import app from "../../src/app";
import prismaClient from "../../src/config/prismaClient";
import { AuthError } from "../../src/services/auth/authService";

const prisma = prismaClient as unknown as {
  user: {
    findMany: jest.Mock;
  };
};

const authService = jest.requireMock("../../src/services/auth/authService") as {
  approveAccessRequest: jest.Mock;
  rejectAccessRequest: jest.Mock;
  disableManagedUser: jest.Mock;
  enableManagedUser: jest.Mock;
  resetManagedUserPassword: jest.Mock;
  updateManagedUser: jest.Mock;
};

describe("admin user routes", () => {
  const csrfHeaders = {
    Origin: "http://localhost:5173",
    Cookie: "csrfToken=test-csrf",
    "X-CSRF-Token": "test-csrf",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /admin/users allows chair", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 101,
        fullName: "Pending User",
        email: "pending@urerb.com",
        status: "PENDING",
        isActive: false,
        forcePasswordChange: false,
        statusNote: null,
        roles: [],
        approvedAt: null,
        rejectedAt: null,
        createdAt: new Date(),
      },
    ]);

    const response = await request(app)
      .get("/admin/users")
      .set("X-User-ID", "1")
      .set("X-User-Roles", "CHAIR");

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(1);
  });

  it("GET /admin/users also allows admin support access", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 202,
        fullName: "Approved User",
        email: "approved@urerb.com",
        status: "APPROVED",
        isActive: true,
        forcePasswordChange: false,
        statusNote: null,
        roles: ["RESEARCH_ASSISTANT"],
        approvedAt: new Date(),
        rejectedAt: null,
        createdAt: new Date(),
      },
    ]);

    const response = await request(app)
      .get("/admin/users")
      .set("X-User-ID", "2")
      .set("X-User-Roles", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "APPROVED" },
      })
    );
  });

  it("POST /admin/users/:id/approve forbids non-chair", async () => {
    const response = await request(app)
      .post("/admin/users/101/approve")
      .set("X-User-ID", "2")
      .set("X-User-Roles", "ADMIN")
      .set(csrfHeaders)
      .send({ role: "RESEARCH_ASSISTANT" });

    expect(response.status).toBe(403);
  });

  it("POST /admin/users/:id/approve uses the single role payload", async () => {
    authService.approveAccessRequest.mockResolvedValue({
      id: 101,
      fullName: "Pending User",
      email: "pending@urerb.com",
      status: "APPROVED",
      isActive: true,
      forcePasswordChange: false,
      roles: ["RESEARCH_ASSISTANT"],
      statusNote: null,
      approvedAt: new Date().toISOString(),
      rejectedAt: null,
      createdAt: new Date().toISOString(),
    });

    const response = await request(app)
      .post("/admin/users/101/approve")
      .set("X-User-ID", "1")
      .set("X-User-Roles", "CHAIR")
      .set(csrfHeaders)
      .send({ role: "RESEARCH_ASSISTANT" });

    expect(response.status).toBe(200);
    expect(authService.approveAccessRequest).toHaveBeenCalledWith(
      101,
      "RESEARCH_ASSISTANT",
      1
    );
  });

  it("POST /admin/users/:id/reset-password allows admin", async () => {
    authService.resetManagedUserPassword.mockResolvedValue({
      id: 202,
      fullName: "Approved User",
      email: "approved@urerb.com",
      status: "APPROVED",
      isActive: true,
      forcePasswordChange: true,
      roles: ["RESEARCH_ASSISTANT"],
      statusNote: null,
      approvedAt: new Date().toISOString(),
      rejectedAt: null,
      createdAt: new Date().toISOString(),
    });

    const response = await request(app)
      .post("/admin/users/202/reset-password")
      .set("X-User-ID", "2")
      .set("X-User-Roles", "ADMIN")
      .set(csrfHeaders)
      .send({ temporaryPassword: "TemporaryPass12" });

    expect(response.status).toBe(200);
    expect(authService.resetManagedUserPassword).toHaveBeenCalledWith(
      202,
      "TemporaryPass12",
      2
    );
  });

  it("POST /admin/users/:id/enable returns structured auth errors", async () => {
    authService.enableManagedUser.mockRejectedValue(
      new AuthError(400, "VALIDATION_ERROR", "Only disabled accounts can be enabled.")
    );

    const response = await request(app)
      .post("/admin/users/101/enable")
      .set("X-User-ID", "1")
      .set("X-User-Roles", "CHAIR")
      .set(csrfHeaders)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "VALIDATION_ERROR",
      message: "Only disabled accounts can be enabled.",
    });
  });
});
