import type { Metadata } from "next";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const prisma = getPrisma(); const today = new Date().toISOString().slice(0, 10); const dates = Array.from({ length: 5 }, (_, index) => { const date = new Date(); date.setUTCDate(date.getUTCDate() - (4 - index)); return date.toISOString().slice(0, 10); });
  const [totalEmployees, facultyCount, todayRecords, pendingLeave, approvedLeave, rejectedLeave, attendanceRows, deduction, deductions, payrollPeriod] = await Promise.all([
    prisma.employee.count({ where: { employmentStatus: "ACTIVE" } }), prisma.employee.count({ where: { employmentStatus: "ACTIVE", employeeType: "FACULTY" } }), prisma.attendanceRecord.findMany({ where: { date: today } }), prisma.leaveRecord.count({ where: { status: "PENDING" } }), prisma.leaveRecord.count({ where: { status: "APPROVED" } }), prisma.leaveRecord.count({ where: { status: "REJECTED" } }), prisma.attendanceRecord.findMany({ where: { date: { in: dates } } }), prisma.attendanceRecord.aggregate({ _sum: { deductionAmount: true } }), prisma.attendanceRecord.findMany({ where: { deductionAmount: { gt: 0 } }, include: { employee: { include: { department: true } } }, orderBy: { createdAt: "desc" }, take: 5 }), prisma.payrollPeriod.findFirst({ where: { status: { in: ["DRAFT", "GENERATED"] } }, orderBy: { startDate: "desc" } }),
  ]);
  const presentToday = todayRecords.filter((row) => ["PRESENT","LATE","UNDERTIME"].includes(row.status)).length;
  const trend = dates.map((date) => ({ day: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short" }), present: attendanceRows.filter((row) => row.date === date && ["PRESENT","LATE","UNDERTIME"].includes(row.status)).length, absent: attendanceRows.filter((row) => row.date === date && row.status === "ABSENT").length }));
  return <DashboardOverview data={{ totalEmployees, facultyCount, staffCount: totalEmployees - facultyCount, presentToday, attendanceRate: totalEmployees ? Math.round((presentToday / totalEmployees) * 100) : 0, pendingLeave, deductionTotal: Number(deduction._sum.deductionAmount ?? 0), periodLabel: payrollPeriod ? `Payroll period · ${payrollPeriod.name}` : "No active payroll period", leaveStatuses: [{ label: "Approved", value: approvedLeave, variant: "success" }, { label: "Pending review", value: pendingLeave, variant: "warning" }, { label: "Rejected", value: rejectedLeave, variant: "destructive" }], trend, deductions: deductions.map((row) => ({ employee: `${row.employee.lastName}, ${row.employee.firstName}`, department: row.employee.department.name, type: row.status.replaceAll("_", " "), amount: `₱${Number(row.deductionAmount).toFixed(2)}`, status: row.date })), today }} />;
}
