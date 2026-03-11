import request from "supertest";
import app from "../../src/app";
import { AuthError } from "../../src/services/auth/authService";

jest.mock("../../src/services/auth/authService", () => ({
  __esModule: true,
  AuthError: class extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.name = "AuthError";
    }
  },
  signup: jest.fn(),
  login: jest.fn(),
  getMeById: jest.fn(),
}));

const authService = jest.requireMock("../../src/services/auth/authService") as {
  signup: jest.Mock;
  login: jest.Mock;
  getMeById: jest.Mock;
};

describe("auth routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST /auth/signup creates pending account", async () => {
    authService.signup.mockResolvedValue(undefined);

    const response = await request(app).post("/auth/signup").send({
      fullName: "New User",
      email: "new@user.test",
      password: "strongpass123",
    });

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
  });

  it("POST /auth/login blocks pending users", async () => {
    authService.login.mockRejectedValue(new AuthError(403, "Account is pending or inactive"));

    const response = await request(app).post("/auth/login").send({
      email: "pending@user.test",
      password: "strongpass123",
    });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/pending/i);
  });

  it("GET /auth/me resolves from authenticated cookie session", async () => {
    authService.getMeById.mockResolvedValue({
      id: 9,
      email: "chair@urerb.com",
      fullName: "URERB Chair",
      roles: ["CHAIR"],
      status: "ACTIVE",
    });

    const response = await request(app)
      .get("/auth/me")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "CHAIR");

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("chair@urerb.com");
    expect(authService.getMeById).toHaveBeenCalledWith(9);
  });
});
