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
  assert.deepEqual(computeAttendanceDeduction({ monthlySalary: 22000, workingDaysPerMonth: 22, status: "ABSENT", lateMinutes: 0, undertimeMinutes: 0, conversionTable: table }), { deductionDayValue: 1, deductionAmount: 1000 });
  assert.deepEqual(computeAttendanceDeduction({ monthlySalary: 22000, workingDaysPerMonth: 22, status: "NO_SCHEDULE", lateMinutes: 0, undertimeMinutes: 0, conversionTable: table }), { deductionDayValue: 0, deductionAmount: 0 });
  assert.deepEqual(computeAttendanceDeduction({ monthlySalary: 22000, workingDaysPerMonth: 22, status: "ON_LEAVE", lateMinutes: 0, undertimeMinutes: 0, approvedLeave: { isPaid: true }, conversionTable: table }), { deductionDayValue: 0, deductionAmount: 0 });
});

test("cumulative late minutes and threshold deductions", () => {
  // Faculty with 8-hour (480 minutes) scheduled day and 480 accumulated late minutes = 1 day deduction.
  const penalty8hr = calculateAttendancePenaltyShared({
    employeeType: "FACULTY",
    monthlySalary: 22000,
    workingDaysPerMonth: 22,
    timeIn: "09:15", // 60 minutes late
    timeOut: "17:00",
    statusOverride: null,
    schedule: { expectedTimeIn: "08:00", expectedTimeOut: "16:00" },
    priorLateMinutes: 420, // 420 + 60 = 480 accumulated late minutes
    scheduledDailyHours: 8,
    conversionTable: table,
    isCurrentDayPast5PM: false
  });
  // Accumulated late minutes reaches 480 (8 hours), which scaled is 480 minutes -> equivalentDay should be 1.0.
  // The cumulative day value for 480 minutes is 1.0.
  // The cumulative day value for prior 420 minutes is 420/480 = 0.875.
  // So marginal deduction for this day is 1.0 - 0.875 = 0.125 days.
  assert.equal(penalty8hr.accumulatedLateMinutes, 480);
  assert.equal(penalty8hr.deductionDayValue, 0.125); // 1.0 - 0.875 = 0.125

  // Faculty with 6-hour (360 minutes) scheduled day and 360 accumulated late minutes = 1 day deduction.
  const penalty6hr = calculateAttendancePenaltyShared({
    employeeType: "FACULTY",
    monthlySalary: 22000,
    workingDaysPerMonth: 22,
    timeIn: "09:15", // 60 minutes late
    timeOut: "17:00",
    statusOverride: null,
    schedule: { expectedTimeIn: "08:00", expectedTimeOut: "14:00" },
    priorLateMinutes: 300, // 300 + 60 = 360 accumulated late minutes
    scheduledDailyHours: 6,
    conversionTable: table,
    isCurrentDayPast5PM: false
  });
  // Accumulated late minutes reaches 360 (6 hours threshold), which scaled is 360 * 480 / 360 = 480 minutes -> 1.0 day deduction.
  // Prior 300 minutes scaled is 300 * 480 / 360 = 400 minutes -> 400/480 = 0.833 day deduction.
  // Marginal deduction for this day is 1.0 - 0.833 = 0.167 days.
  assert.equal(penalty6hr.accumulatedLateMinutes, 360);
  assert.equal(penalty6hr.deductionDayValue, 0.167);
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
