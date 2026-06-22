export type PayrollSource = {
  date: string;
  source: "ATTENDANCE" | "LEAVE_WITHOUT_PAY";
  lateMinutes?: number;
  undertimeMinutes?: number;
  absenceDayValue?: number;
  lwopDayValue?: number;
  dayValue: number;
};

export function deduplicatePayrollSources(sources: PayrollSource[]) {
  const byDate = new Map<string, PayrollSource>();
  for (const source of sources) {
    const current = byDate.get(source.date);
    if (!current || source.source === "ATTENDANCE") byDate.set(source.date, source);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function summarizePayrollSources(monthlySalary: number, workingDaysPerMonth: number, sources: PayrollSource[]) {
  const rows = deduplicatePayrollSources(sources);
  const dailyRate = workingDaysPerMonth > 0 ? monthlySalary / workingDaysPerMonth : 0;
  const totals = rows.reduce((result, row) => ({
    lateMinutes: result.lateMinutes + (row.lateMinutes ?? 0),
    undertimeMinutes: result.undertimeMinutes + (row.undertimeMinutes ?? 0),
    absenceDays: result.absenceDays + (row.absenceDayValue ?? 0),
    lwopDays: result.lwopDays + (row.lwopDayValue ?? 0),
    dayValue: result.dayValue + row.dayValue,
  }), { lateMinutes: 0, undertimeMinutes: 0, absenceDays: 0, lwopDays: 0, dayValue: 0 });
  return {
    rows,
    dailyRate: Number(dailyRate.toFixed(2)),
    ...totals,
    dayValue: Number(totals.dayValue.toFixed(3)),
    amount: Number((dailyRate * totals.dayValue).toFixed(2)),
  };
}
