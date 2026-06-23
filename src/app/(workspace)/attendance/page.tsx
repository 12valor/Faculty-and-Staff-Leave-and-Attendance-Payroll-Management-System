import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import Link from "next/link";

import { AutoFilterForm } from "@/components/auto-filter-form";
import { PageTitle } from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DailyAttendanceTable, StatusBadge, type DailyAttendanceEmployee } from "@/features/attendance/components/daily-attendance-table";
import { effectiveScheduleWhere, resolveScheduleFromRows } from "@/features/schedules/lib/resolve-schedule";
import { getFacultyScheduledDailyHours, getPeriodOrMonthRange } from "@/features/attendance/lib/calculate-attendance";
import { getPayrollRules } from "@/lib/settings/payroll-rules";
import type { AttendanceEntryMethod, AttendanceStatus, EmployeeType, Prisma } from "@/generated/prisma/client";
import { getDayOfWeek, todayInTimeZone } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tab = value(params.tab) === "history" ? "history" : "daily";
  const date = value(params.date) ?? todayInTimeZone();
  const employeeId = value(params.employee);
  const departmentId = value(params.department);
  const employeeType = value(params.type) as EmployeeType | undefined;
  const status = value(params.status) as AttendanceStatus | undefined;
  const entryMethod = value(params.method) as AttendanceEntryMethod | undefined;
  const from = value(params.from);
  const to = value(params.to);
  const day = getDayOfWeek(date);
  const scheduleWhere = effectiveScheduleWhere(date, day);

  const payrollPeriod = await getPrisma().payrollPeriod.findFirst({
    where: { startDate: { lte: date }, endDate: { gte: date } }
  });
  const range = payrollPeriod ? { startDate: payrollPeriod.startDate, endDate: payrollPeriod.endDate } : getPeriodOrMonthRange(date);

  const [dailyEmployees, employees, departments, records, rules, conversions, dailyRecordsInPeriod] = await Promise.all([
    getPrisma().employee.findMany({ where: { employmentStatus: "ACTIVE" }, include: { department: true, position: true, workSchedules: { where: scheduleWhere }, facultySchedules: { where: scheduleWhere }, attendanceRecords: { where: { date } }, leaveAllocations: { where: { date, leaveRecord: { status: "APPROVED" } } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    getPrisma().employee.findMany({ where: { employmentStatus: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    getPrisma().department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    getPrisma().attendanceRecord.findMany({ where: { employeeId, status, entryMethod, date: from || to ? { gte: from, lte: to } : undefined, employee: { departmentId, employeeType } }, include: { employee: { include: { department: true } } }, orderBy: [{ date: "desc" }, { employee: { lastName: "asc" } }] }),
    getPayrollRules(),
    getPrisma().cscTimeConversion.findMany({ orderBy: [{ unit: "asc" }, { value: "asc" }] }),
    getPrisma().attendanceRecord.findMany({
      where: {
        date: { gte: range.startDate, lt: date }
      }
    })
  ]);

  const dailyRows: DailyAttendanceEmployee[] = dailyEmployees.map((employee) => {
    const record = employee.attendanceRecords[0];

    const priorLateMinutes = dailyRecordsInPeriod
      .filter((r) => r.employeeId === employee.id)
      .reduce((sum, r) => sum + r.lateMinutes, 0);

    const activeFacultySchedules = employee.facultySchedules.filter(s =>
      s.isActive &&
      s.effectiveFrom <= range.endDate &&
      (!s.effectiveTo || s.effectiveTo >= range.startDate)
    );
    const activeWorkSchedules = employee.workSchedules.filter(s =>
      s.isActive &&
      s.effectiveFrom <= range.endDate &&
      (!s.effectiveTo || s.effectiveTo >= range.startDate)
    );

    let thresholdHours = 8;
    if (employee.employeeType === "FACULTY") {
      thresholdHours = getFacultyScheduledDailyHours(activeFacultySchedules);
    } else if (employee.employeeType === "FACULTY_WITH_STAFF_WORK") {
      if (activeWorkSchedules.length > 0) {
        thresholdHours = 8;
      } else {
        thresholdHours = getFacultyScheduledDailyHours(activeFacultySchedules);
      }
    }

    return {
      employeeId: employee.id,
      employeeName: `${employee.lastName}, ${employee.firstName}`,
      employeeNumber: employee.employeeNumber,
      employeeType: employee.employeeType,
      department: employee.department.name,
      position: employee.position.name,
      schedule: resolveScheduleFromRows(employee.employeeType, employee.workSchedules, employee.facultySchedules),
      approvedLeave: employee.leaveAllocations.length > 0,
      timeIn: record?.timeIn ?? "",
      timeOut: record?.timeOut ?? "",
      remarks: record?.remarks ?? "",
      storedStatus: record?.status ?? null,
      isStatusOverridden: record?.isStatusOverridden ?? false,
      priorLateMinutes,
      scheduledDailyHours: thresholdHours,
      monthlySalary: Number(employee.monthlySalary),
      workingDaysPerMonth: rules.workingDaysPerMonth,
      absencePenaltyAmount: rules.absencePenaltyAmount,
    };
  });

  const conversionTable = conversions.map((row) => ({ unit: row.unit as any, value: row.value, equivalentDay: Number(row.equivalentDay) }));

  return <section className="flex flex-col gap-6">
    <PageTitle title="Attendance" description="Encode daily attendance automatically or review the complete attendance history." actions={<><Button nativeButton={false} render={<Link href="/attendance/manual" />} variant="outline"><AddRoundedIcon data-icon="inline-start" />Manual Entry</Button><Button nativeButton={false} render={<Link href="/attendance/import" />} variant="outline"><UploadFileRoundedIcon data-icon="inline-start" />CSV Import</Button></>} />
    <Tabs defaultValue={tab}><TabsList><TabsTrigger value="daily">Daily Encoding</TabsTrigger><TabsTrigger value="history">Attendance History</TabsTrigger></TabsList><TabsContent value="daily" className="mt-4"><DailyAttendanceTable key={date} date={date} employees={dailyRows} conversions={conversionTable} /></TabsContent><TabsContent value="history" className="mt-4 flex flex-col gap-4"><HistoryFilters employees={employees} departments={departments} values={{ employeeId, departmentId, employeeType, status, entryMethod, from, to }} /><HistoryTable records={records} /></TabsContent></Tabs>
  </section>;
}

function HistoryFilters({ employees, departments, values }: { employees: Array<{ id: string; employeeNumber: string; lastName: string }>; departments: Array<{ id: string; name: string }>; values: { employeeId?: string; departmentId?: string; employeeType?: EmployeeType; status?: AttendanceStatus; entryMethod?: AttendanceEntryMethod; from?: string; to?: string } }) {
  return <AutoFilterForm className="filter-panel grid gap-3 md:grid-cols-4 xl:grid-cols-7"><input type="hidden" name="tab" value="history" /><Input type="date" name="from" defaultValue={values.from} aria-label="From date" /><Input type="date" name="to" defaultValue={values.to} aria-label="To date" /><NativeSelect name="employee" defaultValue={values.employeeId ?? ""} className="w-full"><NativeSelectOption value="">All employees</NativeSelectOption>{employees.map((employee) => <NativeSelectOption key={employee.id} value={employee.id}>{employee.employeeNumber} · {employee.lastName}</NativeSelectOption>)}</NativeSelect><NativeSelect name="department" defaultValue={values.departmentId ?? ""} className="w-full"><NativeSelectOption value="">All departments</NativeSelectOption>{departments.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect><NativeSelect name="type" defaultValue={values.employeeType ?? ""} className="w-full"><NativeSelectOption value="">All types</NativeSelectOption><NativeSelectOption value="FACULTY">Faculty</NativeSelectOption><NativeSelectOption value="STAFF">Staff</NativeSelectOption><NativeSelectOption value="FACULTY_WITH_STAFF_WORK">Faculty with staff work</NativeSelectOption></NativeSelect><NativeSelect name="status" defaultValue={values.status ?? ""} className="w-full"><NativeSelectOption value="">All statuses</NativeSelectOption>{["PRESENT","LATE","ABSENT","ON_LEAVE","UNDERTIME","INCOMPLETE","LATE_UNDERTIME","NO_SCHEDULE"].map((item) => <NativeSelectOption key={item} value={item}>{item.replaceAll("_", " ")}</NativeSelectOption>)}</NativeSelect><NativeSelect name="method" defaultValue={values.entryMethod ?? ""} className="w-full"><NativeSelectOption value="">All methods</NativeSelectOption><NativeSelectOption value="ADMIN_MANUAL">Manual</NativeSelectOption><NativeSelectOption value="BULK_ENCODING">Daily/Bulk</NativeSelectOption><NativeSelectOption value="CSV_IMPORT">CSV</NativeSelectOption></NativeSelect></AutoFilterForm>;
}

type HistoryRecord = Prisma.AttendanceRecordGetPayload<{ include: { employee: { include: { department: true } } } }>;
function HistoryTable({ records }: { records: HistoryRecord[] }) {
  return <div className="data-table-shell"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>Times</TableHead><TableHead>Rendered</TableHead><TableHead>Status</TableHead><TableHead>Minutes</TableHead><TableHead>Deduction</TableHead><TableHead>Method</TableHead><TableHead>Remarks</TableHead><TableHead /></TableRow></TableHeader><TableBody>{records.length ? records.map((record) => <TableRow key={record.id}><TableCell className="font-medium">{record.date}</TableCell><TableCell><p className="font-medium">{record.employee.lastName}, {record.employee.firstName}</p><p className="text-xs text-muted-foreground">{record.employee.employeeNumber} · {record.employee.department.name}</p></TableCell><TableCell>{record.timeIn ?? "—"}–{record.timeOut ?? "—"}</TableCell><TableCell>{record.renderedMinutes ? `${Math.floor(record.renderedMinutes / 60)}h ${record.renderedMinutes % 60}m` : "—"}</TableCell><TableCell><StatusBadge status={record.status} overridden={record.isStatusOverridden} /></TableCell><TableCell className="text-xs leading-5">Late {record.lateMinutes}<br />Under {record.undertimeMinutes}<br />OT {record.overtimeMinutes}</TableCell><TableCell className="font-semibold">₱{Number(record.deductionAmount).toFixed(2)}</TableCell><TableCell><Badge variant="outline">{record.entryMethod.replaceAll("_", " ")}</Badge></TableCell><TableCell className="max-w-52 truncate">{record.remarks || record.overrideReason || "—"}</TableCell><TableCell><Button nativeButton={false} render={<Link href={`/attendance/manual?id=${record.id}`} />} size="icon-sm" variant="ghost" aria-label="Edit attendance"><EditRoundedIcon /></Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={10} className="h-28 text-center text-muted-foreground">No attendance records found.</TableCell></TableRow>}</TableBody></Table></div>;
}

function value(input: string | string[] | undefined) { return typeof input === "string" && input ? input : undefined; }
