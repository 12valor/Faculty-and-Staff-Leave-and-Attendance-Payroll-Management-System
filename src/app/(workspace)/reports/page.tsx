import { getPrisma } from "@/lib/prisma";
import type { EmployeeType } from "@/generated/prisma/client";
import { ReportsDashboard } from "@/features/reports/components/reports-dashboard";
import type { AttendanceReportRow, EmployeeReportRow, LeaveReportRow, PayrollReportRow } from "@/features/reports/components/report-tables";
import { PageTitle } from "@/components/page-title";
import { resolveScheduleForDateFromAllRows } from "@/features/schedules/lib/resolve-schedule";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = {
  title: "Reports",
};

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const prisma = getPrisma();
  const today = new Date().toISOString().slice(0, 10);
  const generatedAtLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date());
  
  // Default to current month range
  const dateObj = new Date();
  const firstDayOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString().slice(0, 10);

  // Parse filters from URL search parameters
  const params = await searchParams;
  const tab = typeof params.tab === "string" ? params.tab : "attendance";
  const from = typeof params.from === "string" ? params.from : firstDayOfMonth;
  const to = typeof params.to === "string" ? params.to : today;
  const employeeType = typeof params.type === "string" && params.type ? (params.type as EmployeeType) : undefined;
  const departmentId = typeof params.department === "string" && params.department ? params.department : undefined;
  const positionId = typeof params.position === "string" && params.position ? params.position : undefined;
  const periodId = typeof params.period === "string" && params.period ? params.period : undefined;

  // 1. Fetch Summary Card Metrics in Parallel
  const [
    totalEmployees,
    todayRecords,
    pendingLeaves,
    approvedLeaves,
    payrollPeriodsCount,
    departments,
    positions,
    payrollPeriods,
  ] = await Promise.all([
    prisma.employee.count({ where: { employmentStatus: "ACTIVE" } }),
    prisma.attendanceRecord.findMany({ where: { date: today }, include: { employee: { include: { workSchedules: true, facultySchedules: true } } } }),
    prisma.leaveRecord.count({ where: { status: "PENDING" } }),
    prisma.leaveRecord.count({ where: { status: "APPROVED" } }),
    prisma.payrollPeriod.count(),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.position.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.payrollPeriod.findMany({ orderBy: { startDate: "desc" } }),
  ]);

  const presentToday = todayRecords.filter((row) => ["PRESENT", "LATE", "UNDERTIME", "LATE_UNDERTIME"].includes(row.status)).length;
  const absentToday = todayRecords.filter((row) => row.status === "ABSENT" && resolveScheduleForDateFromAllRows(row.employee.employeeType, today, row.employee.workSchedules, row.employee.facultySchedules)).length;
  const lateToday = todayRecords.filter((row) => ["LATE", "LATE_UNDERTIME"].includes(row.status)).length;

  const metrics = {
    totalEmployees,
    presentToday,
    absentToday,
    lateToday,
    pendingLeaves,
    approvedLeaves,
    payrollPeriodsCount,
  };

  const references = {
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    positions: positions.map((p) => ({ id: p.id, name: p.name })),
    payrollPeriods: payrollPeriods.map((p) => ({ id: p.id, name: p.name, startDate: p.startDate, endDate: p.endDate })),
  };

  // 2. Fetch specific report data based on active tab
  let attendanceData: AttendanceReportRow[] = [];
  let leaveData: LeaveReportRow[] = [];
  let payrollData: PayrollReportRow[] = [];
  let employeeData: EmployeeReportRow[] = [];

  if (tab === "attendance") {
    const records = await prisma.attendanceRecord.findMany({
      where: {
        date: { gte: from, lte: to },
        employee: {
          employeeType,
          departmentId,
          positionId,
        },
      },
      include: {
        employee: {
          include: {
            department: true,
            position: true,
            workSchedules: true,
            facultySchedules: true,
          },
        },
      },
      orderBy: [
        { date: "desc" },
        { employee: { lastName: "asc" } },
      ],
    });

    attendanceData = records.map((r) => ({
      id: r.id,
      employeeName: [r.employee.lastName, r.employee.firstName].filter(Boolean).join(", ") + (r.employee.suffix ? ` ${r.employee.suffix}` : ""),
      employeeType: r.employee.employeeType,
      date: r.date,
      timeIn: r.timeIn,
      timeOut: r.timeOut,
      status: r.status === "ABSENT" && !resolveScheduleForDateFromAllRows(r.employee.employeeType, r.date, r.employee.workSchedules, r.employee.facultySchedules) ? "NO_SCHEDULE" : r.status,
      isStatusOverridden: r.isStatusOverridden,
    }));
  } else if (tab === "leave") {
    const records = await prisma.leaveRecord.findMany({
      where: {
        startDate: { lte: to },
        endDate: { gte: from },
        employee: {
          employeeType,
          departmentId,
          positionId,
        },
      },
      include: {
        employee: {
          include: {
            department: true,
            position: true,
          },
        },
      },
      orderBy: [
        { startDate: "desc" },
        { employee: { lastName: "asc" } },
      ],
    });

    leaveData = records.map((r) => ({
      id: r.id,
      employeeName: [r.employee.lastName, r.employee.firstName].filter(Boolean).join(", ") + (r.employee.suffix ? ` ${r.employee.suffix}` : ""),
      leaveType: r.leaveType,
      startDate: r.startDate,
      endDate: r.endDate,
      reason: r.reason ?? "",
      status: r.status,
    }));
  } else if (tab === "payroll") {
    const records = await prisma.payrollDeduction.findMany({
      where: {
        payrollPeriodId: periodId || undefined,
        payrollPeriod: periodId
          ? undefined
          : {
              startDate: { gte: from },
              endDate: { lte: to },
            },
        employee: {
          employeeType,
          departmentId,
          positionId,
        },
      },
      include: {
        payrollPeriod: true,
        employee: {
          include: {
            department: true,
            position: true,
          },
        },
      },
      orderBy: [
        { payrollPeriod: { startDate: "desc" } },
        { employee: { lastName: "asc" } },
      ],
    });

    payrollData = records.map((r) => ({
      id: r.id,
      employeeName: [r.employee.lastName, r.employee.firstName].filter(Boolean).join(", ") + (r.employee.suffix ? ` ${r.employee.suffix}` : ""),
      employeeType: r.employee.employeeType,
      payPeriod: r.payrollPeriod.name,
      basicPay: Number(r.monthlySalary),
      deductions: Number(r.amount),
      netPay: Number(r.monthlySalary) - Number(r.amount),
    }));
  } else if (tab === "employee") {
    const records = await prisma.employee.findMany({
      where: {
        employeeType,
        departmentId,
        positionId,
        employmentStatus: { not: "ARCHIVED" },
      },
      include: {
        department: true,
        position: true,
        attendanceRecords: {
          where: {
            date: { gte: from, lte: to },
          },
        },
        leaveRecords: {
          where: {
            status: "APPROVED",
            startDate: { lte: to },
            endDate: { gte: from },
          },
        },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    });

    employeeData = records.map((r) => ({
      id: r.id,
      employeeName: [r.lastName, r.firstName].filter(Boolean).join(", ") + (r.suffix ? ` ${r.suffix}` : ""),
      employeeType: r.employeeType,
      departmentName: r.department.name,
      positionName: r.position.name,
      status: r.employmentStatus,
      totalAttendance: r.attendanceRecords.length,
      totalLeaves: r.leaveRecords.length,
    }));
  }

  return (
    <section className="flex flex-col gap-6">
      <div data-print-hidden="true">
        <PageTitle
          title="Reports Dashboard"
          description="Prepare, filter, print, and export attendance, leave, payroll, and employee records."
        />
      </div>
      <ReportsDashboard
        metrics={metrics}
        references={references}
        attendanceData={attendanceData}
        leaveData={leaveData}
        payrollData={payrollData}
        employeeData={employeeData}
        defaultFrom={firstDayOfMonth}
        defaultTo={today}
        generatedAtLabel={generatedAtLabel}
      />
    </section>
  );
}
