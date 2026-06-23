"use server";

import { revalidatePath } from "next/cache";

import { calculateAttendance, getPeriodOrMonthRange } from "@/features/attendance/lib/calculate-attendance";
import { recalculateEmployeeAttendanceForPeriod } from "@/features/attendance/lib/recalculate-payroll";
import { isFutureAttendanceDate } from "@/lib/calculations/attendance";
import { attendanceEntrySchema, bulkAttendanceSchema, type AttendanceEntryValues } from "@/features/attendance/schemas/attendance-schema";
import type { AttendanceEntryMethod, AttendanceStatus } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";
import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { getPrisma } from "@/lib/prisma";

async function prepare(values: AttendanceEntryValues) {
  const parsed = attendanceEntrySchema.safeParse(values);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid attendance data.");
  const value = parsed.data;
  const calculation = await calculateAttendance({ employeeId: value.employeeId, date: value.date, timeIn: value.timeIn || null, timeOut: value.timeOut || null, statusOverride: value.statusOverride as AttendanceStatus | "", overrideReason: value.overrideReason || null });
  return { value, calculation };
}

function attendanceData(prepared: Awaited<ReturnType<typeof prepare>>, entryMethod: AttendanceEntryMethod) {
  const { value, calculation } = prepared;
  return {
    employeeId: value.employeeId, date: value.date, timeIn: value.timeIn || null, timeOut: value.timeOut || null, entryMethod,
    computedStatus: calculation.computedStatus, status: calculation.status, isStatusOverridden: calculation.isStatusOverridden,
    overrideReason: calculation.isStatusOverridden ? value.overrideReason || null : null, lateMinutes: calculation.lateMinutes,
    undertimeMinutes: calculation.undertimeMinutes, overtimeMinutes: calculation.overtimeMinutes,
    renderedMinutes: calculation.renderedMinutes,
    deductionDayValue: calculation.deductionDayValue, deductionAmount: calculation.deductionAmount, remarks: value.remarks || null,
  };
}

export async function previewAttendanceAction(values: AttendanceEntryValues) {
  await requireCurrentAdmin();
  try {
    const prepared = await prepare(values);
    return { ok: true, preview: { schedule: prepared.calculation.schedule, computedStatus: prepared.calculation.computedStatus, finalStatus: prepared.calculation.status, lateMinutes: prepared.calculation.lateMinutes, undertimeMinutes: prepared.calculation.undertimeMinutes, overtimeMinutes: prepared.calculation.overtimeMinutes, deductionDayValue: prepared.calculation.deductionDayValue, deductionAmount: prepared.calculation.deductionAmount } };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to calculate attendance." }; }
}

export async function saveManualAttendanceAction(values: AttendanceEntryValues) {
  const admin = await requireCurrentAdmin();
  try {
    const prepared = await prepare(values);
    const existing = await getPrisma().attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: prepared.value.employeeId, date: prepared.value.date } } });
    if (existing && existing.id !== prepared.value.id) return { ok: false, error: "Attendance already exists for this employee and date." };
    const data = attendanceData(prepared, "ADMIN_MANUAL");
    const record = prepared.value.id ? await getPrisma().attendanceRecord.update({ where: { id: prepared.value.id }, data }) : await getPrisma().attendanceRecord.create({ data });
    const period = await getPrisma().payrollPeriod.findFirst({ where: { startDate: { lte: record.date }, endDate: { gte: record.date } } });
    const range = period ? { startDate: period.startDate, endDate: period.endDate } : getPeriodOrMonthRange(record.date);
    await recalculateEmployeeAttendanceForPeriod(record.employeeId, range.startDate, range.endDate);
    await createAuditLog({ adminId: admin.id, action: prepared.value.id ? "ATTENDANCE_UPDATED" : "MANUAL_ATTENDANCE_CREATED", entityType: "ATTENDANCE_RECORD", entityId: record.id, summary: `Attendance for ${prepared.calculation.employee.employeeNumber} on ${record.date} was saved.`, metadata: { status: record.status, deductionDayValue: record.deductionDayValue.toString() } });
    revalidatePath("/attendance"); revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to save attendance." }; }
}

