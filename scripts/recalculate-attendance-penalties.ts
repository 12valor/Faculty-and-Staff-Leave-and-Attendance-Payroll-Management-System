import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { calculateAttendancePenaltyShared, isPast5PM } from "../src/lib/calculations/attendance";
import { describeAttendancePenalty, getPayrollSourceAmount, summarizePayrollSources, type PayrollSource } from "../src/lib/calculations/payroll";
import { getDayOfWeek } from "../src/lib/dates";

type WorkScheduleRow = { dayOfWeek: string; expectedTimeIn: string; expectedTimeOut: string; effectiveFrom: string; effectiveTo: string | null; isActive: boolean };
type FacultyScheduleRow = { dayOfWeek: string; startTime: string; endTime: string; effectiveFrom: string; effectiveTo: string | null; isActive: boolean };

function resolveSchedule(employeeType: string, date: string, workRows: WorkScheduleRow[], facultyRows: FacultyScheduleRow[]) {
  const day = getDayOfWeek(date);
  const effective = (row: { dayOfWeek: string; effectiveFrom: string; effectiveTo: string | null; isActive: boolean }) => row.isActive && row.dayOfWeek === day && row.effectiveFrom <= date && (!row.effectiveTo || row.effectiveTo >= date);
  const work = employeeType === "FACULTY" ? [] : workRows.filter(effective);
  const faculty = employeeType === "STAFF" ? [] : facultyRows.filter(effective);
  const starts = [...work.map((row) => row.expectedTimeIn), ...faculty.map((row) => row.startTime)].sort();
  const ends = [...work.map((row) => row.expectedTimeOut), ...faculty.map((row) => row.endTime)].sort();
  if (!starts.length || !ends.length) return null;
  return { expectedTimeIn: starts[0], expectedTimeOut: ends.at(-1)!, source: work.length && faculty.length ? "COMBINED" : work.length ? "WORK" : "FACULTY" };
}
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});

