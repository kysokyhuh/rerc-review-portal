import request from "supertest";

const queryRaw = jest.fn();

jest.mock("../../src/config/prismaClient", () => ({
  __esModule: true,
  default: {
    $queryRaw: queryRaw,
  },
}));

import app from "../../src/app";

describe("health routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /live returns liveness without touching the database", async () => {
    const response = await request(app).get("/live");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      service: expect.any(String),
      timestamp: expect.any(String),
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("GET /ready checks database readiness", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await request(app).get("/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      db: "connected",
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});
