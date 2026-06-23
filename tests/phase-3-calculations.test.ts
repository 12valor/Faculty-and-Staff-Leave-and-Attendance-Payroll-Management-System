import assert from "node:assert/strict";
import test from "node:test";

import { computeMonthlyLeaveCredit, getServiceDaysForMonth, reverseLeaveDebit, splitPaidAndUnpaidDays } from "../src/lib/calculations/leave";
import { computeWeeklyOverload, overtimeMinutesToHours } from "../src/lib/calculations/overtime-overload";
import { calculateOverloadPay, calculateOvertimePay, calculatePayrollTotals, calculateProratedBasicPay, deduplicatePayrollSources, summarizePayrollSources } from "../src/lib/calculations/payroll";

test("leave split keeps the latest dates unpaid", () => {
  const result = splitPaidAndUnpaidDays([{ date: "2026-06-01", dayValue: 1 }, { date: "2026-06-02", dayValue: 1 }, { date: "2026-06-03", dayValue: 0.5 }], 1.5);
  assert.deepEqual(result.map((row) => [row.paidDayValue, row.unpaidDayValue]), [[1, 0], [0.5, 0.5], [0, 0.5]]);
  assert.equal(reverseLeaveDebit(0, 1.5), 1.5);
});

test("CSC credits support full, partial, and half-day interpolation", () => {
  const dailyRows = Array.from({ length: 30 }, (_, index) => ({ numberOfDays: index + 1, vacationLeaveEarned: Number(((index + 1) / 24).toFixed(3)), sickLeaveEarned: Number(((index + 1) / 24).toFixed(3)) }));
  const monthlyCredit = { vacationLeaveEarned: 1.25, sickLeaveEarned: 1.25 };
  assert.deepEqual(computeMonthlyLeaveCredit({ serviceDays: 30, lwopDays: 0, monthlyCredit, dailyRows, lwopRows: [] }), { vacation: 1.25, sick: 1.25 });
  assert.equal(computeMonthlyLeaveCredit({ serviceDays: 10.5, lwopDays: 0, monthlyCredit, dailyRows, lwopRows: [] }).vacation, 0.438);
  assert.equal(getServiceDaysForMonth("2026-06-01", null, 2026, 6), 30);
  assert.equal(getServiceDaysForMonth("2026-06-16", null, 2026, 6), 15);
});

test("payroll sources deduplicate employee dates", () => {
  const sources = deduplicatePayrollSources([{ date: "2026-06-01", source: "LEAVE_WITHOUT_PAY", dayValue: 1, lwopDayValue: 1 }, { date: "2026-06-01", source: "ATTENDANCE", dayValue: 1, absenceDayValue: 1 }]);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].source, "ATTENDANCE");
  const summary = summarizePayrollSources(22_000, 22, sources);
  assert.equal(summary.amount, 1000);
});

test("basic pay uses schedule days and prorates partial service", () => {
  const fullMonth = calculateProratedBasicPay({ monthlySalary: 22_000, periodStart: "2026-06-01", periodEnd: "2026-06-30", serviceStart: "2020-01-01", scheduledDays: ["MONDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] });
  assert.equal(fullMonth.scheduledDays, 22);
  assert.equal(fullMonth.eligibleDays, 22);
  assert.equal(fullMonth.amount, 22_000);

  const partialMonth = calculateProratedBasicPay({ monthlySalary: 22_000, periodStart: "2026-06-01", periodEnd: "2026-06-30", serviceStart: "2026-06-16", scheduledDays: [] });
  assert.equal(partialMonth.scheduledDays, 22);
  assert.equal(partialMonth.eligibleDays, 11);
  assert.equal(partialMonth.amount, 11_000);

  const endingMidMonth = calculateProratedBasicPay({ monthlySalary: 22_000, periodStart: "2026-06-01", periodEnd: "2026-06-30", serviceStart: "2020-01-01", serviceEnd: "2026-06-15", scheduledDays: [] });
  assert.equal(endingMidMonth.eligibleDays, 11);
  assert.equal(endingMidMonth.amount, 11_000);
});

test("automatic payroll adds approved extra pay and subtracts deductions", () => {
  const overtime = calculateOvertimePay({ monthlySalary: 22_000, workingDaysPerMonth: 22, standardWorkHoursPerDay: 8, overtimeMultiplier: 1.25, hours: 2 });
  assert.equal(overtime.hourlyRate, 125);
  assert.equal(overtime.amount, 312.5);
  assert.equal(calculateOverloadPay(3.5, 100), 350);
  assert.deepEqual(calculatePayrollTotals({ basicPay: 22_000, overtimePay: 312.5, overloadPay: 350, deductions: 1_000 }), { grossPay: 22_662.5, netPay: 21_662.5 });
  assert.deepEqual(calculatePayrollTotals({ basicPay: 22_000, overtimePay: 0, overloadPay: 0, deductions: 0 }), { grossPay: 22_000, netPay: 22_000 });
});

test("overtime and overload calculations are stable", () => {
  assert.equal(overtimeMinutesToHours(90), 1.5);
  assert.equal(computeWeeklyOverload(21.5, 18), 3.5);
  assert.equal(computeWeeklyOverload(16, 18), 0);
});