export async function saveBulkAttendanceAction(rows: AttendanceEntryValues[]) {
  const admin = await requireCurrentAdmin();
  const parsed = bulkAttendanceSchema.safeParse({ rows });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid bulk attendance rows." };
  try {
    const keys = new Set<string>();
    for (const row of parsed.data.rows) { const key = `${row.employeeId}:${row.date}`; if (keys.has(key)) return { ok: false, error: "The bulk form contains duplicate employee/date rows." }; keys.add(key); }
    const existing = await getPrisma().attendanceRecord.findMany({ where: { OR: parsed.data.rows.map((row) => ({ employeeId: row.employeeId, date: row.date })) } });
    if (existing.length) return { ok: false, error: "One or more employees already have attendance for this date." };
    const validRows = parsed.data.rows.filter((row) => !(isFutureAttendanceDate(row.date) && !row.timeIn && !row.timeOut));
    const prepared = await Promise.all(validRows.map(prepare));
    await getPrisma().$transaction(prepared.map((item) => getPrisma().attendanceRecord.create({ data: attendanceData(item, "BULK_ENCODING") })));
    await createAuditLog({ adminId: admin.id, action: "BULK_ATTENDANCE_CREATED", entityType: "ATTENDANCE_RECORD", summary: `${prepared.length} attendance records were created through bulk encoding.`, metadata: { count: prepared.length, date: prepared[0]?.value.date } });
    revalidatePath("/attendance"); revalidatePath("/dashboard");
    return { ok: true, count: prepared.length };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Bulk attendance was not saved." }; }
}

export type DailyAttendanceRow = {
  employeeId: string;
  timeIn: string;
  timeOut: string;
  remarks: string;
  preserveOverride?: boolean;
};

export async function saveDailyAttendanceAction(date: string, rows: DailyAttendanceRow[]) {
  const admin = await requireCurrentAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !rows.length) return { ok: false, error: "Select a valid date with attendance rows." };
  const employeeIds = [...new Set(rows.map((row) => row.employeeId))];
  if (employeeIds.length !== rows.length) return { ok: false, error: "Duplicate employees were found in the daily attendance rows." };
  try {
    const existing = await getPrisma().attendanceRecord.findMany({ where: { date, employeeId: { in: employeeIds } } });
    const existingMap = new Map(existing.map((record) => [record.employeeId, record]));
    const prepared = await Promise.all(rows.map(async (row) => {
      const current = existingMap.get(row.employeeId);
      return prepare({
        employeeId: row.employeeId,
        date,
        timeIn: row.timeIn,
        timeOut: row.timeOut,
        remarks: row.remarks,
        statusOverride: row.preserveOverride && current?.isStatusOverridden ? current.status : "",
        overrideReason: row.preserveOverride && current?.isStatusOverridden ? current.overrideReason ?? "Existing manual override." : "",
      });
    }));
    const scheduled = prepared.filter((item) => item.calculation.schedule && !(isFutureAttendanceDate(date) && !item.value.timeIn && !item.value.timeOut));
    await getPrisma().$transaction(scheduled.map((item) => getPrisma().attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: item.value.employeeId, date } },
      create: attendanceData(item, "BULK_ENCODING"),
      update: attendanceData(item, existingMap.get(item.value.employeeId)?.entryMethod ?? "BULK_ENCODING"),
    })));
    const period = await getPrisma().payrollPeriod.findFirst({ where: { startDate: { lte: date }, endDate: { gte: date } } });
    const range = period ? { startDate: period.startDate, endDate: period.endDate } : getPeriodOrMonthRange(date);
    for (const employeeId of employeeIds) {
      await recalculateEmployeeAttendanceForPeriod(employeeId, range.startDate, range.endDate);
    }
    await createAuditLog({ adminId: admin.id, action: "DAILY_ATTENDANCE_SAVED", entityType: "ATTENDANCE_RECORD", summary: `${scheduled.length} daily attendance row(s) were saved for ${date}.`, metadata: { date, saved: scheduled.length, skippedNoSchedule: rows.length - scheduled.length } });
    revalidatePath("/attendance"); revalidatePath("/dashboard"); revalidatePath("/reports"); revalidatePath("/payroll");
    return { ok: true, count: scheduled.length };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Daily attendance was not saved." }; }
}

