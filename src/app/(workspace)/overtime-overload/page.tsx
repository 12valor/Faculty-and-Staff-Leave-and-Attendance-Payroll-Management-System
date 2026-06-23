import { AutoFilterForm } from "@/components/auto-filter-form";
import { PageTitle } from "@/components/page-title";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { OvertimeOverloadManager } from "@/features/overtime-overload/components/overtime-overload-manager";
import type { ApprovalStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default async function OvertimeOverloadPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams; const employeeId = value(params.employee); const departmentId = value(params.department); const status = value(params.status) as ApprovalStatus | undefined; const from = value(params.from); const to = value(params.to);
  const [employees, departments, overtime, overload] = await Promise.all([
    getPrisma().employee.findMany({ where: { employmentStatus: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    getPrisma().department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    getPrisma().overtimeRecord.findMany({ where: { employeeId, status, date: from || to ? { gte: from, lte: to } : undefined, employee: { departmentId } }, include: { employee: { include: { department: true } } }, orderBy: { date: "desc" } }),
    getPrisma().overloadRecord.findMany({ where: { employeeId, status, weekStart: to ? { lte: to } : undefined, weekEnd: from ? { gte: from } : undefined, employee: { departmentId } }, include: { employee: { include: { department: true } } }, orderBy: { weekStart: "desc" } }),
  ]);
  return <section className="flex flex-col gap-6"><PageTitle title="Overtime and Overload" description="Generate attendance-based staff overtime and weekly faculty teaching overload for Admin review." /><AutoFilterForm className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3 xl:grid-cols-5"><Input type="date" name="from" defaultValue={from} aria-label="From date" /><Input type="date" name="to" defaultValue={to} aria-label="To date" /><NativeSelect name="employee" defaultValue={employeeId ?? ""} className="w-full"><NativeSelectOption value="">All employees</NativeSelectOption>{employees.map((employee) => <NativeSelectOption key={employee.id} value={employee.id}>{employee.employeeNumber} · {employee.lastName}</NativeSelectOption>)}</NativeSelect><NativeSelect name="department" defaultValue={departmentId ?? ""} className="w-full"><NativeSelectOption value="">All departments</NativeSelectOption>{departments.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect><NativeSelect name="status" defaultValue={status ?? ""} className="w-full"><NativeSelectOption value="">All statuses</NativeSelectOption><NativeSelectOption value="PENDING">Pending</NativeSelectOption><NativeSelectOption value="APPROVED">Approved</NativeSelectOption><NativeSelectOption value="REJECTED">Rejected</NativeSelectOption></NativeSelect></AutoFilterForm><OvertimeOverloadManager overtime={overtime.map((row) => ({ id: row.id, employee: `${row.employee.lastName}, ${row.employee.firstName}`, department: row.employee.department.name, date: row.date, minutes: row.minutes, hours: Number(row.hours), status: row.status, remarks: row.remarks ?? "" }))} overload={overload.map((row) => ({ id: row.id, employee: `${row.employee.lastName}, ${row.employee.firstName}`, department: row.employee.department.name, weekStart: row.weekStart, weekEnd: row.weekEnd, totalTeachingHours: Number(row.totalTeachingHours), regularLoadHours: Number(row.regularLoadHours), overloadHours: Number(row.overloadHours), status: row.status, remarks: row.remarks ?? "" }))} /></section>;
}
function value(input: string | string[] | undefined) { return typeof input === "string" && input ? input : undefined; }
