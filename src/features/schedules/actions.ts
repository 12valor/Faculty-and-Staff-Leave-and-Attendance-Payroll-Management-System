"use server";

import { revalidatePath } from "next/cache";

import { facultyScheduleSchema, type FacultyScheduleValues, workScheduleSchema, type WorkScheduleValues } from "@/features/schedules/schemas/schedule-schema";
import { createAuditLog } from "@/lib/audit";
import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { timeToMinutes } from "@/lib/calculations/attendance";
import { getPrisma } from "@/lib/prisma";

export async function saveWorkScheduleAction(values: WorkScheduleValues) {
  const admin = await requireCurrentAdmin();
  const parsed = workScheduleSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule." };
  const data = parsed.data;
  if (timeToMinutes(data.expectedTimeOut) <= timeToMinutes(data.expectedTimeIn)) return { ok: false, error: "Time out must be later than time in." };
  const employee = await getPrisma().employee.findUniqueOrThrow({ where: { id: data.employeeId } });
  if (employee.employeeType === "FACULTY") return { ok: false, error: "Faculty-only employees cannot have staff work schedules." };
  const existing = await getPrisma().workSchedule.findUnique({ where: { employeeId_dayOfWeek: { employeeId: data.employeeId, dayOfWeek: data.dayOfWeek } } });
  const schedule = data.id
    ? await getPrisma().workSchedule.update({ where: { id: data.id }, data: { employeeId: data.employeeId, dayOfWeek: data.dayOfWeek, expectedTimeIn: data.expectedTimeIn, expectedTimeOut: data.expectedTimeOut, breakMinutes: data.breakMinutes, requiredHours: data.requiredHours, isActive: true } })
    : existing
      ? await getPrisma().workSchedule.update({ where: { id: existing.id }, data: { expectedTimeIn: data.expectedTimeIn, expectedTimeOut: data.expectedTimeOut, breakMinutes: data.breakMinutes, requiredHours: data.requiredHours, isActive: true } })
      : await getPrisma().workSchedule.create({ data: { employeeId: data.employeeId, dayOfWeek: data.dayOfWeek, expectedTimeIn: data.expectedTimeIn, expectedTimeOut: data.expectedTimeOut, breakMinutes: data.breakMinutes, requiredHours: data.requiredHours } });
  await createAuditLog({ adminId: admin.id, action: data.id || existing ? "WORK_SCHEDULE_UPDATED" : "WORK_SCHEDULE_CREATED", entityType: "WORK_SCHEDULE", entityId: schedule.id, summary: `Staff work schedule for ${employee.employeeNumber} on ${data.dayOfWeek} was saved.` });
  revalidatePath("/schedules");
  return { ok: true };
}

export async function saveFacultyScheduleAction(values: FacultyScheduleValues) {
  const admin = await requireCurrentAdmin();
  const parsed = facultyScheduleSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule." };
  const data = parsed.data;
  const start = timeToMinutes(data.startTime); const end = timeToMinutes(data.endTime);
  if (end <= start) return { ok: false, error: "End time must be later than start time." };
  const employee = await getPrisma().employee.findUniqueOrThrow({ where: { id: data.employeeId } });
  if (employee.employeeType === "STAFF") return { ok: false, error: "Staff employees cannot have faculty teaching schedules." };
  const schedules = await getPrisma().facultySchedule.findMany({ where: { employeeId: data.employeeId, dayOfWeek: data.dayOfWeek, isActive: true, ...(data.id ? { id: { not: data.id } } : {}) } });
  if (schedules.some((row) => timeToMinutes(row.startTime) < end && timeToMinutes(row.endTime) > start)) return { ok: false, error: "This teaching schedule overlaps an existing class." };
  const payload = { employeeId: data.employeeId, subjectOrClass: data.subjectOrClass, dayOfWeek: data.dayOfWeek, startTime: data.startTime, endTime: data.endTime, totalTeachingHours: Number(((end - start) / 60).toFixed(2)), roomOrSection: data.roomOrSection || null, remarks: data.remarks || null, isActive: true };
  const schedule = data.id ? await getPrisma().facultySchedule.update({ where: { id: data.id }, data: payload }) : await getPrisma().facultySchedule.create({ data: payload });
  await createAuditLog({ adminId: admin.id, action: data.id ? "FACULTY_SCHEDULE_UPDATED" : "FACULTY_SCHEDULE_CREATED", entityType: "FACULTY_SCHEDULE", entityId: schedule.id, summary: `Teaching schedule for ${employee.employeeNumber} was saved.` });
  revalidatePath("/schedules");
  return { ok: true };
}

export async function archiveScheduleAction(kind: "work" | "faculty", id: string) {
  const admin = await requireCurrentAdmin();
  if (kind === "work") await getPrisma().workSchedule.update({ where: { id }, data: { isActive: false } });
  else await getPrisma().facultySchedule.update({ where: { id }, data: { isActive: false } });
  await createAuditLog({ adminId: admin.id, action: "SCHEDULE_ARCHIVED", entityType: kind === "work" ? "WORK_SCHEDULE" : "FACULTY_SCHEDULE", entityId: id, summary: "Schedule was archived." });
  revalidatePath("/schedules");
  return { ok: true };
}