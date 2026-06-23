import test from "node:test";
import assert from "node:assert/strict";
import {
  computeAttendanceDeduction,
  computeAttendanceStatus,
  convertMinutesToDayValue,
  getLateMinutes,
  getOvertimeMinutes,
  getRenderedMinutes,
  getUndertimeMinutes,
  calculateAttendancePenaltyShared
} from "../src/lib/calculations/attendance";

const table = [
  ...Array.from({ length: 8 }, (_, index) => ({ unit: "HOUR" as const, value: index + 1, equivalentDay: Number(((index + 1) / 8).toFixed(3)) })),
  { unit: "MINUTE" as const, value: 30, equivalentDay: 0.062 },
  { unit: "MINUTE" as const, value: 15, equivalentDay: 0.031 },
  { unit: "MINUTE" as const, value: 60, equivalentDay: 0.125 },
];
const schedule = { expectedTimeIn: "08:00", expectedTimeOut: "17:00" };

test("attendance minute calculations", () => {
  assert.equal(getLateMinutes("08:00", "08:15", 15), 0);
  assert.equal(getLateMinutes("08:00", "08:16", 15), 1);
  assert.equal(getLateMinutes("08:00", "09:15", 15), 60);
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
  assert.deepEqual(computeAttendanceDeduction({ monthlySalary: 22000, workingDaysPerMonth: 22, status: "ABSENT", lateMinutes: 0, undertimeMinutes: 0, conversionTable: table }), { deductionDayValue: 1, deductionAmount: 500 });
  assert.deepEqual(computeAttendanceDeduction({ monthlySalary: 22000, workingDaysPerMonth: 22, status: "NO_SCHEDULE", lateMinutes: 0, undertimeMinutes: 0, conversionTable: table }), { deductionDayValue: 0, deductionAmount: 0 });
  assert.deepEqual(computeAttendanceDeduction({ monthlySalary: 22000, workingDaysPerMonth: 22, status: "ON_LEAVE", lateMinutes: 0, undertimeMinutes: 0, approvedLeave: { isPaid: true }, conversionTable: table }), { deductionDayValue: 0, deductionAmount: 0 });
});

test("fixed absence and cumulative late threshold deductions", () => {
  const base = {
    employeeType: "STAFF",
    monthlySalary: 44_000,
    workingDaysPerMonth: 22,
    timeOut: "17:00",
    statusOverride: null,
    schedule: { expectedTimeIn: "08:00", expectedTimeOut: "17:00" },
    scheduledDailyHours: 8,
    conversionTable: table,
    isCurrentDayPast5PM: false,
    absencePenaltyAmount: 500,
  };

  const belowThreshold = calculateAttendancePenaltyShared({ ...base, timeIn: "12:42", priorLateMinutes: 0 });
  assert.equal(belowThreshold.lateMinutes, 267);
  assert.equal(belowThreshold.deductionDayValue, 0);
  assert.equal(belowThreshold.deductionAmount, 0);

  const firstThreshold = calculateAttendancePenaltyShared({ ...base, timeIn: "08:16", priorLateMinutes: 479 });
  assert.equal(firstThreshold.accumulatedLateMinutes, 480);
  assert.equal(firstThreshold.deductionDayValue, 1);
  assert.equal(firstThreshold.deductionAmount, 500);

  const secondThreshold = calculateAttendancePenaltyShared({ ...base, timeIn: "08:16", priorLateMinutes: 959 });
  assert.equal(secondThreshold.accumulatedLateMinutes, 960);
  assert.equal(secondThreshold.deductionDayValue, 1);
  assert.equal(secondThreshold.deductionAmount, 500);

  const undertimeOnly = calculateAttendancePenaltyShared({ ...base, timeIn: "08:00", timeOut: "13:00", priorLateMinutes: 0 });
  assert.equal(undertimeOnly.undertimeMinutes, 60);
  assert.equal(undertimeOnly.deductionAmount, 0);

  const absence = calculateAttendancePenaltyShared({ ...base, timeIn: null, timeOut: null, priorLateMinutes: 0 });
  assert.equal(absence.status, "ABSENT");
  assert.equal(absence.deductionDayValue, 1);
  assert.equal(absence.deductionAmount, 500);
});
test("pending and final overtime/overload triggers", () => {
  // Employee timed in but no timeout after 5:00 PM = pending overtime/overload.
  const pendingStaff = calculateAttendancePenaltyShared({
    employeeType: "STAFF",
    monthlySalary: 22000,
    workingDaysPerMonth: 22,
    timeIn: "08:00",
    timeOut: null,
    statusOverride: null,
    schedule: { expectedTimeIn: "08:00", expectedTimeOut: "17:00" },
    priorLateMinutes: 0,
    scheduledDailyHours: 8,
    conversionTable: table,
    isCurrentDayPast5PM: true
  });
  assert.equal(pendingStaff.overtimeOverloadLabel, "Pending Overtime");

  const pendingFaculty = calculateAttendancePenaltyShared({
    employeeType: "FACULTY",
    monthlySalary: 22000,
    workingDaysPerMonth: 22,
    timeIn: "08:00",
    timeOut: null,
    statusOverride: null,
    schedule: { expectedTimeIn: "08:00", expectedTimeOut: "12:00" },
    priorLateMinutes: 0,
    scheduledDailyHours: 8,
    conversionTable: table,
    isCurrentDayPast5PM: true
  });
  assert.equal(pendingFaculty.overtimeOverloadLabel, "Pending Overload");

  // Employee later gets time out encoded = pending status becomes final calculated overtime/overload.
  const finalStaff = calculateAttendancePenaltyShared({
    employeeType: "STAFF",
    monthlySalary: 22000,
    workingDaysPerMonth: 22,
    timeIn: "08:00",
    timeOut: "18:30", // 1h 30m overtime
    statusOverride: null,
    schedule: { expectedTimeIn: "08:00", expectedTimeOut: "17:00" },
    priorLateMinutes: 0,
    scheduledDailyHours: 8,
    conversionTable: table,
    isCurrentDayPast5PM: true
  });
  assert.equal(finalStaff.overtimeMinutes, 90);
  assert.equal(finalStaff.overtimeOverloadLabel, "1h 30m Overtime");
});
