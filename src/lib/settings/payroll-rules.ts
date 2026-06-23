import "server-only";

import { getPrisma } from "@/lib/prisma";

export const PAYROLL_SETTING_KEYS = {
  workingDaysPerMonth: "workingDaysPerMonth",
  standardWorkHoursPerDay: "standardWorkHoursPerDay",
  lateGraceMinutes: "lateGraceMinutes",
  regularTeachingLoadHours: "regularTeachingLoadHours",
  overtimeMultiplier: "overtimeMultiplier",
  facultyOverloadHourlyRate: "facultyOverloadHourlyRate",
} as const;

export async function getPayrollRules() {
  const rows = await getPrisma().systemSetting.findMany({
    where: { key: { in: Object.values(PAYROLL_SETTING_KEYS) } },
  });
  const values = new Map(rows.map((row) => [row.key, Number(row.value)]));
  return {
    workingDaysPerMonth: values.get(PAYROLL_SETTING_KEYS.workingDaysPerMonth) ?? 22,
    standardWorkHoursPerDay: values.get(PAYROLL_SETTING_KEYS.standardWorkHoursPerDay) ?? 8,
    lateGraceMinutes: 15,
    regularTeachingLoadHours: values.get(PAYROLL_SETTING_KEYS.regularTeachingLoadHours) ?? 18,
    overtimeMultiplier: values.get(PAYROLL_SETTING_KEYS.overtimeMultiplier) ?? 1.25,
    facultyOverloadHourlyRate:
      values.get(PAYROLL_SETTING_KEYS.facultyOverloadHourlyRate) ?? null,
  };
}
