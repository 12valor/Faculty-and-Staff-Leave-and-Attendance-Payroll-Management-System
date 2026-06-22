import test from "node:test";
import assert from "node:assert/strict";
import { computeAttendanceDeduction, computeAttendanceStatus, convertMinutesToDayValue, getLateMinutes, getOvertimeMinutes, getUndertimeMinutes } from "../src/lib/calculations/attendance";

const table = [
  ...Array.from({ length: 8 }, (_, index) => ({ unit: "HOUR" as const, value: index + 1, equivalentDay: Number(((index + 1) / 8).toFixed(3)) })),
  { unit: "MINUTE" as const, value: 30, equivalentDay: 0.062 },
];

test("attendance minute calculations", () => {
  assert.equal(getLateMinutes("08:00", "08:30", 0), 30);
  assert.equal(getLateMinutes("08:00", "08:10", 10), 0);
  assert.equal(getUndertimeMinutes("17:00", "16:30"), 30);
  assert.equal(getOvertimeMinutes("17:00", "18:00"), 60);
});

test("CSC conversion examples", () => {
  assert.equal(convertMinutesToDayValue(30, table), 0.062);
  assert.equal(convertMinutesToDayValue(60, table), 0.125);
  assert.equal(convertMinutesToDayValue(90, table), 0.187);
  assert.equal(convertMinutesToDayValue(480, table), 1);
});

test("status precedence and deductions", () => {
  assert.equal(computeAttendanceStatus({ timeIn: "08:30", timeOut: "16:30", schedule: { expectedTimeIn: "08:00", expectedTimeOut: "17:00" }, graceMinutes: 0 }), "LATE");
  assert.equal(computeAttendanceStatus({ timeIn: null, timeOut: null, schedule: null, graceMinutes: 0, approvedLeave: { isPaid: true } }), "ON_LEAVE");
  assert.deepEqual(computeAttendanceDeduction({ monthlySalary: 22000, workingDaysPerMonth: 22, status: "ABSENT", lateMinutes: 0, undertimeMinutes: 0, conversionTable: table }), { deductionDayValue: 1, deductionAmount: 1000 });
  assert.deepEqual(computeAttendanceDeduction({ monthlySalary: 22000, workingDaysPerMonth: 22, status: "ON_LEAVE", lateMinutes: 0, undertimeMinutes: 0, approvedLeave: { isPaid: true }, conversionTable: table }), { deductionDayValue: 0, deductionAmount: 0 });
});