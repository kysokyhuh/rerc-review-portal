import request from "supertest";

jest.mock("../../src/config/prismaClient", () => ({
  __esModule: true,
  default: {
    authSession: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
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
  signup: jest.fn(),
  login: jest.fn(),
  changePassword: jest.fn(),
  refreshSession: jest.fn(),
  getMeById: jest.fn(),
  logoutSession: jest.fn(),
}));

import app from "../../src/app";
import { AuthError } from "../../src/services/auth/authService";

const authService = jest.requireMock("../../src/services/auth/authService") as {
  signup: jest.Mock;
  login: jest.Mock;
  changePassword: jest.Mock;
  refreshSession: jest.Mock;
  getMeById: jest.Mock;
  logoutSession: jest.Mock;
};

describe("auth routes", () => {
  const originHeaders = {
    Origin: "http://localhost:5173",
  };
  const csrfHeaders = {
    ...originHeaders,
    Cookie: "csrfToken=test-csrf",
    "X-CSRF-Token": "test-csrf",
  };

  beforeAll(() => {
    app.set("trust proxy", "loopback");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST /auth/signup creates a pending inactive account", async () => {
    authService.signup.mockResolvedValue({
      message: "Your account has been submitted for approval.",
    });

    const response = await request(app)
      .post("/auth/signup")
      .set(csrfHeaders)
      .send({
        firstName: "New",
        lastName: "User",
        email: "new@user.test",
        password: "StrongPassword12",
        confirmPassword: "StrongPassword12",
      });

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
    expect(response.body.message).toMatch(/submitted for approval/i);
    expect(authService.signup).toHaveBeenCalledWith(
      {
        firstName: "New",
        lastName: "User",
        email: "new@user.test",
        password: "StrongPassword12",
        confirmPassword: "StrongPassword12",
      },
      expect.objectContaining({ ipAddress: expect.any(String) })
    );
  });

  it("POST /auth/login returns INVALID_CREDENTIALS for blocked or invalid users", async () => {
    authService.login.mockRejectedValue(
      new AuthError(401, "INVALID_CREDENTIALS", "Invalid email or password.")
    );

    const response = await request(app)
      .post("/auth/login")
      .set(csrfHeaders)
      .send({
        email: "pending@user.test",
        password: "StrongPassword12",
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password.",
    });
  });

  it("POST /auth/login sets cookies and returns mustChangePassword", async () => {
    authService.login.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: 9,
        email: "chair@urerb.com",
        fullName: "URERB Chair",
        roles: ["CHAIR"],
        committeeRoles: {},
        status: "APPROVED",
        forcePasswordChange: true,
      },
      accessCookieMaxAgeMs: 900000,
      refreshCookieMaxAgeMs: 86400000,
    });

    const response = await request(app)
      .post("/auth/login")
      .set(csrfHeaders)
      .send({
        email: "chair@urerb.com",
        password: "StrongPassword12",
      });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("chair@urerb.com");
    expect(response.body.mustChangePassword).toBe(true);
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("authToken=access-token"),
        expect.stringContaining("refreshToken=refresh-token"),
        expect.stringContaining("csrfToken="),
      ])
    );
  });

  it("POST /auth/change-password rotates auth cookies", async () => {
    authService.changePassword.mockResolvedValue({
      accessToken: "renewed-access-token",
      refreshToken: "renewed-refresh-token",
      user: {
        id: 9,
        email: "chair@urerb.com",
        fullName: "URERB Chair",
        roles: ["CHAIR"],
        committeeRoles: {},
        status: "APPROVED",
        forcePasswordChange: false,
      },
      accessCookieMaxAgeMs: 900000,
      refreshCookieMaxAgeMs: 86400000,
    });

    const response = await request(app)
      .post("/auth/change-password")
      .set(csrfHeaders)
      .set("X-User-ID", "9")
      .set("X-User-Roles", "CHAIR")
      .send({
        newPassword: "UpdatedPassword12",
        confirmPassword: "UpdatedPassword12",
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.mustChangePassword).toBe(false);
    expect(authService.changePassword).toHaveBeenCalledWith(
      9,
      "dev-header-session",
      {
        newPassword: "UpdatedPassword12",
        confirmPassword: "UpdatedPassword12",
      },
      expect.objectContaining({ ipAddress: expect.any(String) })
    );
  });

  it("POST /auth/refresh renews auth cookies", async () => {
    authService.refreshSession.mockResolvedValue({
      accessToken: "renewed-access-token",
      refreshToken: "renewed-refresh-token",
      accessCookieMaxAgeMs: 900000,
      refreshCookieMaxAgeMs: 86400000,
    });

    const response = await request(app)
      .post("/auth/refresh")
      .set("Cookie", "refreshToken=refresh-cookie; csrfToken=test-csrf")
      .set("X-CSRF-Token", "test-csrf")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("authToken=renewed-access-token"),
        expect.stringContaining("refreshToken=renewed-refresh-token"),
        expect.stringContaining("csrfToken="),
      ])
    );
  });

  it("GET /auth/me resolves from authenticated cookie session", async () => {
    authService.getMeById.mockResolvedValue({
      id: 9,
      email: "chair@urerb.com",
      fullName: "URERB Chair",
      roles: ["CHAIR"],
      status: "APPROVED",
      forcePasswordChange: true,
    });

    const response = await request(app)
      .get("/auth/me")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "CHAIR");

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("chair@urerb.com");
    expect(response.body.user.forcePasswordChange).toBe(true);
  });
});
