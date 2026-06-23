import test from "node:test";
import assert from "node:assert/strict";
import { computeAttendanceDeduction, computeAttendanceStatus, convertMinutesToDayValue, getLateMinutes, getOvertimeMinutes, getRenderedMinutes, getUndertimeMinutes } from "../src/lib/calculations/attendance";

const table = [
  ...Array.from({ length: 8 }, (_, index) => ({ unit: "HOUR" as const, value: index + 1, equivalentDay: Number(((index + 1) / 8).toFixed(3)) })),
  { unit: "MINUTE" as const, value: 30, equivalentDay: 0.062 },
];
const schedule = { expectedTimeIn: "08:00", expectedTimeOut: "17:00" };

test("attendance minute calculations", () => {
  assert.equal(getLateMinutes("08:00", "08:15", 15), 0);
  assert.equal(getLateMinutes("08:00", "08:16", 15), 1);
  assert.equal(getUndertimeMinutes("17:00", "16:30"), 30);
  assert.equal(getOvertimeMinutes("17:00", "18:00"), 60);
  assert.equal(getRenderedMinutes("08:00", "13:00"), 300);
  assert.equal(getRenderedMinutes("08:00", "14:00"), 360);
});

test("fixed attendance status precedence", () => {
  assert.equal(computeAttendanceStatus({ timeIn: null, timeOut: null, schedule: null, graceMinutes: 15 }), "NO_SCHEDULE");
  assert.equal(computeAttendanceStatus({ timeIn: null, timeOut: null, schedule, graceMinutes: 15 }), "ABSENT");
  assert.equal(computeAttendanceStatus({ timeIn: "08:00", timeOut: null, schedule, graceMinutes: 15 }), "INCOMPLETE");
  assert.equal(computeAttendanceStatus({ timeIn: "08:00", timeOut: "13:00", schedule, graceMinutes: 15 }), "UNDERTIME");
  assert.equal(computeAttendanceStatus({ timeIn: "08:16", timeOut: "13:00", schedule, graceMinutes: 15 }), "LATE_UNDERTIME");
  assert.equal(computeAttendanceStatus({ timeIn: "08:16", timeOut: "14:16", schedule, graceMinutes: 15 }), "LATE");
  assert.equal(computeAttendanceStatus({ timeIn: "08:15", timeOut: "14:15", schedule, graceMinutes: 15 }), "PRESENT");
  assert.equal(computeAttendanceStatus({ timeIn: null, timeOut: null, schedule, graceMinutes: 15, approvedLeave: { isPaid: true } }), "ON_LEAVE");
});

test("CSC conversion examples and deductions", () => {
  assert.equal(convertMinutesToDayValue(30, table), 0.062);
  assert.equal(convertMinutesToDayValue(60, table), 0.125);
  assert.equal(convertMinutesToDayValue(90, table), 0.187);
  assert.equal(convertMinutesToDayValue(480, table), 1);
  assert.deepEqual(computeAttendanceDeduction({ monthlySalary: 22000, workingDaysPerMonth: 22, status: "ABSENT", lateMinutes: 0, undertimeMinutes: 0, conversionTable: table }), { deductionDayValue: 1, deductionAmount: 1000 });
  assert.deepEqual(computeAttendanceDeduction({ monthlySalary: 22000, workingDaysPerMonth: 22, status: "NO_SCHEDULE", lateMinutes: 0, undertimeMinutes: 0, conversionTable: table }), { deductionDayValue: 0, deductionAmount: 0 });
  assert.deepEqual(computeAttendanceDeduction({ monthlySalary: 22000, workingDaysPerMonth: 22, status: "ON_LEAVE", lateMinutes: 0, undertimeMinutes: 0, approvedLeave: { isPaid: true }, conversionTable: table }), { deductionDayValue: 0, deductionAmount: 0 });
});
