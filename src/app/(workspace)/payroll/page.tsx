import { PageTitle } from "@/components/page-title";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualPayrollForm } from "@/features/payroll/components/manual-payroll-form";
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
  const defaultTab = params.tab === "manual" ? "manual" : "automatic";
  const period = currentMonthRange();
  const prisma = getPrisma();
  const [employees, manualEmployees, rules] = await Promise.all([
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
    prisma.employee.findMany({
      where: { employmentStatus: "ACTIVE" },
      include: { department: true, position: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    getPayrollRules(),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <PageTitle title="Payroll" description="Search an employee to calculate and print the current monthly payroll." />
      <Tabs defaultValue={defaultTab}>
        <TabsList data-print-hidden="true">
          <TabsTrigger value="automatic">Automatic Payroll</TabsTrigger>
          <TabsTrigger value="manual">Manual / Custom Payroll</TabsTrigger>
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
        <TabsContent value="manual" className="mt-5">
          <ManualPayrollForm
            defaultStartDate={period.startDate}
            defaultEndDate={period.endDate}
            employees={manualEmployees.map((employee) => ({
              id: employee.id,
              employeeNumber: employee.employeeNumber,
              fullName: [employee.firstName, employee.middleName, employee.lastName, employee.suffix].filter(Boolean).join(" "),
              department: employee.department.name,
              position: employee.position.name,
            }))}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
