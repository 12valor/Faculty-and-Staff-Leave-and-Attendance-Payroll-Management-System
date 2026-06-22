"use server";

import { revalidatePath } from "next/cache";

import { calculateAttendance } from "@/features/attendance/lib/calculate-attendance";
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
    const prepared = await Promise.all(parsed.data.rows.map(prepare));
    await getPrisma().$transaction(prepared.map((item) => getPrisma().attendanceRecord.create({ data: attendanceData(item, "BULK_ENCODING") })));
    await createAuditLog({ adminId: admin.id, action: "BULK_ATTENDANCE_CREATED", entityType: "ATTENDANCE_RECORD", summary: `${prepared.length} attendance records were created through bulk encoding.`, metadata: { count: prepared.length, date: prepared[0]?.value.date } });
    revalidatePath("/attendance"); revalidatePath("/dashboard");
    return { ok: true, count: prepared.length };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Bulk attendance was not saved." }; }
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
    await createAuditLog({ adminId: admin.id, action: "ATTENDANCE_IMPORTED", entityType: "ATTENDANCE_RECORD", summary: `${prepared.length} attendance records were imported from CSV.`, metadata: { count: prepared.length } });
    revalidatePath("/attendance"); revalidatePath("/dashboard");
    return { ok: true, count: prepared.length };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "CSV import failed." }; }
}