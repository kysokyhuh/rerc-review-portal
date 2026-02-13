import request from "supertest";
import app from "../../src/app";
import prismaClient from "../../src/config/prismaClient";

jest.mock("../../src/config/prismaClient", () => ({
  __esModule: true,
  default: {
    holiday: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const prisma = prismaClient as unknown as {
  holiday: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

describe("holiday routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists holidays sorted by date", async () => {
    prisma.holiday.findMany.mockResolvedValue([
      {
        id: 1,
        date: new Date("2026-01-01T00:00:00.000Z"),
        name: "New Year",
        createdAt: new Date("2025-12-01T00:00:00.000Z"),
      },
      {
        id: 2,
        date: new Date("2026-04-09T00:00:00.000Z"),
        name: "Araw ng Kagitingan",
        createdAt: new Date("2025-12-02T00:00:00.000Z"),
      },
    ]);

    const response = await request(app)
      .get("/holidays?year=2026")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "RESEARCH_ASSOCIATE");

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(prisma.holiday.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { date: "asc" },
      })
    );
  });

  it("creates a holiday", async () => {
    prisma.holiday.findUnique.mockResolvedValueOnce(null);
    prisma.holiday.create.mockResolvedValueOnce({
      id: 8,
      date: new Date("2026-12-25T00:00:00.000Z"),
      name: "Christmas Day",
      createdAt: new Date("2026-01-10T00:00:00.000Z"),
    });

    const response = await request(app)
      .post("/holidays")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "CHAIR")
      .send({
        date: "2026-12-25",
        name: "Christmas Day",
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Christmas Day");
    expect(prisma.holiday.create).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate holiday date on create", async () => {
    prisma.holiday.findUnique.mockResolvedValueOnce({
      id: 3,
      date: new Date("2026-12-25T00:00:00.000Z"),
      name: "X",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const response = await request(app)
      .post("/holidays")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "ADMIN")
      .send({
        date: "2026-12-25",
        name: "Christmas Day",
      });

    expect(response.status).toBe(409);
    expect(prisma.holiday.create).not.toHaveBeenCalled();
  });

  it("updates a holiday date and name", async () => {
    prisma.holiday.findUnique
      .mockResolvedValueOnce({
        id: 11,
        date: new Date("2026-11-01T00:00:00.000Z"),
        name: "Old Name",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      })
      .mockResolvedValueOnce(null);
    prisma.holiday.update.mockResolvedValueOnce({
      id: 11,
      date: new Date("2026-11-02T00:00:00.000Z"),
      name: "All Souls Day (Observed)",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const response = await request(app)
      .patch("/holidays/11")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "RESEARCH_ASSOCIATE")
      .send({
        date: "2026-11-02",
        name: "All Souls Day (Observed)",
      });

    expect(response.status).toBe(200);
    expect(response.body.name).toContain("Observed");
    expect(prisma.holiday.update).toHaveBeenCalledTimes(1);
  });

  it("rejects update when target date already exists", async () => {
    prisma.holiday.findUnique
      .mockResolvedValueOnce({
        id: 11,
        date: new Date("2026-11-01T00:00:00.000Z"),
        name: "Old Name",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: 12,
        date: new Date("2026-11-02T00:00:00.000Z"),
        name: "Existing",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });

    const response = await request(app)
      .patch("/holidays/11")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "RESEARCH_ASSOCIATE")
      .send({ date: "2026-11-02" });

    expect(response.status).toBe(409);
    expect(prisma.holiday.update).not.toHaveBeenCalled();
  });

  it("deletes an existing holiday", async () => {
    prisma.holiday.findUnique.mockResolvedValueOnce({
      id: 90,
      date: new Date("2026-06-12T00:00:00.000Z"),
      name: "Founding Day",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    prisma.holiday.delete.mockResolvedValueOnce({ id: 90 });

    const response = await request(app)
      .delete("/holidays/90")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it("denies unauthorized role", async () => {
    const response = await request(app)
      .get("/holidays")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "MEMBER");

    expect(response.status).toBe(403);
  });
});
