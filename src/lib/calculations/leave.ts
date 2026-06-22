export type LeaveDayInput = { date: string; dayValue: 0.5 | 1 };

export function splitPaidAndUnpaidDays(days: LeaveDayInput[], availableBalance: number) {
  let paidRemaining = Math.max(0, availableBalance);
  return days.map((day) => {
    const paidDayValue = Math.min(day.dayValue, paidRemaining);
    paidRemaining = Number((paidRemaining - paidDayValue).toFixed(3));
    return {
      ...day,
      paidDayValue: Number(paidDayValue.toFixed(3)),
      unpaidDayValue: Number((day.dayValue - paidDayValue).toFixed(3)),
    };
  });
}

export function reverseLeaveDebit(balance: number, debitedAmount: number) {
  return Number((balance + Math.max(0, debitedAmount)).toFixed(3));
}

type CreditRow = { numberOfDays: number; vacationLeaveEarned: number; sickLeaveEarned: number };
type LwopRow = { daysOnLwop: number; leaveCreditsEarned: number };

function interpolateDaily(days: number, rows: CreditRow[]) {
  const safe = Math.max(0, Math.min(30, days));
  if (safe === 0) return { vacation: 0, sick: 0 };
  const lower = Math.floor(safe);
  const upper = Math.ceil(safe);
  const lowerRow = rows.find((row) => row.numberOfDays === lower);
  const upperRow = rows.find((row) => row.numberOfDays === upper);
  if (lower === upper && lowerRow) return { vacation: lowerRow.vacationLeaveEarned, sick: lowerRow.sickLeaveEarned };
  const fraction = safe - lower;
  return {
    vacation: Number((((lowerRow?.vacationLeaveEarned ?? 0) * (1 - fraction)) + ((upperRow?.vacationLeaveEarned ?? 0) * fraction)).toFixed(3)),
    sick: Number((((lowerRow?.sickLeaveEarned ?? 0) * (1 - fraction)) + ((upperRow?.sickLeaveEarned ?? 0) * fraction)).toFixed(3)),
  };
}

export function computeMonthlyLeaveCredit(input: {
  serviceDays: number;
  lwopDays: number;
  monthlyCredit: { vacationLeaveEarned: number; sickLeaveEarned: number };
  dailyRows: CreditRow[];
  lwopRows: LwopRow[];
}) {
  const serviceDays = Math.max(0, Math.min(30, input.serviceDays));
  const lwopDays = Math.max(0, Math.min(serviceDays, input.lwopDays));
  if (serviceDays === 30 && lwopDays === 0) return { vacation: input.monthlyCredit.vacationLeaveEarned, sick: input.monthlyCredit.sickLeaveEarned };
  if (serviceDays === 30 && lwopDays > 0) {
    const row = input.lwopRows.find((item) => Math.abs(item.daysOnLwop - lwopDays) < 0.001);
    if (row) return { vacation: row.leaveCreditsEarned, sick: row.leaveCreditsEarned };
  }
  return interpolateDaily(serviceDays - lwopDays, input.dailyRows);
}

export function getServiceDaysForMonth(serviceStartDate: string, serviceEndDate: string | null, year: number, month: number) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const serviceStart = new Date(`${serviceStartDate}T00:00:00Z`);
  const serviceEnd = serviceEndDate ? new Date(`${serviceEndDate}T00:00:00Z`) : monthEnd;
  if (serviceStart > monthEnd || serviceEnd < monthStart) return 0;
  if (serviceStart <= monthStart && serviceEnd >= monthEnd) return 30;
  const start = serviceStart > monthStart ? serviceStart : monthStart;
  const end = serviceEnd < monthEnd ? serviceEnd : monthEnd;
  return Math.min(30, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
}