async function main() {
  const penaltySetting = await prisma.systemSetting.upsert({
    where: { key: "absencePenaltyAmount" },
    update: {},
    create: {
      key: "absencePenaltyAmount",
      value: "500",
      valueType: "number",
      description: "Fixed penalty for each absence or completed eight hours of cumulative lateness.",
    },
  });
  const penaltyAmount = Number(penaltySetting.value) || 500;
  const workingDaysSetting = await prisma.systemSetting.findUnique({ where: { key: "workingDaysPerMonth" } });
  const workingDaysPerMonth = Number(workingDaysSetting?.value) || 22;
  const [periods, employees, conversions] = await Promise.all([
    prisma.payrollPeriod.findMany({ orderBy: { startDate: "asc" } }),
    prisma.employee.findMany({
      include: {
        workSchedules: true,
        facultySchedules: true,
        attendanceRecords: { orderBy: { date: "asc" } },
        leaveAllocations: { where: { leaveRecord: { status: "APPROVED" } }, include: { leaveRecord: true } },
      },
    }),
    prisma.cscTimeConversion.findMany(),
  ]);
  const conversionTable = conversions.map((row) => ({ unit: row.unit, value: row.value, equivalentDay: Number(row.equivalentDay) }));
  let updatedAttendance = 0;
  let skippedLockedAttendance = 0;

  for (const employee of employees) {
    const groups = new Map<string, typeof employee.attendanceRecords>();
    for (const record of employee.attendanceRecords) {
      const period = periods.find((item) => item.startDate <= record.date && item.endDate >= record.date);
      if (period?.status === "LOCKED") {
        skippedLockedAttendance += 1;
        continue;
      }
      const key = period ? `period:${period.id}` : `month:${record.date.slice(0, 7)}`;
      groups.set(key, [...(groups.get(key) ?? []), record]);
    }

    const leaveMap = new Map(employee.leaveAllocations.map((row) => [row.date, row]));
    for (const records of groups.values()) {
      let priorLateMinutes = 0;
      for (const record of records) {
        const schedule = resolveSchedule(employee.employeeType, record.date, employee.workSchedules, employee.facultySchedules);
        const allocation = leaveMap.get(record.date);
        const approvedLeave = allocation
          ? { isPaid: Number(allocation.unpaidDayValue) === 0, unpaidDayValue: Number(allocation.unpaidDayValue) }
          : null;
        const penalty = calculateAttendancePenaltyShared({
          employeeType: employee.employeeType,
          monthlySalary: Number(employee.monthlySalary),
          workingDaysPerMonth,
          timeIn: record.timeIn,
          timeOut: record.timeOut,
          statusOverride: record.isStatusOverridden ? record.status : null,
          schedule,
          priorLateMinutes,
          scheduledDailyHours: 8,
          conversionTable,
          approvedLeave,
          isCurrentDayPast5PM: isPast5PM(record.date),
          absencePenaltyAmount: penaltyAmount,
        });
        await prisma.attendanceRecord.update({
          where: { id: record.id },
          data: {
            computedStatus: penalty.computedStatus,
            status: penalty.status,
            lateMinutes: penalty.lateMinutes,
            undertimeMinutes: penalty.undertimeMinutes,
            overtimeMinutes: penalty.overtimeMinutes,
            renderedMinutes: penalty.renderedMinutes,
            deductionDayValue: penalty.deductionDayValue,
            deductionAmount: penalty.deductionAmount,
          },
        });
        priorLateMinutes += penalty.lateMinutes;
        updatedAttendance += 1;
      }
    }
  }

  let regeneratedPeriods = 0;
  for (const period of periods.filter((item) => item.status === "GENERATED")) {
    const [periodEmployees, attendance, allocations] = await Promise.all([
      prisma.employee.findMany({
        where: { employmentStatus: { not: "ARCHIVED" }, serviceStartDate: { lte: period.endDate }, OR: [{ serviceEndDate: null }, { serviceEndDate: { gte: period.startDate } }] },
        include: { workSchedules: true, facultySchedules: true },
      }),
      prisma.attendanceRecord.findMany({ where: { date: { gte: period.startDate, lte: period.endDate } } }),
      prisma.leaveAllocation.findMany({ where: { date: { gte: period.startDate, lte: period.endDate }, leaveRecord: { status: "APPROVED" } }, include: { leaveRecord: true } }),
    ]);
    const allocationMap = new Map(allocations.map((row) => [`${row.employeeId}:${row.date}`, row]));
    const summaries = periodEmployees.map((employee) => {
      const records = attendance.filter((row) => row.employeeId === employee.id);
      const attendanceDates = new Set(records.map((row) => row.date));
      const sources: Array<PayrollSource & { attendanceRecordId?: string; leaveAllocationId?: string; description: string }> = [];
      for (const record of records) {
        if (record.status === "NO_SCHEDULE") continue;
        if (record.status === "ABSENT" && !resolveSchedule(employee.employeeType, record.date, employee.workSchedules, employee.facultySchedules)) continue;
        const allocation = allocationMap.get(`${employee.id}:${record.date}`);
        if (allocation) {
          const unpaid = Number(allocation.unpaidDayValue);
          if (unpaid > 0) sources.push({ date: record.date, source: "ATTENDANCE", attendanceRecordId: record.id, leaveAllocationId: allocation.id, lwopDayValue: unpaid, dayValue: unpaid, description: "Approved unpaid leave" });
          continue;
        }
        const dayValue = record.status === "ABSENT" ? 1 : Number(record.deductionDayValue);
        if (dayValue <= 0 && record.lateMinutes <= 0 && record.undertimeMinutes <= 0) continue;
        sources.push({
          date: record.date,
          source: "ATTENDANCE",
          attendanceRecordId: record.id,
          lateMinutes: record.lateMinutes,
          undertimeMinutes: record.undertimeMinutes,
          absenceDayValue: record.status === "ABSENT" ? 1 : 0,
          dayValue,
          amountOverride: Number(record.deductionAmount),
          description: describeAttendancePenalty({ status: record.status, lateMinutes: record.lateMinutes, undertimeMinutes: record.undertimeMinutes, penaltyUnits: dayValue }),
        });
      }
      for (const allocation of allocations.filter((row) => row.employeeId === employee.id && Number(row.unpaidDayValue) > 0 && !attendanceDates.has(row.date))) {
        sources.push({ date: allocation.date, source: "LEAVE_WITHOUT_PAY", leaveAllocationId: allocation.id, lwopDayValue: Number(allocation.unpaidDayValue), dayValue: Number(allocation.unpaidDayValue), description: "Approved unpaid leave without attendance entry" });
      }
      const summary = summarizePayrollSources(Number(employee.monthlySalary), workingDaysPerMonth, sources);
      return { employee, sources, summary };
    }).filter(({ summary }) => summary.amount > 0 || summary.lateMinutes > 0 || summary.undertimeMinutes > 0);

    await prisma.$transaction(async (tx) => {
      await tx.payrollDeduction.deleteMany({ where: { payrollPeriodId: period.id } });
      for (const { employee, sources, summary } of summaries) {
        await tx.payrollDeduction.create({
          data: {
            payrollPeriodId: period.id,
            employeeId: employee.id,
            monthlySalary: employee.monthlySalary,
            dailyRate: summary.dailyRate,
            totalLateMinutes: summary.lateMinutes,
            totalUndertimeMinutes: summary.undertimeMinutes,
            absenceDays: summary.absenceDays,
            lwopDays: summary.lwopDays,
            dayValue: summary.dayValue,
            amount: summary.amount,
            breakdowns: { create: summary.rows.map((row) => {
              const source = sources.find((item) => item.date === row.date && item.source === row.source)!;
              return {
                date: source.date,
                source: source.source,
                attendanceRecordId: source.attendanceRecordId,
                leaveAllocationId: source.leaveAllocationId,
                lateMinutes: source.lateMinutes ?? 0,
                undertimeMinutes: source.undertimeMinutes ?? 0,
                absenceDayValue: source.absenceDayValue ?? 0,
                lwopDayValue: source.lwopDayValue ?? 0,
                dayValue: source.dayValue,
                amount: getPayrollSourceAmount(source, summary.dailyRate),
                description: source.description,
              };
            }) },
          },
        });
      }
    });
    regeneratedPeriods += 1;
  }

  const admin = await prisma.adminUser.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  await prisma.auditLog.create({
    data: {
      adminId: admin?.id ?? null,
      action: "ATTENDANCE_PENALTIES_RECALCULATED",
      entityType: "SYSTEM",
      summary: `${updatedAttendance} unlocked attendance record(s) were recalculated with the fixed penalty rule.`,
      metadata: JSON.stringify({ penaltyAmount, updatedAttendance, skippedLockedAttendance, regeneratedPeriods }),
    },
  });

  console.log({ penaltyAmount, updatedAttendance, skippedLockedAttendance, regeneratedPeriods });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });