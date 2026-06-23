import "server-only";

import type { AttendanceStatus } from "@/generated/prisma/client";
import { computeAttendanceDeduction, computeAttendanceStatus, getLateMinutes, getOvertimeMinutes, getRenderedMinutes } from "@/lib/calculations/attendance";
import { getPrisma } from "@/lib/prisma";
import { getPayrollRules } from "@/lib/settings/payroll-rules";
import { getEmployeeScheduleForDate } from "@/features/schedules/lib/resolve-schedule";

export async function calculateAttendance(input: { employeeId: string; date: string; timeIn?: string | null; timeOut?: string | null; statusOverride?: AttendanceStatus | ""; overrideReason?: string | null }) {
  const prisma = getPrisma();
  const [{ employee, schedule }, rules, conversions, leaveAllocation] = await Promise.all([
    getEmployeeScheduleForDate(input.employeeId, input.date),
    getPayrollRules(),
    prisma.cscTimeConversion.findMany(),
    prisma.leaveAllocation.findFirst({ where: { employeeId: input.employeeId, date: input.date, leaveRecord: { status: "APPROVED" } }, include: { leaveRecord: true } }),
  ]);
  const timeIn = input.timeIn || null; const timeOut = input.timeOut || null;
  const renderedMinutes = getRenderedMinutes(timeIn, timeOut);
  const lateMinutes = schedule && timeIn ? getLateMinutes(schedule.expectedTimeIn || "08:00", timeIn, 15) : 0;
  const undertimeMinutes = renderedMinutes > 0 ? Math.max(0, 360 - renderedMinutes) : 0;
  const overtimeMinutes = schedule && timeOut ? getOvertimeMinutes(schedule.expectedTimeOut, timeOut) : 0;
  const approvedLeave = leaveAllocation ? { isPaid: Number(leaveAllocation.unpaidDayValue) === 0, unpaidDayValue: Number(leaveAllocation.unpaidDayValue) } : null;
  const computedStatus = computeAttendanceStatus({ timeIn, timeOut, schedule, graceMinutes: 15, approvedLeave });
  const status = input.statusOverride || computedStatus;
  const deduction = computeAttendanceDeduction({ monthlySalary: Number(employee.monthlySalary), workingDaysPerMonth: rules.workingDaysPerMonth, status, lateMinutes, undertimeMinutes, approvedLeave, conversionTable: conversions.map((row) => ({ unit: row.unit, value: row.value, equivalentDay: Number(row.equivalentDay) })) });
  return { employee, schedule, approvedLeave: leaveAllocation?.leaveRecord ?? null, computedStatus, status, isStatusOverridden: Boolean(input.statusOverride), lateMinutes, undertimeMinutes, overtimeMinutes, renderedMinutes, ...deduction };
}
