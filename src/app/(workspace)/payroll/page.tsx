import { PageTitle } from "@/components/page-title";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayrollManager } from "@/features/payroll/components/payroll-manager";
import { PayrollSearch } from "@/features/payroll/components/payroll-search";
import { currentMonthRange } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";
import { getPayrollRules } from "@/lib/settings/payroll-rules";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: "Payroll" };
export const dynamic = "force-dynamic";

export default async function PayrollPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const defaultTab = params.tab === "advanced" ? "advanced" : "automatic";
  const period = currentMonthRange();
  const prisma = getPrisma();
  const [employees, periods, rules] = await Promise.all([
    search
      ? prisma.employee.findMany({
          where: {
            employmentStatus: { not: "ARCHIVED" },
            serviceStartDate: { lte: period.endDate },
            AND: [
              { OR: [{ serviceEndDate: null }, { serviceEndDate: { gte: period.startDate } }] },
              { OR: [{ employeeNumber: { contains: search } }, { firstName: { contains: search } }, { lastName: { contains: search } }] },
            ],
          },
          include: { department: true, position: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          take: 25,
        })
      : Promise.resolve([]),
    prisma.payrollPeriod.findMany({
      include: { deductions: { include: { employee: true, breakdowns: true }, orderBy: { employee: { lastName: "asc" } } } },
      orderBy: { startDate: "desc" },
    }),
    getPayrollRules(),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <PageTitle title="Payroll" description="Search an employee to calculate and print the current monthly payroll." />
      <Tabs defaultValue={defaultTab}>
        <TabsList data-print-hidden="true">
          <TabsTrigger value="automatic">Automatic Payroll</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Periods</TabsTrigger>
        </TabsList>
        <TabsContent value="automatic" className="mt-5">
          <PayrollSearch
            search={search}
            periodLabel={period.label}
            payrollReady={rules.facultyOverloadHourlyRate !== null}
            employees={employees.map((employee) => ({
              id: employee.id,
              employeeNumber: employee.employeeNumber,
              fullName: [employee.firstName, employee.middleName, employee.lastName, employee.suffix].filter(Boolean).join(" "),
              department: employee.department.name,
              position: employee.position.name,
              status: employee.employmentStatus,
            }))}
          />
        </TabsContent>
        <TabsContent value="advanced" className="mt-5 flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">Create, generate, and lock saved payroll periods for historical records and reports.</p>
          <PayrollManager periods={periods.map((item) => ({
            id: item.id,
            name: item.name,
            startDate: item.startDate,
            endDate: item.endDate,
            status: item.status,
            totalAmount: item.deductions.reduce((sum, row) => sum + Number(row.amount), 0),
            employeeCount: item.deductions.length,
            deductions: item.deductions.map((row) => ({
              employeeId: row.employeeId,
              employee: `${row.employee.lastName}, ${row.employee.firstName}`,
              monthlySalary: Number(row.monthlySalary),
              dailyRate: Number(row.dailyRate),
              totalLateMinutes: row.totalLateMinutes,
              totalUndertimeMinutes: row.totalUndertimeMinutes,
              absenceDays: Number(row.absenceDays),
              lwopDays: Number(row.lwopDays),
              dayValue: Number(row.dayValue),
              amount: Number(row.amount),
              breakdowns: row.breakdowns.map((detail) => ({
                date: detail.date,
                source: detail.source,
                attendanceRecordId: detail.attendanceRecordId ?? undefined,
                leaveAllocationId: detail.leaveAllocationId ?? undefined,
                lateMinutes: detail.lateMinutes,
                undertimeMinutes: detail.undertimeMinutes,
                absenceDayValue: Number(detail.absenceDayValue),
                lwopDayValue: Number(detail.lwopDayValue),
                dayValue: Number(detail.dayValue),
                amount: Number(detail.amount),
                description: detail.description ?? "",
              })),
            })),
          }))} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
