"use server";

import { revalidatePath } from "next/cache";

import { computeWeeklyOverload, overtimeMinutesToHours } from "@/lib/calculations/overtime-overload";
import { calculateOverloadPay, calculateOvertimePay } from "@/lib/calculations/payroll";
import { createAuditLog } from "@/lib/audit";
import { getActionAdmin } from "@/lib/server-action";
import { weekBounds } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";
import { getPayrollRules } from "@/lib/settings/payroll-rules";

export async function generateOvertimeAction(startDate: string, endDate: string) {
  const auth = await getActionAdmin();
if (!auth.ok) return auth;
const { admin } = auth;
  if (!startDate || !endDate || endDate < startDate) return { ok: false, error: "Select a valid overtime date range." };
  try {
    const records = await getPrisma().attendanceRecord.findMany({ where: { date: { gte: startDate, lte: endDate }, overtimeMinutes: { gt: 0 }, employee: { employeeType: { in: ["STAFF", "FACULTY_WITH_STAFF_WORK"] }, employmentStatus: "ACTIVE" }, overtimeRecord: null } });
    await getPrisma().$transaction(async (tx) => {
      if (records.length) await tx.overtimeRecord.createMany({ data: records.map((record) => ({ employeeId: record.employeeId, attendanceRecordId: record.id, date: record.date, minutes: record.overtimeMinutes, hours: overtimeMinutesToHours(record.overtimeMinutes) })) });
      await createAuditLog({ adminId: admin.id, action: "OVERTIME_GENERATED", entityType: "OVERTIME_BATCH", entityId: `${startDate}:${endDate}`, summary: `${records.length} overtime record(s) were generated.`, metadata: { startDate, endDate, count: records.length } }, tx);
    });
    revalidatePath("/overtime-overload"); return { ok: true, count: records.length };
  } catch { return { ok: false, error: "Unable to generate overtime records." }; }
}

export async function decideOvertimeAction(id: string, status: "APPROVED" | "REJECTED", remarks?: string) {
  const auth = await getActionAdmin();
if (!auth.ok) return auth;
const { admin } = auth;
  try {
    const rules = await getPayrollRules();
    await getPrisma().$transaction(async (tx) => {
      const record = await tx.overtimeRecord.findUniqueOrThrow({ where: { id }, include: { employee: true } });
      if (record.status !== "PENDING") throw new Error("Only pending overtime can be decided.");
      const amount = status === "APPROVED" ? calculateOvertimePay({ monthlySalary: Number(record.employee.monthlySalary), workingDaysPerMonth: rules.workingDaysPerMonth, standardWorkHoursPerDay: rules.standardWorkHoursPerDay, overtimeMultiplier: rules.overtimeMultiplier, hours: Number(record.hours) }).amount : 0;
      await tx.overtimeRecord.update({ where: { id }, data: { status, amount, remarks: remarks || null, decidedById: admin.id, decidedAt: new Date() } });
      await createAuditLog({ adminId: admin.id, action: `OVERTIME_${status}`, entityType: "OVERTIME_RECORD", entityId: id, summary: `Overtime record was ${status.toLowerCase()}.`, metadata: { remarks } }, tx);
    });
    revalidatePath("/overtime-overload"); revalidatePath("/payroll"); return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to update overtime." }; }
}

export async function generateOverloadAction(selectedDate: string) {
  const auth = await getActionAdmin();
if (!auth.ok) return auth;
const { admin } = auth; if (!selectedDate) return { ok: false, error: "Select a week." };
  const { start, end } = weekBounds(selectedDate);
  try {
    const [rules, employees] = await Promise.all([getPayrollRules(), getPrisma().employee.findMany({ where: { employmentStatus: "ACTIVE", employeeType: { in: ["FACULTY", "FACULTY_WITH_STAFF_WORK"] } }, include: { facultySchedules: { where: { isActive: true } } } })]);
    const existing = await getPrisma().overloadRecord.findMany({ where: { weekStart: start }, select: { employeeId: true } }); const existingIds = new Set(existing.map((row) => row.employeeId));
    const rows = employees.map((employee) => { const total = employee.facultySchedules.reduce((sum, row) => sum + Number(row.totalTeachingHours), 0); return { employeeId: employee.id, total, overload: computeWeeklyOverload(total, rules.regularTeachingLoadHours) }; }).filter((row) => row.overload > 0 && !existingIds.has(row.employeeId));
    await getPrisma().$transaction(async (tx) => {
      if (rows.length) await tx.overloadRecord.createMany({ data: rows.map((row) => ({ employeeId: row.employeeId, weekStart: start, weekEnd: end, totalTeachingHours: row.total, regularLoadHours: rules.regularTeachingLoadHours, overloadHours: row.overload })) });
      await createAuditLog({ adminId: admin.id, action: "OVERLOAD_GENERATED", entityType: "OVERLOAD_BATCH", entityId: start, summary: `${rows.length} weekly overload record(s) were generated.`, metadata: { weekStart: start, weekEnd: end, count: rows.length } }, tx);
    });
    revalidatePath("/overtime-overload"); return { ok: true, count: rows.length, weekStart: start };
  } catch { return { ok: false, error: "Unable to generate overload records." }; }
}

export async function decideOverloadAction(id: string, status: "APPROVED" | "REJECTED", remarks?: string) {
  const auth = await getActionAdmin();
if (!auth.ok) return auth;
const { admin } = auth;
  try {
    const rules = await getPayrollRules();
    if (status === "APPROVED" && rules.facultyOverloadHourlyRate === null) throw new Error("Set the faculty overload hourly rate in Settings before approving overload.");
    await getPrisma().$transaction(async (tx) => {
      const record = await tx.overloadRecord.findUniqueOrThrow({ where: { id } });
      if (record.status !== "PENDING") throw new Error("Only pending overload can be decided.");
      const amount = status === "APPROVED" ? calculateOverloadPay(Number(record.overloadHours), rules.facultyOverloadHourlyRate!) : 0;
      await tx.overloadRecord.update({ where: { id }, data: { status, amount, remarks: remarks || null, decidedById: admin.id, decidedAt: new Date() } });
      await createAuditLog({ adminId: admin.id, action: `OVERLOAD_${status}`, entityType: "OVERLOAD_RECORD", entityId: id, summary: `Overload record was ${status.toLowerCase()}.`, metadata: { remarks } }, tx);
    });
    revalidatePath("/overtime-overload"); revalidatePath("/payroll"); return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to update overload." }; }
}
