import "server-only";

import type { DayOfWeek, EmployeeType, Prisma } from "@/generated/prisma/client";
import { getDayOfWeek } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";

type ScheduleRow = { dayOfWeek: DayOfWeek; expectedTimeIn: string; expectedTimeOut: string };
type FacultyRow = { dayOfWeek: DayOfWeek; startTime: string; endTime: string };

export type ResolvedSchedule = {
  expectedTimeIn: string;
  expectedTimeOut: string;
  source: "WORK" | "FACULTY" | "COMBINED";
};

export function resolveScheduleFromRows(employeeType: EmployeeType, workRows: ScheduleRow[], facultyRows: FacultyRow[]): ResolvedSchedule | null {
  const work = employeeType === "FACULTY" ? [] : workRows;
  const faculty = employeeType === "STAFF" ? [] : facultyRows;
  const starts = [...work.map((row) => row.expectedTimeIn), ...faculty.map((row) => row.startTime)].sort();
  const ends = [...work.map((row) => row.expectedTimeOut), ...faculty.map((row) => row.endTime)].sort();
  if (!starts.length || !ends.length) return null;
  return {
    expectedTimeIn: starts[0] || "08:00",
    expectedTimeOut: ends.at(-1) || "17:00",
    source: work.length && faculty.length ? "COMBINED" : work.length ? "WORK" : "FACULTY",
  };
}

export function effectiveScheduleWhere(date: string, dayOfWeek = getDayOfWeek(date)) {
  return {
    dayOfWeek,
    isActive: true,
    effectiveFrom: { lte: date },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
  } satisfies Prisma.WorkScheduleWhereInput;
}

export function scheduleIsEffective(row: { dayOfWeek: DayOfWeek; effectiveFrom: string; effectiveTo: string | null; isActive: boolean }, date: string) {
  return row.isActive && row.dayOfWeek === getDayOfWeek(date) && row.effectiveFrom <= date && (!row.effectiveTo || row.effectiveTo >= date);
}

export function resolveScheduleForDateFromAllRows(employeeType: EmployeeType, date: string, workRows: Array<ScheduleRow & { effectiveFrom: string; effectiveTo: string | null; isActive: boolean }>, facultyRows: Array<FacultyRow & { effectiveFrom: string; effectiveTo: string | null; isActive: boolean }>) {
  return resolveScheduleFromRows(employeeType, workRows.filter((row) => scheduleIsEffective(row, date)), facultyRows.filter((row) => scheduleIsEffective(row, date)));
}

export async function getEmployeeScheduleForDate(employeeId: string, date: string) {
  const dayOfWeek = getDayOfWeek(date);
  const employee = await getPrisma().employee.findUniqueOrThrow({
    where: { id: employeeId },
    include: {
      workSchedules: { where: effectiveScheduleWhere(date, dayOfWeek) },
      facultySchedules: { where: effectiveScheduleWhere(date, dayOfWeek) },
    },
  });
  return { employee, schedule: resolveScheduleFromRows(employee.employeeType, employee.workSchedules, employee.facultySchedules) };
}
