"use server";

import { revalidatePath } from "next/cache";

import { payrollPeriodSchema, type PayrollPeriodValues } from "@/features/payroll/schemas/payroll-schema";
import { describeAttendancePenalty, getPayrollSourceAmount, summarizePayrollSources, type PayrollSource } from "@/lib/calculations/payroll";
import { createAuditLog } from "@/lib/audit";
import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { getPrisma } from "@/lib/prisma";
import { getPayrollRules } from "@/lib/settings/payroll-rules";
import { resolveScheduleForDateFromAllRows } from "@/features/schedules/lib/resolve-schedule";
import { isFutureAttendanceDate } from "@/lib/calculations/attendance";

export type PayrollPreviewRow = {
  employeeId: string; employee: string; monthlySalary: number; dailyRate: number; totalLateMinutes: number; totalUndertimeMinutes: number; absenceDays: number; lwopDays: number; dayValue: number; amount: number;
  breakdowns: Array<PayrollSource & { attendanceRecordId?: string; leaveAllocationId?: string; amount: number; description: string }>;
};

export async function createPayrollPeriodAction(values: PayrollPeriodValues) {
  const admin = await requireCurrentAdmin(); const parsed = payrollPeriodSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payroll period." };
  const overlap = await getPrisma().payrollPeriod.findFirst({ where: { startDate: { lte: parsed.data.endDate }, endDate: { gte: parsed.data.startDate } } });
  if (overlap) return { ok: false, error: `Dates overlap payroll period ${overlap.name}.` };
  try {
    const period = await getPrisma().$transaction(async (tx) => {
      const created = await tx.payrollPeriod.create({ data: { ...parsed.data, createdById: admin.id } });
      await createAuditLog({ adminId: admin.id, action: "PAYROLL_PERIOD_CREATED", entityType: "PAYROLL_PERIOD", entityId: created.id, summary: `Payroll period ${created.name} was created.` }, tx);
      return created;
    });
    revalidatePath("/payroll"); return { ok: true, id: period.id };
  } catch (error) { return { ok: false, error: error instanceof Error && error.message.includes("Unique constraint") ? "Payroll period name already exists." : "Unable to create payroll period." }; }
}

