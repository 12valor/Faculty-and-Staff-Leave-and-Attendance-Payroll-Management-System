import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import TableRowsRoundedIcon from "@mui/icons-material/TableRowsRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import Link from "next/link";

import { PageTitle } from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AttendanceEntryMethod, AttendanceStatus, EmployeeType } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const employeeId = value(params.employee);
  const departmentId = value(params.department);
  const employeeType = value(params.type) as EmployeeType | undefined;
  const status = value(params.status) as AttendanceStatus | undefined;
  const entryMethod = value(params.method) as AttendanceEntryMethod | undefined;
  const from = value(params.from);
  const to = value(params.to);
  const [employees, departments, records] = await Promise.all([
    getPrisma().employee.findMany({ where: { employmentStatus: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    getPrisma().department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    getPrisma().attendanceRecord.findMany({ where: { employeeId, status, entryMethod, date: from || to ? { gte: from, lte: to } : undefined, employee: { departmentId, employeeType } }, include: { employee: { include: { department: true } } }, orderBy: [{ date: "desc" }, { employee: { lastName: "asc" } }] }),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <PageTitle title="Attendance" description="Review encoded attendance, computed minutes, CSC day values, and payroll deductions." actions={<><Button nativeButton={false} render={<Link href="/attendance/manual" />}><AddRoundedIcon data-icon="inline-start" />Manual</Button><Button nativeButton={false} render={<Link href="/attendance/bulk" />} variant="outline"><TableRowsRoundedIcon data-icon="inline-start" />Bulk</Button><Button nativeButton={false} render={<Link href="/attendance/import" />} variant="outline"><UploadFileRoundedIcon data-icon="inline-start" />CSV Import</Button></>} />
      <form className="filter-panel grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Input type="date" name="from" defaultValue={from} aria-label="From date" />
        <Input type="date" name="to" defaultValue={to} aria-label="To date" />
        <NativeSelect name="employee" defaultValue={employeeId ?? ""} className="w-full"><NativeSelectOption value="">All employees</NativeSelectOption>{employees.map((employee) => <NativeSelectOption key={employee.id} value={employee.id}>{employee.employeeNumber} · {employee.lastName}</NativeSelectOption>)}</NativeSelect>
        <NativeSelect name="department" defaultValue={departmentId ?? ""} className="w-full"><NativeSelectOption value="">All departments</NativeSelectOption>{departments.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect>
        <NativeSelect name="type" defaultValue={employeeType ?? ""} className="w-full"><NativeSelectOption value="">All types</NativeSelectOption><NativeSelectOption value="FACULTY">Faculty</NativeSelectOption><NativeSelectOption value="STAFF">Staff</NativeSelectOption><NativeSelectOption value="FACULTY_WITH_STAFF_WORK">Faculty with staff work</NativeSelectOption></NativeSelect>
        <NativeSelect name="status" defaultValue={status ?? ""} className="w-full"><NativeSelectOption value="">All statuses</NativeSelectOption>{["PRESENT", "LATE", "ABSENT", "ON_LEAVE", "UNDERTIME"].map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}</NativeSelect>
        <NativeSelect name="method" defaultValue={entryMethod ?? ""} className="w-full"><NativeSelectOption value="">All methods</NativeSelectOption><NativeSelectOption value="ADMIN_MANUAL">Manual</NativeSelectOption><NativeSelectOption value="BULK_ENCODING">Bulk</NativeSelectOption><NativeSelectOption value="CSV_IMPORT">CSV</NativeSelectOption></NativeSelect>
        <Button type="submit">Apply filters</Button>
      </form>
      <div className="data-table-shell">
        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>Times</TableHead><TableHead>Status</TableHead><TableHead>Minutes</TableHead><TableHead>Day value</TableHead><TableHead>Deduction</TableHead><TableHead>Method</TableHead><TableHead>Remarks</TableHead><TableHead /></TableRow></TableHeader><TableBody>{records.length ? records.map((record) => <TableRow key={record.id}><TableCell className="font-medium">{record.date}</TableCell><TableCell><p className="font-medium">{record.employee.lastName}, {record.employee.firstName}</p><p className="text-xs text-muted-foreground">{record.employee.employeeNumber} · {record.employee.department.name}</p></TableCell><TableCell>{record.timeIn ?? "—"}–{record.timeOut ?? "—"}</TableCell><TableCell><Badge variant={record.isStatusOverridden ? "warning" : record.status === "ABSENT" ? "destructive" : "success"}>{record.status}{record.isStatusOverridden ? " · OVERRIDE" : ""}</Badge></TableCell><TableCell className="text-xs leading-5">Late {record.lateMinutes}<br />Under {record.undertimeMinutes}<br />OT {record.overtimeMinutes}</TableCell><TableCell>{record.deductionDayValue.toString()}</TableCell><TableCell className="font-semibold">₱{Number(record.deductionAmount).toFixed(2)}</TableCell><TableCell><Badge variant="outline">{record.entryMethod.replaceAll("_", " ")}</Badge></TableCell><TableCell className="max-w-52 truncate">{record.remarks || record.overrideReason || "—"}</TableCell><TableCell><Button nativeButton={false} render={<Link href={`/attendance/manual?id=${record.id}`} />} size="icon-sm" variant="ghost" aria-label="Edit attendance"><EditRoundedIcon /></Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={10} className="h-28 text-center text-muted-foreground">No attendance records found.</TableCell></TableRow>}</TableBody></Table>
      </div>
    </section>
  );
}

function value(input: string | string[] | undefined) { return typeof input === "string" && input ? input : undefined; }
