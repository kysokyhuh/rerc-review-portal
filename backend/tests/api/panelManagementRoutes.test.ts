import request from "supertest";

jest.mock("../../src/config/prismaClient", () => ({
  __esModule: true,
  default: {
    authSession: {
      findUnique: jest.fn(),
    },
    committee: {
      findUnique: jest.fn(),
    },
    panel: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    panelMember: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import app from "../../src/app";
import prismaClient from "../../src/config/prismaClient";

const prisma = prismaClient as unknown as {
  committee: {
    findUnique: jest.Mock;
  };
  panel: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
    delete: jest.Mock;
  };
  panelMember: {
    deleteMany: jest.Mock;
  };
  user: {
    findMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe("panel management routes", () => {
  const chairHeaders = {
    "X-User-ID": "1",
    "X-User-Roles": "CHAIR",
  };
  const csrfHeaders = {
    Origin: "http://localhost:5173",
    Cookie: "csrfToken=test-csrf",
    "X-CSRF-Token": "test-csrf",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /admin/panel-user-options returns active approved users", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 11,
        fullName: "Ana Reviewer",
        email: "ana@university.edu",
        roles: ["RESEARCH_ASSOCIATE"],
      },
    ]);

    const response = await request(app)
      .get("/admin/panel-user-options")
      .set(chairHeaders);

    expect(response.status).toBe(200);
    expect(response.body.users).toEqual([
      {
        id: 11,
        fullName: "Ana Reviewer",
        email: "ana@university.edu",
        roles: ["RESEARCH_ASSOCIATE"],
      },
    ]);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "APPROVED",
          isActive: true,
        },
      })
    );
  });

  it("POST /admin/panels creates the next numbered panel", async () => {
    prisma.committee.findUnique.mockResolvedValue({
      id: 7,
      code: "RERC-HUMAN",
      name: "Research Ethics Review Committee - Human Participants",
      isActive: true,
    });
    prisma.panel.findMany.mockResolvedValue([
      { name: "Panel 1", code: "P1" },
      { name: "Panel 2", code: "P2" },
      { name: "Panel 3", code: "P3" },
      { name: "Panel 4", code: "P4" },
    ]);
    prisma.panel.findFirst.mockResolvedValue(null);
    prisma.panel.create.mockResolvedValue({
      id: 55,
      name: "Panel 5",
      code: "P5",
      isActive: true,
      committeeId: 7,
      committee: {
        id: 7,
        code: "RERC-HUMAN",
        name: "Research Ethics Review Committee - Human Participants",
      },
      members: [],
    });

    const response = await request(app)
      .post("/admin/panels")
      .set(chairHeaders)
      .set(csrfHeaders)
      .send({ committeeId: 7 });

    expect(response.status).toBe(201);
    expect(response.body.panel).toMatchObject({
      id: 55,
      name: "Panel 5",
      code: "P5",
    });
    expect(prisma.panel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          committeeId: 7,
          name: "Panel 5",
          code: "P5",
        },
      })
    );
  });

  it("DELETE /admin/panels/:panelId removes an unassigned panel and its members", async () => {
    prisma.panel.findUnique.mockResolvedValue({
      id: 55,
      name: "Panel 5",
      committeeId: 7,
      _count: {
        classifications: 0,
        members: 2,
      },
    });
    prisma.panel.count.mockResolvedValue(5);
    prisma.panelMember.deleteMany.mockReturnValue({ kind: "delete-members" });
    prisma.panel.delete.mockReturnValue({ kind: "delete-panel" });
    prisma.$transaction.mockResolvedValue([
      { count: 2 },
      { id: 55, name: "Panel 5" },
    ]);

    const response = await request(app)
      .delete("/admin/panels/55")
      .set(chairHeaders)
      .set(csrfHeaders);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "Panel 5 deleted.",
      deletedMemberCount: 2,
    });
    expect(prisma.panelMember.deleteMany).toHaveBeenCalledWith({
      where: { panelId: 55 },
    });
    expect(prisma.panel.delete).toHaveBeenCalledWith({
      where: { id: 55 },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      { kind: "delete-members" },
      { kind: "delete-panel" },
    ]);
  });

  it("DELETE /admin/panels/:panelId blocks panels used by classifications", async () => {
    prisma.panel.findUnique.mockResolvedValue({
      id: 1,
      name: "Panel 1",
      committeeId: 7,
      _count: {
        classifications: 3,
        members: 4,
      },
    });

    const response = await request(app)
      .delete("/admin/panels/1")
      .set(chairHeaders)
      .set(csrfHeaders);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "This panel is assigned to existing protocol classifications and cannot be deleted."
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
