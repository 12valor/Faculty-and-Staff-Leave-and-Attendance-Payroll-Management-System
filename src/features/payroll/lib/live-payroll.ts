import "server-only";

import type { DayOfWeek } from "@/generated/prisma/client";
import {
  calculateOverloadPay,
  calculateOvertimePay,
  calculatePayrollTotals,
  calculateProratedBasicPay,
  describeAttendancePenalty,
  getPayrollSourceAmount,
  summarizePayrollSources,
  type PayrollSource,
} from "@/lib/calculations/payroll";
import { getPrisma } from "@/lib/prisma";
import { getPayrollRules } from "@/lib/settings/payroll-rules";
import { resolveScheduleForDateFromAllRows } from "@/features/schedules/lib/resolve-schedule";

export type LivePayrollResult = {
  mode: "automatic" | "manual";
  employee: {
    id: string;
    employeeNumber: string;
    fullName: string;
    employeeType: string;
    department: string;
    position: string;
    employmentStatus: string;
    monthlySalary: number;
  };
  period: { startDate: string; endDate: string; label: string };
  availability: {
    attendanceRecords: number;
    leaveAllocations: number;
    overtimeRecords: number;
    overloadRecords: number;
  };
  proration: { scheduledDays: number; eligibleDays: number; ratio: number };
  earnings: {
    basicPay: number;
    overtimePay: number;
    overloadPay: number;
    grossPay: number;
  };
  deductions: {
    totalLateMinutes: number;
    totalUndertimeMinutes: number;
    absenceDays: number;
    lwopDays: number;
    dayValue: number;
    total: number;
  };
  netPay: number;
  deductionRows: Array<{
    date: string;
    source: string;
    description: string;
    lateMinutes: number;
    undertimeMinutes: number;
    absenceDayValue: number;
    lwopDayValue: number;
    dayValue: number;
    amount: number;
  }>;
  overtimeRows: Array<{
    date: string;
    hours: number;
    hourlyRate: number;
    multiplier: number;
    amount: number;
  }>;
  overloadRows: Array<{
    weekStart: string;
    weekEnd: string;
    hours: number;
    hourlyRate: number;
    amount: number;
  }>;
};

