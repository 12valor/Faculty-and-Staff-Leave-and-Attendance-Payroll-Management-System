import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAuditLog } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import { getActionAdmin } from "@/lib/server-action";

const directoryRequestSchema = z.object({
  action: z.enum(["save", "toggle"]),
  kind: z.enum(["department", "position"]),
  id: z.string().optional(),
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(300).optional(),
});

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function duplicateNameError(error: unknown, label: string) {
  return error instanceof Error && error.message.includes("Unique constraint")
    ? `${label} name already exists.`
    : `Unable to save ${label.toLowerCase()}.`;
}

export async function POST(request: Request) {
  const auth = await getActionAdmin();
  if (!auth.ok) {
    return NextResponse.json(auth, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = directoryRequestSchema.safeParse({
    action: text(formData, "action"),
    kind: text(formData, "kind"),
    id: text(formData, "id") || undefined,
    name: text(formData, "name") || undefined,
    description: text(formData, "description") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Check the directory values and try again." }, { status: 400 });
  }

  const { admin } = auth;
  const data = parsed.data;
  const prisma = getPrisma();
  const label = data.kind === "department" ? "Department" : "Position";

  try {
    if (data.kind === "department") {
      if (data.action === "toggle") {
        const current = await prisma.department.findUniqueOrThrow({ where: { id: data.id } });
        const department = await prisma.department.update({ where: { id: data.id }, data: { isActive: !current.isActive } });
        await createAuditLog({ adminId: admin.id, action: "DEPARTMENT_STATUS_CHANGED", entityType: "DEPARTMENT", entityId: department.id, summary: `${department.name} was ${department.isActive ? "reactivated" : "deactivated"}.` });
      } else {
        const department = data.id
          ? await prisma.department.update({ where: { id: data.id }, data: { name: data.name!, description: data.description } })
          : await prisma.department.create({ data: { name: data.name!, description: data.description } });
        await createAuditLog({ adminId: admin.id, action: data.id ? "DEPARTMENT_UPDATED" : "DEPARTMENT_CREATED", entityType: "DEPARTMENT", entityId: department.id, summary: `${department.name} was ${data.id ? "updated" : "created"}.` });
      }
    } else if (data.action === "toggle") {
      const current = await prisma.position.findUniqueOrThrow({ where: { id: data.id } });
      const position = await prisma.position.update({ where: { id: data.id }, data: { isActive: !current.isActive } });
      await createAuditLog({ adminId: admin.id, action: "POSITION_STATUS_CHANGED", entityType: "POSITION", entityId: position.id, summary: `${position.name} was ${position.isActive ? "reactivated" : "deactivated"}.` });
    } else {
      const position = data.id
        ? await prisma.position.update({ where: { id: data.id }, data: { name: data.name!, description: data.description } })
        : await prisma.position.create({ data: { name: data.name!, description: data.description } });
      await createAuditLog({ adminId: admin.id, action: data.id ? "POSITION_UPDATED" : "POSITION_CREATED", entityType: "POSITION", entityId: position.id, summary: `${position.name} was ${data.id ? "updated" : "created"}.` });
    }

    revalidatePath("/settings");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = data.action === "toggle"
      ? "Unable to update status."
      : duplicateNameError(error, label);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

