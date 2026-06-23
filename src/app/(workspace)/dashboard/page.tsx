import type { Metadata } from "next";

import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { effectiveScheduleWhere, resolveScheduleForDateFromAllRows } from "@/features/schedules/lib/resolve-schedule";
import { getDayOfWeek, todayInTimeZone } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const prisma = getPrisma();
  const today = todayInTimeZone();
  const dates = Array.from({ length: 5 }, (_, index) => { const date = new Date(`${today}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - (4 - index)); return date.toISOString().slice(0, 10); });
  const todayScheduleWhere = effectiveScheduleWhere(today, getDayOfWeek(today));
  const [totalEmployees, facultyCount, scheduledEmployees, todayRecords, pendingLeave, approvedLeave, rejectedLeave, attendanceRows, deduction, deductions, payrollPeriod, employeesOnLeaveToday] = await Promise.all([
    prisma.employee.count({ where: { employmentStatus: "ACTIVE" } }),
    prisma.employee.count({ where: { employmentStatus: "ACTIVE", employeeType: "FACULTY" } }),
    prisma.employee.findMany({ where: { employmentStatus: "ACTIVE" }, include: { workSchedules: { where: todayScheduleWhere }, facultySchedules: { where: todayScheduleWhere } } }),
    prisma.attendanceRecord.findMany({ where: { date: today } }),
    prisma.leaveRecord.count({ where: { status: "PENDING" } }),
    prisma.leaveRecord.count({ where: { status: "APPROVED" } }),
    prisma.leaveRecord.count({ where: { status: "REJECTED" } }),
    prisma.attendanceRecord.findMany({ where: { date: { in: dates } }, include: { employee: { include: { workSchedules: true, facultySchedules: true } } } }),
    prisma.attendanceRecord.aggregate({ _sum: { deductionAmount: true } }),
    prisma.attendanceRecord.findMany({ where: { deductionAmount: { gt: 0 } }, include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.payrollPeriod.findFirst({ where: { status: { in: ["DRAFT", "GENERATED"] } }, orderBy: { startDate: "desc" } }),
    prisma.leaveAllocation.count({ where: { date: today, leaveRecord: { status: "APPROVED" } } }),
  ]);
  const presentToday = todayRecords.filter((row) => ["PRESENT","LATE","UNDERTIME","LATE_UNDERTIME"].includes(row.status)).length;
  const lateArrivalsToday = todayRecords.filter((row) => row.lateMinutes > 0).length;
  const scheduledToday = scheduledEmployees.filter((employee) => resolveScheduleForDateFromAllRows(employee.employeeType, today, employee.workSchedules, employee.facultySchedules)).length;
  const trend = dates.map((date) => ({ day: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short" }), present: attendanceRows.filter((row) => row.date === date && ["PRESENT","LATE","UNDERTIME","LATE_UNDERTIME"].includes(row.status)).length, absent: attendanceRows.filter((row) => row.date === date && row.status === "ABSENT" && resolveScheduleForDateFromAllRows(row.employee.employeeType, date, row.employee.workSchedules, row.employee.facultySchedules)).length }));
  return <DashboardOverview data={{ totalEmployees, facultyCount, staffCount: totalEmployees - facultyCount, presentToday, lateArrivalsToday, attendanceRate: scheduledToday ? Math.round((presentToday / scheduledToday) * 100) : 0, pendingLeave, deductionTotal: Number(deduction._sum.deductionAmount ?? 0), periodLabel: payrollPeriod ? `Payroll period · ${payrollPeriod.name}` : "No active payroll period", leaveStatuses: [{ label: "Approved", value: approvedLeave, variant: "success" }, { label: "Pending review", value: pendingLeave, variant: "warning" }, { label: "Rejected", value: rejectedLeave, variant: "destructive" }], trend, deductions: deductions.map((row) => ({ employee: `${row.employee.lastName}, ${row.employee.firstName}`, department: row.employee.department.name, type: row.status.replaceAll("_", " "), amount: `₱${Number(row.deductionAmount).toFixed(2)}`, status: row.date })), today, employeesOnLeaveToday }} />;
}
