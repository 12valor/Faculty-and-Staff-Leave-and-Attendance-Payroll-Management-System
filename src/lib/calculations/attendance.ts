import type { AttendanceStatus } from "@/generated/prisma/client";

export type TimeConversionRow = { unit: "HOUR" | "MINUTE"; value: number; equivalentDay: number };
export type DailySchedule = { expectedTimeIn: string; expectedTimeOut: string; source?: string };
export const LATE_PENALTY_THRESHOLD_MINUTES = 480;

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

export function convertMinutesToDayValue(
  totalMinutes: number,
  thresholdHoursOrTable: number | TimeConversionRow[],
  maybeTable?: TimeConversionRow[]
) {
  let thresholdHours = 8;
  let table: TimeConversionRow[];

  if (Array.isArray(thresholdHoursOrTable)) {
    table = thresholdHoursOrTable;
  } else {
    thresholdHours = thresholdHoursOrTable;
    table = maybeTable ?? [];
  }

  const thresholdMinutes = thresholdHours * 60;
  // Scale minutes to standard 8-hour day (480 minutes) equivalent
  const scaledMinutes = (totalMinutes * 480) / thresholdMinutes;

  const safeMinutes = Math.min(480, Math.max(0, Math.round(scaledMinutes)));
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
  isBefore8AM?: boolean;
}): AttendanceStatus {
  if (!input.schedule) return "NO_SCHEDULE";
  if (input.approvedLeave) return "ON_LEAVE";
  if (!input.timeIn && !input.timeOut) {
    if (input.isBefore8AM) return "INCOMPLETE";
    return "ABSENT";
  }
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
  absencePenaltyAmount?: number;
}) {
  let deductionDayValue = 0;
  let deductionAmount = 0;
  const absencePenaltyAmount = input.absencePenaltyAmount ?? 500;
  const dailyRate = input.workingDaysPerMonth > 0 ? input.monthlySalary / input.workingDaysPerMonth : 0;

  if (input.approvedLeave && (input.approvedLeave.unpaidDayValue ?? 0) > 0) {
    deductionDayValue = Math.min(1, input.approvedLeave.unpaidDayValue ?? 0);
    deductionAmount = dailyRate * deductionDayValue;
  } else if (input.approvedLeave?.isPaid) {
    deductionDayValue = 0;
  } else if (input.status === "ABSENT") {
    deductionDayValue = 1;
    deductionAmount = absencePenaltyAmount;
  }

  return {
    deductionDayValue,
    deductionAmount: Number(deductionAmount.toFixed(2)),
  };
}

export function formatMinutesToLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function isPast5PM(dateStr: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const hour = parts.find((part) => part.type === "hour")?.value;

  const manilaToday = `${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}`;
  if (dateStr < manilaToday) {
    return true;
  }
  if (dateStr > manilaToday) {
    return false;
  }
  return Number(hour) >= 17;
}

export function isFutureAttendanceDate(dateStr: string, timezone = "Asia/Manila") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  const manilaToday = `${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}`;
  return dateStr > manilaToday;
}

export function isBefore8AM(dateStr: string, timezone = "Asia/Manila") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const hour = parts.find((part) => part.type === "hour")?.value;

  const manilaToday = `${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}`;
  if (dateStr > manilaToday) {
    return true;
  }
  if (dateStr < manilaToday) {
    return false;
  }
  return Number(hour) < 8;
}

