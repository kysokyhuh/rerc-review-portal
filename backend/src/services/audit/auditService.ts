import prisma from "../../config/prismaClient";

type AuditInput = {
  actorId?: number | null;
  action: string;
  entityType: string;
  entityId: string | number;
  metadata?: Record<string, unknown> | null;
};

export async function logAuditEvent(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: String(input.entityId),
      metadataJson: (input.metadata ?? undefined) as any,
    },
  });
}
