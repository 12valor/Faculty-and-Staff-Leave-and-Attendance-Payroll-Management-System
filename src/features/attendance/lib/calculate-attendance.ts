import "server-only";

import type { AttendanceStatus, DayOfWeek } from "@/generated/prisma/client";
import { computeAttendanceDeduction, computeAttendanceStatus, getLateMinutes, getOvertimeMinutes, getUndertimeMinutes } from "@/lib/calculations/attendance";
import { getPrisma } from "@/lib/prisma";
import { getPayrollRules } from "@/lib/settings/payroll-rules";

const dayNames: DayOfWeek[] = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
function dayOfWeek(date: string) { return dayNames[new Date(`${date}T00:00:00Z`).getUTCDay()]; }

export async function calculateAttendance(input: { employeeId: string; date: string; timeIn?: string | null; timeOut?: string | null; statusOverride?: AttendanceStatus | ""; overrideReason?: string | null }) {
  const prisma = getPrisma();
  const [employee, rules, conversions, approvedLeave] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { id: input.employeeId } }),
    getPayrollRules(),
    prisma.cscTimeConversion.findMany(),
    prisma.leaveRecord.findFirst({ where: { employeeId: input.employeeId, status: "APPROVED", startDate: { lte: input.date }, endDate: { gte: input.date } } }),
  ]);
  const day = dayOfWeek(input.date);
  let schedule: { expectedTimeIn: string; expectedTimeOut: string } | null = null;
  if (employee.employeeType === "STAFF" || employee.employeeType === "FACULTY_WITH_STAFF_WORK") {
    const work = await prisma.workSchedule.findFirst({ where: { employeeId: employee.id, dayOfWeek: day, isActive: true } });
    if (work) schedule = { expectedTimeIn: work.expectedTimeIn, expectedTimeOut: work.expectedTimeOut };
  } else {
    const teaching = await prisma.facultySchedule.findMany({ where: { employeeId: employee.id, dayOfWeek: day, isActive: true }, orderBy: { startTime: "asc" } });
    if (teaching.length) schedule = { expectedTimeIn: teaching[0].startTime, expectedTimeOut: teaching.map((item) => item.endTime).sort().at(-1)! };
  }
  const timeIn = input.timeIn || null; const timeOut = input.timeOut || null;
  const lateMinutes = schedule && timeIn ? getLateMinutes(schedule.expectedTimeIn, timeIn, rules.lateGraceMinutes) : 0;
  const undertimeMinutes = schedule && timeOut ? getUndertimeMinutes(schedule.expectedTimeOut, timeOut) : 0;
  const overtimeMinutes = schedule && timeOut ? getOvertimeMinutes(schedule.expectedTimeOut, timeOut) : 0;
  const computedStatus = computeAttendanceStatus({ timeIn, timeOut, schedule, graceMinutes: rules.lateGraceMinutes, approvedLeave: approvedLeave ? { isPaid: approvedLeave.isPaid } : null });
  const status = input.statusOverride || computedStatus;
  const deduction = computeAttendanceDeduction({ monthlySalary: Number(employee.monthlySalary), workingDaysPerMonth: rules.workingDaysPerMonth, status, lateMinutes, undertimeMinutes, approvedLeave: approvedLeave ? { isPaid: approvedLeave.isPaid } : null, conversionTable: conversions.map((row) => ({ unit: row.unit, value: row.value, equivalentDay: Number(row.equivalentDay) })) });
  return { employee, schedule, approvedLeave, computedStatus, status, isStatusOverridden: Boolean(input.statusOverride), lateMinutes, undertimeMinutes, overtimeMinutes, ...deduction };
}