export function calculateAttendancePenaltyShared(input: {
  employeeType: string;
  monthlySalary: number;
  workingDaysPerMonth: number;
  timeIn: string | null;
  timeOut: string | null;
  statusOverride: string | null;
  schedule: DailySchedule | null;
  priorLateMinutes: number;
  scheduledDailyHours: number;
  conversionTable: TimeConversionRow[];
  approvedLeave?: { isPaid: boolean; unpaidDayValue?: number } | null;
  isCurrentDayPast5PM: boolean;
  isBefore8AM?: boolean;
  absencePenaltyAmount?: number;
}) {
  const {
    employeeType,
    monthlySalary,
    workingDaysPerMonth,
    timeIn,
    timeOut,
    statusOverride,
    schedule,
    priorLateMinutes,
    approvedLeave,
    isCurrentDayPast5PM,
    isBefore8AM,
    absencePenaltyAmount = 500,
  } = input;

  if (!schedule) {
    return {
      renderedMinutes: 0,
      lateMinutes: 0,
      accumulatedLateMinutes: priorLateMinutes,
      undertimeMinutes: 0,
      computedStatus: "NO_SCHEDULE" as AttendanceStatus,
      status: (statusOverride || "NO_SCHEDULE") as AttendanceStatus,
      deductionDayValue: 0,
      deductionAmount: 0,
      overtimeMinutes: 0,
      overtimeOverloadLabel: "",
    };
  }

  const renderedMinutes = getRenderedMinutes(timeIn, timeOut);
  const lateMinutes = timeIn ? getLateMinutes(schedule.expectedTimeIn, timeIn, 15) : 0;
  const accumulatedLateMinutes = priorLateMinutes + lateMinutes;
  const undertimeMinutes = renderedMinutes > 0 ? Math.max(0, 360 - renderedMinutes) : 0;

  const computedStatus = computeAttendanceStatus({
    timeIn,
    timeOut,
    schedule,
    graceMinutes: 15,
    approvedLeave,
    isBefore8AM,
  });
  const status = (statusOverride || computedStatus) as AttendanceStatus;

  let overtimeMinutes = 0;
  let overtimeOverloadLabel = "";

  const isFaculty = employeeType === "FACULTY";
  const isFacultyWithStaff = employeeType === "FACULTY_WITH_STAFF_WORK";

  let isOverloadWork = false;
  if (isFaculty) {
    isOverloadWork = true;
  } else if (isFacultyWithStaff) {
    if (schedule.source === "WORK") {
      isOverloadWork = false;
    } else {
      isOverloadWork = true;
    }
  }

  if (timeIn && !timeOut && isCurrentDayPast5PM) {
    overtimeOverloadLabel = isOverloadWork ? "Pending Overload" : "Pending Overtime";
  } else if (timeIn && timeOut) {
    overtimeMinutes = getOvertimeMinutes(schedule.expectedTimeOut, timeOut);
    if (overtimeMinutes > 0) {
      const hoursStr = formatMinutesToLabel(overtimeMinutes);
      overtimeOverloadLabel = isOverloadWork ? `${hoursStr} Overload` : `${hoursStr} Overtime`;
    }
  }

  let deductionDayValue = 0;
  let deductionAmount = 0;

  if (approvedLeave && (approvedLeave.unpaidDayValue ?? 0) > 0) {
    deductionDayValue = Math.min(1, approvedLeave.unpaidDayValue ?? 0);
    const dailyRate = workingDaysPerMonth > 0 ? monthlySalary / workingDaysPerMonth : 0;
    deductionAmount = dailyRate * deductionDayValue;
  } else if (approvedLeave?.isPaid) {
    deductionDayValue = 0;
  } else if (status === "ABSENT") {
    deductionDayValue = 1;
    deductionAmount = absencePenaltyAmount;
  } else if (status !== "INCOMPLETE" && status !== "NO_SCHEDULE") {
    const currentUnits = Math.floor(accumulatedLateMinutes / LATE_PENALTY_THRESHOLD_MINUTES);
    const previousUnits = Math.floor(priorLateMinutes / LATE_PENALTY_THRESHOLD_MINUTES);
    deductionDayValue = Math.max(0, currentUnits - previousUnits);
    deductionAmount = deductionDayValue * absencePenaltyAmount;
  }

  deductionAmount = Number(deductionAmount.toFixed(2));

  return {
    renderedMinutes,
    lateMinutes,
    accumulatedLateMinutes,
    undertimeMinutes,
    computedStatus,
    status,
    deductionDayValue,
    deductionAmount,
    overtimeMinutes,
    overtimeOverloadLabel,
  };
}
