import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EmployeeManager, type EmployeeRow } from "@/features/employees/components/employee-manager";
import type { EmployeeType, EmploymentStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EmployeesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const employeeType = typeof params.type === "string" && params.type ? params.type as EmployeeType : undefined;
  const departmentId = typeof params.department === "string" && params.department ? params.department : undefined;
  const positionId = typeof params.position === "string" && params.position ? params.position : undefined;
  const status = typeof params.status === "string" && params.status ? params.status as EmploymentStatus : undefined;

  const [employees, departments, positions] = await Promise.all([
    getPrisma().employee.findMany({
      where: {
        employeeType,
        departmentId,
        positionId,
        employmentStatus: status,
        ...(search ? { OR: [{ employeeNumber: { contains: search } }, { firstName: { contains: search } }, { lastName: { contains: search } }] } : {}),
      },
      include: { department: true, position: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    getPrisma().department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    getPrisma().position.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const rows: EmployeeRow[] = employees.map((employee) => ({
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    middleName: employee.middleName ?? "",
    lastName: employee.lastName,
    suffix: employee.suffix ?? "",
    fullName: [employee.firstName, employee.middleName, employee.lastName, employee.suffix].filter(Boolean).join(" "),
    employeeType: employee.employeeType,
    departmentId: employee.departmentId,
    departmentName: employee.department.name,
    positionId: employee.positionId,
    positionName: employee.position.name,
    monthlySalary: Number(employee.monthlySalary),
    employmentStatus: employee.employmentStatus,
    remarks: employee.remarks ?? "",
  }));

  return (
    <section className="flex flex-col gap-6">
      <PageTitle title="Employees" description="Create, maintain, search, and archive faculty and staff records." />
      <form className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-6">
        <Input name="search" defaultValue={search} placeholder="Search name or employee no." className="md:col-span-2" />
        <NativeSelect name="type" defaultValue={employeeType ?? ""} className="w-full"><NativeSelectOption value="">All types</NativeSelectOption><NativeSelectOption value="FACULTY">Faculty</NativeSelectOption><NativeSelectOption value="STAFF">Staff</NativeSelectOption><NativeSelectOption value="FACULTY_WITH_STAFF_WORK">Faculty with staff work</NativeSelectOption></NativeSelect>
        <NativeSelect name="department" defaultValue={departmentId ?? ""} className="w-full"><NativeSelectOption value="">All departments</NativeSelectOption>{departments.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect>
        <NativeSelect name="position" defaultValue={positionId ?? ""} className="w-full"><NativeSelectOption value="">All positions</NativeSelectOption>{positions.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect>
        <NativeSelect name="status" defaultValue={status ?? ""} className="w-full"><NativeSelectOption value="">All statuses</NativeSelectOption><NativeSelectOption value="ACTIVE">Active</NativeSelectOption><NativeSelectOption value="INACTIVE">Inactive</NativeSelectOption><NativeSelectOption value="ARCHIVED">Archived</NativeSelectOption></NativeSelect>
        <Button type="submit" className="md:col-start-6">Apply filters</Button>
      </form>
      <EmployeeManager employees={rows} departments={departments.map(({ id, name }) => ({ id, name }))} positions={positions.map(({ id, name }) => ({ id, name }))} />
    </section>
  );
}