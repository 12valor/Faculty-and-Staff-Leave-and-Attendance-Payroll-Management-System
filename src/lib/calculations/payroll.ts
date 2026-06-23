import type { DayOfWeek } from "@/generated/prisma/client";
import { getDayOfWeek, inclusiveDates } from "@/lib/dates";

export type PayrollSource = {
  date: string;
  source: "ATTENDANCE" | "LEAVE_WITHOUT_PAY";
  lateMinutes?: number;
  undertimeMinutes?: number;
  absenceDayValue?: number;
  lwopDayValue?: number;
  dayValue: number;
  amountOverride?: number;
};

export function deduplicatePayrollSources(sources: PayrollSource[]) {
  const byDate = new Map<string, PayrollSource>();
  for (const source of sources) {
    const current = byDate.get(source.date);
    if (!current || source.source === "ATTENDANCE") byDate.set(source.date, source);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function describeAttendancePenalty(input: { status: string; lateMinutes: number; undertimeMinutes: number; penaltyUnits: number }) {
  if (input.status === "ABSENT") return "Absence without approved leave";
  if (input.penaltyUnits > 0) return `${input.penaltyUnits} completed 8-hour late penalty unit(s)`;
  if (input.lateMinutes > 0 && input.undertimeMinutes > 0) return "Late and undertime recorded (no deduction)";
  if (input.lateMinutes > 0) return "Late minutes recorded (below 8-hour threshold)";
  return "Undertime recorded (no deduction)";
}

export function getPayrollSourceAmount(source: PayrollSource, dailyRate: number) {
  return Number((source.amountOverride ?? dailyRate * source.dayValue).toFixed(2));
}
export function summarizePayrollSources(monthlySalary: number, workingDaysPerMonth: number, sources: PayrollSource[]) {
  const rows = deduplicatePayrollSources(sources);
  const dailyRate = workingDaysPerMonth > 0 ? monthlySalary / workingDaysPerMonth : 0;
  const totals = rows.reduce((result, row) => ({
    lateMinutes: result.lateMinutes + (row.lateMinutes ?? 0),
    undertimeMinutes: result.undertimeMinutes + (row.undertimeMinutes ?? 0),
    absenceDays: result.absenceDays + (row.absenceDayValue ?? 0),
    lwopDays: result.lwopDays + (row.lwopDayValue ?? 0),
    dayValue: result.dayValue + row.dayValue,
  }), { lateMinutes: 0, undertimeMinutes: 0, absenceDays: 0, lwopDays: 0, dayValue: 0 });
  return {
    rows,
    dailyRate: Number(dailyRate.toFixed(2)),
    ...totals,
    dayValue: Number(totals.dayValue.toFixed(3)),
    amount: Number(rows.reduce((sum, row) => sum + getPayrollSourceAmount(row, dailyRate), 0).toFixed(2)),
  };
}

export function calculateProratedBasicPay(input: {
  monthlySalary: number;
  periodStart: string;
  periodEnd: string;
  serviceStart: string;
  serviceEnd?: string | null;
  scheduledDays: DayOfWeek[];
}) {
  const scheduledDays = new Set<DayOfWeek>(
    input.scheduledDays.length
      ? input.scheduledDays
      : ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  );
  const periodDates = inclusiveDates(input.periodStart, input.periodEnd).filter(
    (date) => scheduledDays.has(getDayOfWeek(date)),
  );
  const eligibleDates = periodDates.filter(
    (date) =>
      date >= input.serviceStart &&
      (!input.serviceEnd || date <= input.serviceEnd),
  );
  const ratio = periodDates.length ? eligibleDates.length / periodDates.length : 0;

  return {
    scheduledDays: periodDates.length,
    eligibleDays: eligibleDates.length,
    ratio,
    amount: Number((input.monthlySalary * ratio).toFixed(2)),
  };
}

export function calculateOvertimePay(input: {
  monthlySalary: number;
  workingDaysPerMonth: number;
  standardWorkHoursPerDay: number;
  overtimeMultiplier: number;
  hours: number;
}) {
  const divisor = input.workingDaysPerMonth * input.standardWorkHoursPerDay;
  const hourlyRate = divisor > 0 ? input.monthlySalary / divisor : 0;
  return {
    hourlyRate: Number(hourlyRate.toFixed(2)),
    amount: Number(
      (hourlyRate * input.overtimeMultiplier * Math.max(0, input.hours)).toFixed(2),
    ),
  };
}

export function calculateOverloadPay(hours: number, hourlyRate: number) {
  return Number((Math.max(0, hours) * Math.max(0, hourlyRate)).toFixed(2));
}

export function calculatePayrollTotals(input: {
  basicPay: number;
  overtimePay: number;
  overloadPay: number;
  deductions: number;
}) {
  const grossPay = Number(
    (input.basicPay + input.overtimePay + input.overloadPay).toFixed(2),
  );
  return {
    grossPay,
    netPay: Number((grossPay - input.deductions).toFixed(2)),
  };
}