export async function removeAttendanceForDateAction(date: string) {
  const admin = await requireCurrentAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Select a valid attendance date." };
  try {
    const lockedRecord = await getPrisma().attendanceRecord.findFirst({
      where: {
        date,
        payrollBreakdowns: {
          some: { payrollDeduction: { payrollPeriod: { status: "LOCKED" } } },
        },
      },
    });
    if (lockedRecord) return { ok: false, error: "Attendance linked to a locked payroll period cannot be removed." };

    const count = await getPrisma().$transaction(async (tx) => {
      const deleted = await tx.attendanceRecord.deleteMany({ where: { date } });
      await createAuditLog({
        adminId: admin.id,
        action: "DAILY_ATTENDANCE_REMOVED",
        entityType: "ATTENDANCE_RECORD",
        summary: `${deleted.count} attendance row(s) were removed for ${date}.`,
        metadata: { date, count: deleted.count },
      }, tx);
      return deleted.count;
    });
    revalidatePath("/attendance"); revalidatePath("/dashboard"); revalidatePath("/reports"); revalidatePath("/payroll");
    return { ok: true, count };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Attendance could not be removed." };
  }
}

export type CsvAttendanceRow = { employeeNumber: string; date: string; timeIn: string; timeOut: string; status: string; remarks: string };
export async function importAttendanceAction(rows: CsvAttendanceRow[]) {
  const admin = await requireCurrentAdmin();
  if (!rows.length) return { ok: false, error: "The CSV file has no data rows." };
  const employeeNumbers = [...new Set(rows.map((row) => row.employeeNumber))];
  const employees = await getPrisma().employee.findMany({ where: { employeeNumber: { in: employeeNumbers } } });
  const employeeMap = new Map(employees.map((employee) => [employee.employeeNumber, employee]));
  const missing = employeeNumbers.filter((number) => !employeeMap.has(number));
  if (missing.length) return { ok: false, error: `Unknown employee numbers: ${missing.join(", ")}` };
  const values: AttendanceEntryValues[] = rows.map((row) => ({ employeeId: employeeMap.get(row.employeeNumber)!.id, date: row.date, timeIn: row.timeIn, timeOut: row.timeOut, statusOverride: row.status as AttendanceStatus, overrideReason: row.remarks || "Status supplied by CSV import.", remarks: row.remarks }));
  const keys = new Set<string>();
  for (const value of values) { const key = `${value.employeeId}:${value.date}`; if (keys.has(key)) return { ok: false, error: "The CSV contains duplicate employee/date rows." }; keys.add(key); }
  const existing = await getPrisma().attendanceRecord.findMany({ where: { OR: values.map((row) => ({ employeeId: row.employeeId, date: row.date })) } });
  if (existing.length) return { ok: false, error: "CSV import rejected: one or more employee/date records already exist." };
  try {
    const prepared = await Promise.all(values.map(prepare));
    await getPrisma().$transaction(prepared.map((item) => getPrisma().attendanceRecord.create({ data: attendanceData(item, "CSV_IMPORT") })));
    const affectedEmployees = [...new Set(values.map((v) => v.employeeId))];
    for (const employeeId of affectedEmployees) {
      const employeeDate = values.find((v) => v.employeeId === employeeId)!.date;
      const period = await getPrisma().payrollPeriod.findFirst({ where: { startDate: { lte: employeeDate }, endDate: { gte: employeeDate } } });
      const range = period ? { startDate: period.startDate, endDate: period.endDate } : getPeriodOrMonthRange(employeeDate);
      await recalculateEmployeeAttendanceForPeriod(employeeId, range.startDate, range.endDate);
    }
    await createAuditLog({ adminId: admin.id, action: "ATTENDANCE_IMPORTED", entityType: "ATTENDANCE_RECORD", summary: `${prepared.length} attendance records were imported from CSV.`, metadata: { count: prepared.length } });
    revalidatePath("/attendance"); revalidatePath("/dashboard");
    return { ok: true, count: prepared.length };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "CSV import failed." }; }
}
