import "server-only";

import { calculateAttendancePenaltyShared, isPast5PM } from "@/lib/calculations/attendance";
import { getPrisma } from "@/lib/prisma";
import { getPayrollRules } from "@/lib/settings/payroll-rules";
import { resolveScheduleForDateFromAllRows } from "@/features/schedules/lib/resolve-schedule";
import { getFacultyScheduledDailyHours } from "./calculate-attendance";

export async function recalculateEmployeeAttendanceForPeriod(employeeId: string, startDate: string, endDate: string) {
  const prisma = getPrisma();

  // Load employee with their active schedules
  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    include: { workSchedules: true, facultySchedules: true }
  });

  // Filter schedules that overlap with the payroll period range
  const activeFacultySchedules = employee.facultySchedules.filter(s =>
    s.isActive &&
    s.effectiveFrom <= endDate &&
    (!s.effectiveTo || s.effectiveTo >= startDate)
  );
  const activeWorkSchedules = employee.workSchedules.filter(s =>
    s.isActive &&
    s.effectiveFrom <= endDate &&
    (!s.effectiveTo || s.effectiveTo >= startDate)
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

  const [rules, conversions, leaveAllocations, attendanceRecords] = await Promise.all([
    getPayrollRules(),
    prisma.cscTimeConversion.findMany(),
    prisma.leaveAllocation.findMany({
      where: { employeeId, date: { gte: startDate, lte: endDate }, leaveRecord: { status: "APPROVED" } },
      include: { leaveRecord: true }
    }),
    prisma.attendanceRecord.findMany({
      where: { employeeId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: "asc" }
    })
  ]);

  const leaveMap = new Map(leaveAllocations.map(la => [la.date, la]));
  const conversionTable = conversions.map(row => ({ unit: row.unit, value: row.value, equivalentDay: Number(row.equivalentDay) }));

  let priorLateMinutes = 0;

  for (const record of attendanceRecords) {
    const schedule = resolveScheduleForDateFromAllRows(employee.employeeType, record.date, employee.workSchedules, employee.facultySchedules);
    const leaveAllocation = leaveMap.get(record.date);
    const approvedLeave = leaveAllocation ? { isPaid: Number(leaveAllocation.unpaidDayValue) === 0, unpaidDayValue: Number(leaveAllocation.unpaidDayValue) } : null;

    const penalty = calculateAttendancePenaltyShared({
      employeeType: employee.employeeType,
      monthlySalary: Number(employee.monthlySalary),
      workingDaysPerMonth: rules.workingDaysPerMonth,
      timeIn: record.timeIn,
      timeOut: record.timeOut,
      statusOverride: record.isStatusOverridden ? record.status : null,
      schedule,
      priorLateMinutes,
      scheduledDailyHours: thresholdHours,
      conversionTable,
      approvedLeave,
      isCurrentDayPast5PM: isPast5PM(record.date),
    absencePenaltyAmount: rules.absencePenaltyAmount,
    });

    // Update database
    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        computedStatus: penalty.computedStatus,
        status: penalty.status,
        lateMinutes: penalty.lateMinutes,
        undertimeMinutes: penalty.undertimeMinutes,
        overtimeMinutes: penalty.overtimeMinutes,
        renderedMinutes: penalty.renderedMinutes,
        deductionDayValue: penalty.deductionDayValue,
        deductionAmount: penalty.deductionAmount,
      }
    });

    // Accumulate late minutes sequentially
    priorLateMinutes += penalty.lateMinutes;
  }
}