export async function buildLivePayroll(
  employeeId: string,
  period: { startDate: string; endDate: string; label: string },
  options: { mode?: "automatic" | "manual" } = {},
): Promise<LivePayrollResult | null> {
  const mode = options.mode ?? "automatic";
  const [rules, employee] = await Promise.all([
    getPayrollRules(),
    getPrisma().employee.findFirst({
      where: {
        id: employeeId,
        ...(mode === "manual"
          ? { employmentStatus: "ACTIVE" as const }
          : {
              employmentStatus: { not: "ARCHIVED" as const },
              serviceStartDate: { lte: period.endDate },
              OR: [
                { serviceEndDate: null },
                { serviceEndDate: { gte: period.startDate } },
              ],
            }),
      },
      include: {
        department: true,
        position: true,
        workSchedules: { where: { isActive: true } },
        facultySchedules: { where: { isActive: true } },
        attendanceRecords: {
          where: { date: { gte: period.startDate, lte: period.endDate } },
          orderBy: { date: "asc" },
        },
        leaveAllocations: {
          where: {
            date: { gte: period.startDate, lte: period.endDate },
            leaveRecord: { status: "APPROVED" },
          },
          orderBy: { date: "asc" },
        },
        overtimeRecords: {
          where: {
            status: "APPROVED",
            date: { gte: period.startDate, lte: period.endDate },
          },
          orderBy: { date: "asc" },
        },
        overloadRecords: {
          where: {
            status: "APPROVED",
            weekStart: { gte: period.startDate, lte: period.endDate },
          },
          orderBy: { weekStart: "asc" },
        },
      },
    }),
  ]);

  if (!employee) return null;
  if (rules.facultyOverloadHourlyRate === null) {
    throw new Error("FACULTY_OVERLOAD_RATE_REQUIRED");
  }

  const scheduledDays = new Set<DayOfWeek>([
    ...employee.workSchedules.map((row) => row.dayOfWeek),
    ...employee.facultySchedules.map((row) => row.dayOfWeek),
  ]);
  const proration = calculateProratedBasicPay({
    monthlySalary: Number(employee.monthlySalary),
    periodStart: period.startDate,
    periodEnd: period.endDate,
    serviceStart: employee.serviceStartDate,
    serviceEnd: employee.serviceEndDate,
    scheduledDays: [...scheduledDays],
  });

  const allocations = new Map(
    employee.leaveAllocations.map((row) => [
      `${row.employeeId}:${row.date}`,
      row,
    ]),
  );
  const attendanceDates = new Set(
    employee.attendanceRecords.map((row) => row.date),
  );
  const sources: Array<PayrollSource & { description: string }> = [];

    for (const record of employee.attendanceRecords) {
    if (record.status === "NO_SCHEDULE") continue;
    if (record.status === "ABSENT" && !resolveScheduleForDateFromAllRows(employee.employeeType, record.date, employee.workSchedules, employee.facultySchedules)) continue;
    const allocation = allocations.get(`${employee.id}:${record.date}`);
    if (allocation) {
      const unpaid = Number(allocation.unpaidDayValue);
      if (unpaid > 0) {
        sources.push({
          date: record.date,
          source: "ATTENDANCE",
          lateMinutes: 0,
          undertimeMinutes: 0,
          lwopDayValue: unpaid,
          dayValue: unpaid,
          description: "Approved unpaid leave",
        });
      }
      continue;
    }

    const dayValue =
      record.status === "ABSENT" ? 1 : Number(record.deductionDayValue);
    if (dayValue <= 0 && record.lateMinutes <= 0 && record.undertimeMinutes <= 0) continue;
    sources.push({
      date: record.date,
      source: "ATTENDANCE",
      lateMinutes: record.lateMinutes,
      undertimeMinutes: record.undertimeMinutes,
      absenceDayValue: record.status === "ABSENT" ? 1 : 0,
      dayValue,
      amountOverride: Number(record.deductionAmount),
      description: describeAttendancePenalty({
        status: record.status,
        lateMinutes: record.lateMinutes,
        undertimeMinutes: record.undertimeMinutes,
        penaltyUnits: dayValue,
      }),
    });
  }

  for (const allocation of employee.leaveAllocations) {
    const unpaid = Number(allocation.unpaidDayValue);
    if (unpaid <= 0 || attendanceDates.has(allocation.date)) continue;
    sources.push({
      date: allocation.date,
      source: "LEAVE_WITHOUT_PAY",
      lwopDayValue: unpaid,
      dayValue: unpaid,
      description: "Approved unpaid leave without attendance entry",
    });
  }

  const deductionSummary = summarizePayrollSources(
    Number(employee.monthlySalary),
    rules.workingDaysPerMonth,
    sources,
  );
  const sourceByKey = new Map(
    sources.map((source) => [`${source.date}:${source.source}`, source]),
  );
  const overtimeRows = employee.overtimeRecords.map((record) => {
    const calculated = calculateOvertimePay({
      monthlySalary: Number(employee.monthlySalary),
      workingDaysPerMonth: rules.workingDaysPerMonth,
      standardWorkHoursPerDay: rules.standardWorkHoursPerDay,
      overtimeMultiplier: rules.overtimeMultiplier,
      hours: Number(record.hours),
    });
    return {
      date: record.date,
      hours: Number(record.hours),
      hourlyRate: calculated.hourlyRate,
      multiplier: rules.overtimeMultiplier,
      amount: Number(record.amount) > 0 ? Number(record.amount) : calculated.amount,
    };
  });
  const overloadRows = employee.overloadRecords.map((record) => ({
    weekStart: record.weekStart,
    weekEnd: record.weekEnd,
    hours: Number(record.overloadHours),
    hourlyRate: rules.facultyOverloadHourlyRate!,
    amount:
      Number(record.amount) > 0
        ? Number(record.amount)
        : calculateOverloadPay(
            Number(record.overloadHours),
            rules.facultyOverloadHourlyRate!,
          ),
  }));
  const overtimePay = overtimeRows.reduce((sum, row) => sum + row.amount, 0);
  const overloadPay = overloadRows.reduce((sum, row) => sum + row.amount, 0);
  const totals = calculatePayrollTotals({
    basicPay: proration.amount,
    overtimePay,
    overloadPay,
    deductions: deductionSummary.amount,
  });

  return {
    mode,
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      fullName: [
        employee.firstName,
        employee.middleName,
        employee.lastName,
        employee.suffix,
      ]
        .filter(Boolean)
        .join(" "),
      employeeType: employee.employeeType,
      department: employee.department.name,
      position: employee.position.name,
      employmentStatus: employee.employmentStatus,
      monthlySalary: Number(employee.monthlySalary),
    },
    period,
    availability: {
      attendanceRecords: employee.attendanceRecords.length,
      leaveAllocations: employee.leaveAllocations.length,
      overtimeRecords: employee.overtimeRecords.length,
      overloadRecords: employee.overloadRecords.length,
    },
    proration: {
      scheduledDays: proration.scheduledDays,
      eligibleDays: proration.eligibleDays,
      ratio: proration.ratio,
    },
    earnings: {
      basicPay: proration.amount,
      overtimePay: Number(overtimePay.toFixed(2)),
      overloadPay: Number(overloadPay.toFixed(2)),
      grossPay: totals.grossPay,
    },
    deductions: {
      totalLateMinutes: deductionSummary.lateMinutes,
      totalUndertimeMinutes: deductionSummary.undertimeMinutes,
      absenceDays: deductionSummary.absenceDays,
      lwopDays: deductionSummary.lwopDays,
      dayValue: deductionSummary.dayValue,
      total: deductionSummary.amount,
    },
    netPay: totals.netPay,
    deductionRows: deductionSummary.rows.map((row) => {
      const source = sourceByKey.get(`${row.date}:${row.source}`)!;
      return {
        date: row.date,
        source: row.source,
        description: source.description,
        lateMinutes: row.lateMinutes ?? 0,
        undertimeMinutes: row.undertimeMinutes ?? 0,
        absenceDayValue: row.absenceDayValue ?? 0,
        lwopDayValue: row.lwopDayValue ?? 0,
        dayValue: row.dayValue,
        amount: getPayrollSourceAmount(row, deductionSummary.dailyRate),
      };
    }),
    overtimeRows,
    overloadRows,
  };
}
