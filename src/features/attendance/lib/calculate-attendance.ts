import "server-only";

import type { AttendanceStatus } from "@/generated/prisma/client";
import { calculateAttendancePenaltyShared, isPast5PM } from "@/lib/calculations/attendance";
import { getPrisma } from "@/lib/prisma";
import { getPayrollRules } from "@/lib/settings/payroll-rules";
import { getEmployeeScheduleForDate } from "@/features/schedules/lib/resolve-schedule";

export function getFacultyScheduledDailyHours(facultySchedules: Array<{ dayOfWeek: string; totalTeachingHours: unknown }>) {
  const dayTotals = new Map<string, number>();
  for (const row of facultySchedules) {
    const hours = Number(row.totalTeachingHours);
    if (!Number.isNaN(hours)) {
      dayTotals.set(row.dayOfWeek, (dayTotals.get(row.dayOfWeek) ?? 0) + hours);
    }
  }
  if (dayTotals.size === 0) return 8;
  const totalHours = [...dayTotals.values()].reduce((sum, h) => sum + h, 0);
  return totalHours / dayTotals.size;
}

export function getPeriodOrMonthRange(date: string) {
  const parts = date.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStr = String(month).padStart(2, "0");
  return {
    startDate: `${year}-${monthStr}-01`,
    endDate: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

export async function calculateAttendance(input: {
  employeeId: string;
  date: string;
  timeIn?: string | null;
  timeOut?: string | null;
  statusOverride?: AttendanceStatus | "";
  overrideReason?: string | null;
}) {
  const prisma = getPrisma();

  // Find the active payroll period containing this date
  const period = await prisma.payrollPeriod.findFirst({
    where: { startDate: { lte: input.date }, endDate: { gte: input.date } }
  });

  const range = period ? { startDate: period.startDate, endDate: period.endDate } : getPeriodOrMonthRange(input.date);

  const [{ employee, schedule }, rules, conversions, leaveAllocation, priorRecords] = await Promise.all([
    getEmployeeScheduleForDate(input.employeeId, input.date),
    getPayrollRules(),
    prisma.cscTimeConversion.findMany(),
    prisma.leaveAllocation.findFirst({
      where: { employeeId: input.employeeId, date: input.date, leaveRecord: { status: "APPROVED" } },
      include: { leaveRecord: true }
    }),
    prisma.attendanceRecord.findMany({
      where: {
        employeeId: input.employeeId,
        date: { gte: range.startDate, lt: input.date }
      }
    })
  ]);

  const activeFacultySchedules = employee.facultySchedules.filter(s =>
    s.isActive &&
    s.effectiveFrom <= range.endDate &&
    (!s.effectiveTo || s.effectiveTo >= range.startDate)
  );
  const activeWorkSchedules = employee.workSchedules.filter(s =>
    s.isActive &&
    s.effectiveFrom <= range.endDate &&
    (!s.effectiveTo || s.effectiveTo >= range.startDate)
  );

  let thresholdHours = 8;
  if (employee.employeeType === "FACULTY") {
    thresholdHours = getFacultyScheduledDailyHours(activeFacultySchedules);
  } else if (employee.employeeType === "FACULTY_WITH_STAFF_WORK") {
    if (activeWorkSchedules.length > 0) {
      thresholdHours = 8;
    } else {
      thresholdHours = getFacultyScheduledDailyHours(activeFacultySchedules);
    }
  }

  const priorLateMinutes = priorRecords.reduce((sum, r) => sum + r.lateMinutes, 0);

  const timeIn = input.timeIn || null;
  const timeOut = input.timeOut || null;

  const approvedLeave = leaveAllocation ? { isPaid: Number(leaveAllocation.unpaidDayValue) === 0, unpaidDayValue: Number(leaveAllocation.unpaidDayValue) } : null;

  const conversionTable = conversions.map((row) => ({ unit: row.unit, value: row.value, equivalentDay: Number(row.equivalentDay) }));

  const penalty = calculateAttendancePenaltyShared({
    employeeType: employee.employeeType,
    monthlySalary: Number(employee.monthlySalary),
    workingDaysPerMonth: rules.workingDaysPerMonth,
    timeIn,
    timeOut,
    statusOverride: input.statusOverride || null,
    schedule,
    priorLateMinutes,
    scheduledDailyHours: thresholdHours,
    conversionTable,
    approvedLeave,
    isCurrentDayPast5PM: isPast5PM(input.date),
    absencePenaltyAmount: rules.absencePenaltyAmount,
  });

  return {
    employee,
    schedule,
    approvedLeave: leaveAllocation?.leaveRecord ?? null,
    computedStatus: penalty.computedStatus,
    status: penalty.status,
    isStatusOverridden: Boolean(input.statusOverride),
    lateMinutes: penalty.lateMinutes,
    undertimeMinutes: penalty.undertimeMinutes,
    overtimeMinutes: penalty.overtimeMinutes,
    renderedMinutes: penalty.renderedMinutes,
    deductionDayValue: penalty.deductionDayValue,
    deductionAmount: penalty.deductionAmount,
    overtimeOverloadLabel: penalty.overtimeOverloadLabel,
  };
}
