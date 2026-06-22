import "server-only";

import { getPrisma } from "@/lib/prisma";

type AuditInput = {
  adminId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: unknown;
};

export async function createAuditLog(input: AuditInput) {
  return getPrisma().auditLog.create({
    data: {
      adminId: input.adminId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata === undefined ? null : JSON.stringify(input.metadata),
    },
  });
}