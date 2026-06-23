"use server";

import { revalidatePath } from "next/cache";

import { facultyScheduleSchema, type FacultyScheduleValues, workScheduleSchema, type WorkScheduleValues } from "@/features/schedules/schemas/schedule-schema";
import { createAuditLog } from "@/lib/audit";
import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { timeToMinutes } from "@/lib/calculations/attendance";
import { previousDate, todayInTimeZone } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";

function overlaps(startA: string, endA: string | null, startB: string, endB: string | null) {
  return startA <= (endB ?? "9999-12-31") && startB <= (endA ?? "9999-12-31");
}

function revalidateSchedulePaths() {
  revalidatePath("/schedules");
  revalidatePath("/attendance");
  revalidatePath("/leave");
  revalidatePath("/payroll");
  revalidatePath("/reports");
}

export async function saveWorkScheduleAction(values: WorkScheduleValues) {
  const admin = await requireCurrentAdmin();
  const parsed = workScheduleSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule." };
  const data = parsed.data;
  if (timeToMinutes(data.expectedTimeOut) <= timeToMinutes(data.expectedTimeIn)) return { ok: false, error: "Time out must be later than time in." };

  try {
    const employee = await getPrisma().employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) return { ok: false, error: "The selected employee no longer exists." };
    if (employee.employeeType === "FACULTY") return { ok: false, error: "Faculty-only employees cannot have staff work schedules." };
    const result = await getPrisma().$transaction(async (tx) => {
      const allRows = await tx.workSchedule.findMany({ where: { employeeId: data.employeeId, isActive: true }, orderBy: { effectiveFrom: "asc" } });
      const futureStart = allRows.map((row) => row.effectiveFrom).filter((date) => date > data.effectiveFrom).sort()[0];
      const effectiveTo = futureStart ? previousDate(futureStart) : null;
      const rowsAtStart = allRows.filter((row) => row.effectiveFrom === data.effectiveFrom);
      if (rowsAtStart.length) await tx.workSchedule.deleteMany({ where: { id: { in: rowsAtStart.map((row) => row.id) } } });
      const currentRows = allRows.filter((row) => row.effectiveFrom < data.effectiveFrom && (!row.effectiveTo || row.effectiveTo >= data.effectiveFrom));
      if (currentRows.length) await tx.workSchedule.updateMany({ where: { id: { in: currentRows.map((row) => row.id) } }, data: { effectiveTo: previousDate(data.effectiveFrom) } });
      const scheduleGroupId = crypto.randomUUID();
      await tx.workSchedule.createMany({ data: data.workingDays.map((dayOfWeek) => ({
        employeeId: data.employeeId,
        scheduleGroupId,
        dayOfWeek,
        expectedTimeIn: data.expectedTimeIn,
        expectedTimeOut: data.expectedTimeOut,
        breakMinutes: data.breakMinutes,
        requiredHours: data.requiredHours,
        effectiveFrom: data.effectiveFrom,
        effectiveTo,
      })) });
      await createAuditLog({ adminId: admin.id, action: "WORK_SCHEDULE_VERSION_SAVED", entityType: "WORK_SCHEDULE", entityId: scheduleGroupId, summary: `Staff work schedule for ${employee.employeeNumber} was saved from ${data.effectiveFrom}.`, metadata: { workingDays: data.workingDays, effectiveFrom: data.effectiveFrom, effectiveTo } }, tx);
      return scheduleGroupId;
    });
    revalidateSchedulePaths();
    return { ok: true, id: result };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to save the staff schedule." }; }
}

