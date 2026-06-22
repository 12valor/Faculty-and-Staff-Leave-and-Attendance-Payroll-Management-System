import "server-only";

import { getPrisma } from "@/lib/prisma";

export const PAYROLL_SETTING_KEYS = {
  workingDaysPerMonth: "workingDaysPerMonth",
  standardWorkHoursPerDay: "standardWorkHoursPerDay",
  lateGraceMinutes: "lateGraceMinutes",
  regularTeachingLoadHours: "regularTeachingLoadHours",
} as const;

export async function getPayrollRules() {
  const rows = await getPrisma().systemSetting.findMany({
    where: { key: { in: Object.values(PAYROLL_SETTING_KEYS) } },
  });
  const values = new Map(rows.map((row) => [row.key, Number(row.value)]));
  return {
    workingDaysPerMonth: values.get(PAYROLL_SETTING_KEYS.workingDaysPerMonth) ?? 22,
    standardWorkHoursPerDay: values.get(PAYROLL_SETTING_KEYS.standardWorkHoursPerDay) ?? 8,
    lateGraceMinutes: values.get(PAYROLL_SETTING_KEYS.lateGraceMinutes) ?? 0,
    regularTeachingLoadHours: values.get(PAYROLL_SETTING_KEYS.regularTeachingLoadHours) ?? 18,
  };
}