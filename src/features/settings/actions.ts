"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditLog } from "@/lib/audit";
import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { getPrisma } from "@/lib/prisma";
import { PAYROLL_SETTING_KEYS } from "@/lib/settings/payroll-rules";

const directorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300).optional(),
});

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveDepartmentAction(formData: FormData) {
  const admin = await requireCurrentAdmin();
  const data = directorySchema.parse({ id: text(formData, "id") || undefined, name: text(formData, "name"), description: text(formData, "description") || undefined });
  const department = data.id
    ? await getPrisma().department.update({ where: { id: data.id }, data: { name: data.name, description: data.description } })
    : await getPrisma().department.create({ data: { name: data.name, description: data.description } });
  await createAuditLog({ adminId: admin.id, action: data.id ? "DEPARTMENT_UPDATED" : "DEPARTMENT_CREATED", entityType: "DEPARTMENT", entityId: department.id, summary: `${department.name} was ${data.id ? "updated" : "created"}.` });
  revalidatePath("/settings");
}

export async function toggleDepartmentAction(formData: FormData) {
  const admin = await requireCurrentAdmin();
  const id = text(formData, "id");
  const current = await getPrisma().department.findUniqueOrThrow({ where: { id } });
  const department = await getPrisma().department.update({ where: { id }, data: { isActive: !current.isActive } });
  await createAuditLog({ adminId: admin.id, action: "DEPARTMENT_STATUS_CHANGED", entityType: "DEPARTMENT", entityId: id, summary: `${department.name} was ${department.isActive ? "reactivated" : "deactivated"}.` });
  revalidatePath("/settings");
}

export async function savePositionAction(formData: FormData) {
  const admin = await requireCurrentAdmin();
  const data = directorySchema.parse({ id: text(formData, "id") || undefined, name: text(formData, "name"), description: text(formData, "description") || undefined });
  const position = data.id
    ? await getPrisma().position.update({ where: { id: data.id }, data: { name: data.name, description: data.description } })
    : await getPrisma().position.create({ data: { name: data.name, description: data.description } });
  await createAuditLog({ adminId: admin.id, action: data.id ? "POSITION_UPDATED" : "POSITION_CREATED", entityType: "POSITION", entityId: position.id, summary: `${position.name} was ${data.id ? "updated" : "created"}.` });
  revalidatePath("/settings");
}

export async function togglePositionAction(formData: FormData) {
  const admin = await requireCurrentAdmin();
  const id = text(formData, "id");
  const current = await getPrisma().position.findUniqueOrThrow({ where: { id } });
  const position = await getPrisma().position.update({ where: { id }, data: { isActive: !current.isActive } });
  await createAuditLog({ adminId: admin.id, action: "POSITION_STATUS_CHANGED", entityType: "POSITION", entityId: id, summary: `${position.name} was ${position.isActive ? "reactivated" : "deactivated"}.` });
  revalidatePath("/settings");
}

const rulesSchema = z.object({
  workingDaysPerMonth: z.coerce.number().positive().max(31),
  standardWorkHoursPerDay: z.coerce.number().positive().max(24),
  lateGraceMinutes: z.coerce.number().int().min(15).max(15),
  regularTeachingLoadHours: z.coerce.number().min(0).max(80),
  overtimeMultiplier: z.coerce.number().positive().max(10),
  facultyOverloadHourlyRate: z.preprocess(
    (value) => value === "" ? null : value,
    z.coerce.number().positive().max(1_000_000).nullable(),
  ),
});

export async function savePayrollRulesAction(formData: FormData) {
  const admin = await requireCurrentAdmin();
  const rules = rulesSchema.parse(Object.fromEntries(formData));
  for (const [key, value] of Object.entries(rules)) {
    const settingKey = PAYROLL_SETTING_KEYS[key as keyof typeof PAYROLL_SETTING_KEYS];
    if (value === null) {
      await getPrisma().systemSetting.deleteMany({ where: { key: settingKey } });
      continue;
    }
    await getPrisma().systemSetting.upsert({
      where: { key: settingKey },
      update: { value: String(value) },
      create: { key: settingKey, value: String(value), valueType: "number" },
    });
  }
  await createAuditLog({ adminId: admin.id, action: "PAYROLL_RULES_UPDATED", entityType: "SYSTEM_SETTING", summary: "Payroll rules were updated.", metadata: rules });
  revalidatePath("/settings");
  revalidatePath("/payroll");
  revalidatePath("/overtime-overload");
}