export async function saveFacultyScheduleAction(values: FacultyScheduleValues) {
  const admin = await requireCurrentAdmin();
  const parsed = facultyScheduleSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule." };
  const data = parsed.data;
  const start = timeToMinutes(data.startTime); const end = timeToMinutes(data.endTime);
  if (end <= start) return { ok: false, error: "End time must be later than start time." };

  try {
    const employee = await getPrisma().employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) return { ok: false, error: "The selected employee no longer exists." };
    if (employee.employeeType === "STAFF") return { ok: false, error: "Staff employees cannot have faculty teaching schedules." };
    const groupId = await getPrisma().$transaction(async (tx) => {
      let effectiveTo: string | null = null;
      if (data.scheduleGroupId) {
        const oldRows = await tx.facultySchedule.findMany({ where: { scheduleGroupId: data.scheduleGroupId } });
        if (!oldRows.length) throw new Error("The teaching schedule version no longer exists.");
        const oldStart = oldRows[0].effectiveFrom;
        if (oldStart === data.effectiveFrom) {
          effectiveTo = oldRows[0].effectiveTo;
          await tx.facultySchedule.deleteMany({ where: { scheduleGroupId: data.scheduleGroupId } });
        } else {
          if (data.effectiveFrom < oldStart) throw new Error("The new effective date cannot be before the existing schedule version.");
          await tx.facultySchedule.updateMany({ where: { scheduleGroupId: data.scheduleGroupId }, data: { effectiveTo: previousDate(data.effectiveFrom) } });
        }
      }
      const conflicts = await tx.facultySchedule.findMany({ where: { employeeId: data.employeeId, dayOfWeek: { in: data.workingDays }, isActive: true } });
      if (conflicts.some((row) => overlaps(row.effectiveFrom, row.effectiveTo, data.effectiveFrom, effectiveTo) && timeToMinutes(row.startTime) < end && timeToMinutes(row.endTime) > start)) throw new Error("This teaching schedule overlaps an existing class on one or more selected days.");
      const scheduleGroupId = crypto.randomUUID();
      await tx.facultySchedule.createMany({ data: data.workingDays.map((dayOfWeek) => ({
        employeeId: data.employeeId,
        scheduleGroupId,
        subjectOrClass: data.subjectOrClass || "Whole Day",
        dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        totalTeachingHours: Number(((end - start) / 60).toFixed(2)),
        roomOrSection: data.roomOrSection || null,
        remarks: data.remarks || null,
        effectiveFrom: data.effectiveFrom,
        effectiveTo,
      })) });
      await createAuditLog({ adminId: admin.id, action: "FACULTY_SCHEDULE_VERSION_SAVED", entityType: "FACULTY_SCHEDULE", entityId: scheduleGroupId, summary: `Teaching schedule for ${employee.employeeNumber} was saved from ${data.effectiveFrom}.`, metadata: { subjectOrClass: data.subjectOrClass || "Whole Day", workingDays: data.workingDays, effectiveFrom: data.effectiveFrom } }, tx);
      return scheduleGroupId;
    });
    revalidateSchedulePaths();
    return { ok: true, id: groupId };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to save the teaching schedule." }; }
}

export async function archiveScheduleAction(kind: "work" | "faculty", scheduleGroupId: string) {
  const admin = await requireCurrentAdmin();
  const today = todayInTimeZone();
  const yesterday = previousDate(today);
  try {
    const rows = kind === "work"
      ? await getPrisma().workSchedule.findMany({ where: { scheduleGroupId } })
      : await getPrisma().facultySchedule.findMany({ where: { scheduleGroupId } });
    if (!rows.length) return { ok: false, error: "Schedule was not found." };
    await getPrisma().$transaction(async (tx) => {
      if (kind === "work") {
        await tx.workSchedule.updateMany({ where: { scheduleGroupId, effectiveFrom: { lt: today } }, data: { effectiveTo: yesterday } });
        await tx.workSchedule.updateMany({ where: { scheduleGroupId, effectiveFrom: { gte: today } }, data: { isActive: false } });
      } else {
        await tx.facultySchedule.updateMany({ where: { scheduleGroupId, effectiveFrom: { lt: today } }, data: { effectiveTo: yesterday } });
        await tx.facultySchedule.updateMany({ where: { scheduleGroupId, effectiveFrom: { gte: today } }, data: { isActive: false } });
      }
      await createAuditLog({ adminId: admin.id, action: "SCHEDULE_ARCHIVED", entityType: kind === "work" ? "WORK_SCHEDULE" : "FACULTY_SCHEDULE", entityId: scheduleGroupId, summary: `Schedule was ended on ${yesterday}.` }, tx);
    });
    revalidateSchedulePaths();
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to end the schedule." }; }
}
