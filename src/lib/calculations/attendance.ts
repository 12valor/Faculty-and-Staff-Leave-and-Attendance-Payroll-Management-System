import type { AttendanceStatus } from "@/generated/prisma/client";

export type TimeConversionRow = { unit: "HOUR" | "MINUTE"; value: number; equivalentDay: number };
export type DailySchedule = { expectedTimeIn: string; expectedTimeOut: string };

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time value: ${value}`);
  }
  return hours * 60 + minutes;
}

export function getLateMinutes(scheduleTimeIn: string, actualTimeIn: string, graceMinutes: number) {
  return Math.max(0, timeToMinutes(actualTimeIn) - timeToMinutes(scheduleTimeIn) - Math.max(0, graceMinutes));
}

export function getUndertimeMinutes(scheduleTimeOut: string, actualTimeOut: string) {
  return Math.max(0, timeToMinutes(scheduleTimeOut) - timeToMinutes(actualTimeOut));
}

export function getOvertimeMinutes(scheduleTimeOut: string, actualTimeOut: string) {
  return Math.max(0, timeToMinutes(actualTimeOut) - timeToMinutes(scheduleTimeOut));
}

export function getRenderedMinutes(timeIn?: string | null, timeOut?: string | null) {
  if (!timeIn || !timeOut) return 0;
  return Math.max(0, timeToMinutes(timeOut) - timeToMinutes(timeIn));
}

export function convertMinutesToDayValue(totalMinutes: number, table: TimeConversionRow[]) {
  const safeMinutes = Math.min(480, Math.max(0, Math.round(totalMinutes)));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  const hourValue = hours === 0 ? 0 : table.find((row) => row.unit === "HOUR" && row.value === hours)?.equivalentDay;
  const minuteValue = minutes === 0 ? 0 : table.find((row) => row.unit === "MINUTE" && row.value === minutes)?.equivalentDay;

  if ((hours === 0 || hourValue !== undefined) && (minutes === 0 || minuteValue !== undefined)) {
    return Math.min(1, Number(((hourValue ?? 0) + (minuteValue ?? 0)).toFixed(3)));
  }
  return Math.min(1, Number((safeMinutes / 480).toFixed(3)));
}

export function computeAttendanceStatus(input: {
  timeIn?: string | null;
  timeOut?: string | null;
  schedule?: DailySchedule | null;
  graceMinutes: number;
  approvedLeave?: { isPaid: boolean; unpaidDayValue?: number } | null;
}): AttendanceStatus {
  if (!input.schedule) return "NO_SCHEDULE";
  if (input.approvedLeave) return "ON_LEAVE";
  if (!input.timeIn && !input.timeOut) return "ABSENT";
  if (!input.timeIn || !input.timeOut) return "INCOMPLETE";
  const renderedMinutes = getRenderedMinutes(input.timeIn, input.timeOut);
  if (renderedMinutes <= 0) return "INCOMPLETE";
  const isLate = getLateMinutes(input.schedule.expectedTimeIn, input.timeIn, input.graceMinutes) > 0;
  const isUndertime = renderedMinutes < 360;
  if (isLate && isUndertime) return "LATE_UNDERTIME";
  if (isLate) return "LATE";
  if (isUndertime) return "UNDERTIME";
  return "PRESENT";
}

export function computeAttendanceDeduction(input: {
  monthlySalary: number;
  workingDaysPerMonth: number;
  status: AttendanceStatus;
  lateMinutes: number;
  undertimeMinutes: number;
  approvedLeave?: { isPaid: boolean; unpaidDayValue?: number } | null;
  conversionTable: TimeConversionRow[];
}) {
  let deductionDayValue = 0;
  if (input.approvedLeave && (input.approvedLeave.unpaidDayValue ?? 0) > 0) deductionDayValue = Math.min(1, input.approvedLeave.unpaidDayValue ?? 0);
  else if (input.approvedLeave?.isPaid) deductionDayValue = 0;
  else if (input.status === "ABSENT" || (input.status === "ON_LEAVE" && input.approvedLeave && !input.approvedLeave.isPaid)) deductionDayValue = 1;
  else if (input.status === "INCOMPLETE" || input.status === "NO_SCHEDULE") deductionDayValue = 0;
  else deductionDayValue = convertMinutesToDayValue(input.lateMinutes + input.undertimeMinutes, input.conversionTable);

  const dailyRate = input.workingDaysPerMonth > 0 ? input.monthlySalary / input.workingDaysPerMonth : 0;
  return {
    deductionDayValue,
    deductionAmount: Number((dailyRate * deductionDayValue).toFixed(2)),
  };
}