async function buildPayrollPreview(periodId: string): Promise<{ period: { id: string; name: string; startDate: string; endDate: string; status: string }; rows: PayrollPreviewRow[] }> {
  const period = await getPrisma().payrollPeriod.findUniqueOrThrow({ where: { id: periodId } });
  const [rules, employees, attendance, allocations] = await Promise.all([
    getPayrollRules(),
    getPrisma().employee.findMany({ where: { employmentStatus: { not: "ARCHIVED" }, serviceStartDate: { lte: period.endDate }, OR: [{ serviceEndDate: null }, { serviceEndDate: { gte: period.startDate } }] }, include: { workSchedules: true, facultySchedules: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    getPrisma().attendanceRecord.findMany({ where: { date: { gte: period.startDate, lte: period.endDate } } }),
    getPrisma().leaveAllocation.findMany({ where: { date: { gte: period.startDate, lte: period.endDate }, leaveRecord: { status: "APPROVED" } }, include: { leaveRecord: true } }),
  ]);
  const allocationMap = new Map(allocations.map((row) => [`${row.employeeId}:${row.date}`, row]));
  return { period, rows: employees.map((employee) => {
    const employeeAttendance = attendance.filter((row) => row.employeeId === employee.id && !isFutureAttendanceDate(row.date)); const attendanceDates = new Set(employeeAttendance.map((row) => row.date));
    const sources: Array<PayrollSource & { attendanceRecordId?: string; leaveAllocationId?: string; description: string }> = [];
    for (const record of employeeAttendance) {
      if (record.status === "NO_SCHEDULE") continue;
      if (record.status === "ABSENT" && !resolveScheduleForDateFromAllRows(employee.employeeType, record.date, employee.workSchedules, employee.facultySchedules)) continue;
      const allocation = allocationMap.get(`${employee.id}:${record.date}`);
      if (allocation) {
        const unpaid = Number(allocation.unpaidDayValue); if (unpaid <= 0) continue;
        sources.push({ date: record.date, source: "ATTENDANCE", attendanceRecordId: record.id, leaveAllocationId: allocation.id, lateMinutes: 0, undertimeMinutes: 0, lwopDayValue: unpaid, dayValue: unpaid, description: "Approved unpaid leave" }); continue;
      }
      const dayValue = record.status === "ABSENT" ? 1 : Number(record.deductionDayValue);
      if (dayValue <= 0 && record.lateMinutes <= 0 && record.undertimeMinutes <= 0) continue;
      sources.push({ date: record.date, source: "ATTENDANCE", attendanceRecordId: record.id, lateMinutes: record.lateMinutes, undertimeMinutes: record.undertimeMinutes, absenceDayValue: record.status === "ABSENT" ? 1 : 0, dayValue, amountOverride: Number(record.deductionAmount), description: describeAttendancePenalty({ status: record.status, lateMinutes: record.lateMinutes, undertimeMinutes: record.undertimeMinutes, penaltyUnits: dayValue }) });
    }
    for (const allocation of allocations.filter((row) => row.employeeId === employee.id && Number(row.unpaidDayValue) > 0 && !attendanceDates.has(row.date) && !isFutureAttendanceDate(row.date))) sources.push({ date: allocation.date, source: "LEAVE_WITHOUT_PAY", leaveAllocationId: allocation.id, lwopDayValue: Number(allocation.unpaidDayValue), dayValue: Number(allocation.unpaidDayValue), description: "Approved unpaid leave without attendance entry" });
    const summary = summarizePayrollSources(Number(employee.monthlySalary), rules.workingDaysPerMonth, sources);
    return { employeeId: employee.id, employee: `${employee.lastName}, ${employee.firstName}`, monthlySalary: Number(employee.monthlySalary), dailyRate: summary.dailyRate, totalLateMinutes: summary.lateMinutes, totalUndertimeMinutes: summary.undertimeMinutes, absenceDays: summary.absenceDays, lwopDays: summary.lwopDays, dayValue: summary.dayValue, amount: summary.amount, breakdowns: summary.rows.map((row) => { const source = sources.find((item) => item.date === row.date && item.source === row.source)!; return { ...source, amount: getPayrollSourceAmount(source, summary.dailyRate) }; }) };
  }).filter((row) => row.amount > 0 || row.totalLateMinutes > 0 || row.totalUndertimeMinutes > 0) };
}

export async function previewPayrollAction(periodId: string) {
  await requireCurrentAdmin();
  try { return { ok: true, ...(await buildPayrollPreview(periodId)) }; } catch { return { ok: false, error: "Unable to preview payroll deductions." }; }
}

export async function generatePayrollAction(periodId: string) {
  const admin = await requireCurrentAdmin();
  try {
    const preview = await buildPayrollPreview(periodId);
    if (preview.period.status === "LOCKED") throw new Error("Locked payroll periods cannot be regenerated.");
    await getPrisma().$transaction(async (tx) => {
      await tx.payrollDeduction.deleteMany({ where: { payrollPeriodId: periodId } });
      for (const row of preview.rows) await tx.payrollDeduction.create({ data: { payrollPeriodId: periodId, employeeId: row.employeeId, monthlySalary: row.monthlySalary, dailyRate: row.dailyRate, totalLateMinutes: row.totalLateMinutes, totalUndertimeMinutes: row.totalUndertimeMinutes, absenceDays: row.absenceDays, lwopDays: row.lwopDays, dayValue: row.dayValue, amount: row.amount, breakdowns: { create: row.breakdowns.map((item) => ({ date: item.date, source: item.source, attendanceRecordId: item.attendanceRecordId, leaveAllocationId: item.leaveAllocationId, lateMinutes: item.lateMinutes ?? 0, undertimeMinutes: item.undertimeMinutes ?? 0, absenceDayValue: item.absenceDayValue ?? 0, lwopDayValue: item.lwopDayValue ?? 0, dayValue: item.dayValue, amount: item.amount, description: item.description })) } } });
      await tx.payrollPeriod.update({ where: { id: periodId }, data: { status: "GENERATED", generatedAt: new Date() } });
      await createAuditLog({ adminId: admin.id, action: "PAYROLL_DEDUCTIONS_GENERATED", entityType: "PAYROLL_PERIOD", entityId: periodId, summary: `${preview.rows.length} payroll deduction summary record(s) were generated.`, metadata: { totalAmount: preview.rows.reduce((sum, row) => sum + row.amount, 0) } }, tx);
    });
    revalidatePath("/payroll"); revalidatePath("/dashboard"); return { ok: true, count: preview.rows.length };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to generate payroll deductions." }; }
}

export async function lockPayrollPeriodAction(periodId: string) {
  const admin = await requireCurrentAdmin();
  try {
    await getPrisma().$transaction(async (tx) => {
      const period = await tx.payrollPeriod.findUniqueOrThrow({ where: { id: periodId } });
      if (period.status !== "GENERATED") throw new Error("Generate deductions before locking the payroll period.");
      await tx.payrollPeriod.update({ where: { id: periodId }, data: { status: "LOCKED", lockedAt: new Date() } });
      await createAuditLog({ adminId: admin.id, action: "PAYROLL_PERIOD_LOCKED", entityType: "PAYROLL_PERIOD", entityId: periodId, summary: `Payroll period ${period.name} was locked.` }, tx);
    });
    revalidatePath("/payroll"); return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to lock payroll period." }; }
}
